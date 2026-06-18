// Fetch the official outline text for each bill so summaries are based on real
// content, not just the title. Preferred source: the sangiin meisai page (inline
// 議案要旨 prose). Fallback: the shugiin 本文 full text. Cached per bill so each is
// fetched only once; re-run only refetches bills missing a cache file.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {import('../src/lib/types.js').Bill} Bill */

const ROOT = join(import.meta.dirname, '..');
const CONTENT_DIR = join(ROOT, 'data', 'content');
const BILLS = join(ROOT, 'static', 'bills.json');

const DELAY_MS = 700; // polite crawl
const MAX_CHARS = 1800; // bound LLM token cost

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} html
 * @returns {string}
 */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/[ \t　]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

const FOOTER =
  /(議案要旨のPDF|議案等のファイル|提出法律案|成立法律|委員会の修正案|ページの先頭|このページのトップ|議案審議情報一覧|利用案内|著作権|免責事項|ご意見・ご質問|Copyright|All rights reserved|お問い合わせ|サイトマップ|関連リンク|ホームページについて|Webアクセシビリティ|リンク・著作権等について)/;

// Shugiin g-number type codes (g{session}{type}{number}); see fetch URLs in bills.json.
const SHUGIIN_TYPE = /** @type {Record<string, string>} */ ({ 衆法: '05', 参法: '06', 閣法: '09' });

/**
 * Pull the 議案要旨 section out of a sangiin meisai page.
 * @param {string} text
 * @returns {string | null}
 */
function extractYoushi(text) {
  const i = text.indexOf('議案要旨');
  if (i < 0) return null;
  let body = text.slice(i + '議案要旨'.length);
  const f = body.search(FOOTER);
  if (f > 0) body = body.slice(0, f);
  body = body.replace(/^[\s\n（(][^\n]*要旨\s*$/m, '').trim();
  // Require some substance (a stub page just repeats the title).
  return body.length > 80 ? body.slice(0, MAX_CHARS) : null;
}

/**
 * Take the substantive head of a shugiin 本文 / 要綱 page. The real document pages carry a
 * "議案本文情報一覧" breadcrumb, so we must NOT reject on that — only the listing page itself
 * (identified by "照会できる情報の一覧") is navigation with no bill text.
 * @param {string} text
 * @returns {string | null}
 */
function extractHonbun(text) {
  if (/照会できる情報の一覧/.test(text)) return null;
  // Slice from the first substantive marker so the leading site chrome + breadcrumb is
  // dropped, then cut the trailing page footer. The "第二二一回" bill-number header (kanji
  // numerals — distinct from the arabic "第221回国会" breadcrumb) catches amendment bills
  // that open with "…の一部を次のように改正する" and have no （趣旨）/第一条.
  const i = text.search(/(第[一二三四五六七八九十百]+回|提案理由|（趣旨）|趣旨|第一条|第１|目次)/);
  let body = (i > 0 ? text.slice(i) : text).trim();
  const f = body.search(FOOTER);
  if (f > 0) body = body.slice(0, f).trim();
  return body.length > 80 ? body.slice(0, MAX_CHARS) : null;
}

/**
 * The shugiin 本文 (houan) page exists for every bill — including 参法 — at a predictable
 * URL. Prefer deriving it from links.fullText (just insert "houan/" before the g-number
 * file), else construct it from the bill id so we still get text when fullText is absent.
 * @param {Bill} bill
 * @returns {string | null}
 */
function shugiinHonbunUrl(bill) {
  const ft = bill.links?.fullText;
  if (ft && /\/g\d+\.htm$/i.test(ft)) return ft.replace(/\/([^/]+\.htm)$/i, '/houan/$1');
  const type = SHUGIIN_TYPE[bill.billType];
  if (!type) return null;
  const num = String(bill.number).padStart(3, '0');
  const g = `g${String(bill.session).padStart(3, '0')}${type}${num}`;
  return `https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/honbun/houan/${g}.htm`;
}

/**
 * The shugiin fullText URL is usually a "本文情報一覧" listing that only links to the actual
 * documents (提出時法律案 → ./houan/…, [要綱] → ./youkou/…). Resolve the best such link so we
 * can follow it. Prefer the 要綱 (concise official outline) over the full 本文.
 * @param {string} html raw HTML of the listing page
 * @param {string} baseUrl the listing page URL, for resolving relative hrefs
 * @returns {string | null}
 */
function linkedDocUrl(html, baseUrl) {
  /** @type {string | undefined} */ let youkou;
  /** @type {string | undefined} */ let honbun;
  for (const a of html.matchAll(/<a\s+[^>]*href=["']?([^"'>\s]+)[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = a[2].replace(/<[^>]+>/g, '').trim();
    if (/要綱/.test(label)) youkou ??= a[1];
    else if (/提出時法律案|本文|法律案/.test(label)) honbun ??= a[1];
  }
  const rel = youkou ?? honbun;
  if (!rel) return null;
  try {
    return new URL(rel, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Normalize a charset label to one TextDecoder understands.
 * @param {string | undefined} label
 * @returns {string}
 */
function normalizeCharset(label) {
  const c = (label ?? '').toLowerCase().trim();
  if (/shift_?jis|sjis|x-sjis|windows-31j|ms_kanji/.test(c)) return 'shift_jis';
  if (/euc-?jp/.test(c)) return 'euc-jp';
  return 'utf-8';
}

/**
 * @param {string} url
 * @returns {Promise<string | null>}
 */
async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'kokkai-visu/0.1 (research)' } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // sangiin meisai pages are UTF-8; shugiin 本文 pages are Shift_JIS. Detect from
    // the Content-Type header, falling back to the <meta charset> in the markup.
    let charset = res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1];
    if (!charset) {
      const head = new TextDecoder('latin1').decode(buf.slice(0, 2048));
      charset = head.match(/charset=["']?([\w-]+)/i)?.[1];
    }
    return new TextDecoder(normalizeCharset(charset)).decode(buf);
  } catch {
    return null;
  }
}

/**
 * @param {Bill} bill
 * @returns {Promise<string | null>}
 */
async function contentFor(bill) {
  // 1. sangiin meisai inline 議案要旨 — the cleanest source, when it has been published.
  if (bill.links.detail) {
    const html = await fetchText(bill.links.detail);
    if (html) {
      const y = extractYoushi(htmlToText(html));
      if (y) return y;
    }
    await sleep(DELAY_MS);
  }
  // 2. shugiin 本文 (houan) — published for every bill type (incl. 参法) at a predictable
  //    URL, so this works even when links.fullText is absent.
  const honbunUrl = shugiinHonbunUrl(bill);
  if (honbunUrl) {
    const html = await fetchText(honbunUrl);
    if (html) {
      const h = extractHonbun(htmlToText(html));
      if (h) return h;
    }
    await sleep(DELAY_MS);
  }
  // 3. fallback: the fullText listing page → follow its 要綱 / 本文 link one hop.
  if (bill.links.fullText) {
    const html = await fetchText(bill.links.fullText);
    if (html) {
      const direct = extractHonbun(htmlToText(html));
      if (direct) return direct;
      const docUrl = linkedDocUrl(html, bill.links.fullText);
      if (docUrl) {
        await sleep(DELAY_MS);
        const doc = await fetchText(docUrl);
        if (doc) return extractHonbun(htmlToText(doc));
      }
    }
  }
  return null;
}

async function main() {
  /** @type {Bill[]} */
  const bills = JSON.parse(readFileSync(BILLS, 'utf8'));
  mkdirSync(CONTENT_DIR, { recursive: true });

  let fetched = 0;
  let cached = 0;
  let refetched = 0;
  for (const bill of bills) {
    const path = join(CONTENT_DIR, `${bill.id}.txt`);
    if (existsSync(path)) {
      // An earlier run may have cached the "本文情報一覧" listing stub (before we followed
      // its 要綱/本文 link). Re-fetch those so the new path can grab the real document;
      // leave genuine content and empty "no source" markers alone.
      const prev = readFileSync(path, 'utf8');
      if (!/照会できる情報の一覧/.test(prev)) {
        cached++;
        continue;
      }
      refetched++;
    }
    const text = await contentFor(bill);
    writeFileSync(path, text ?? ''); // write empty marker so we don't retry forever
    if (text) {
      fetched++;
      console.log(`✓ ${bill.id}  ${bill.title.slice(0, 28)}…  (${text.length} chars)`);
    } else {
      console.log(`· ${bill.id}  no outline available`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done. ${fetched} fetched (${refetched} re-fetched stale stubs), ${cached} already cached.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
