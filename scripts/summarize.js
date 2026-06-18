// Generate beginner-friendly, grounded explanations for each bill using Google Gemini
// (AI Studio), in two passes:
//
//   Pass 1 (explainer) — from the official 議案要旨 (outline), WITH Google Search grounding.
//     Produces TITLE / SUMMARY / 概要 / なぜ重要か / 変わること.
//   Pass 2 (arguments) — from real NDL deliberation speeches + recorded votes, with NO
//     grounding (strictly the provided records). Produces 賛成・反対の論点. Runs only when
//     buildArgInput returns material; otherwise arguments stay null. This gate is what
//     keeps the model from inventing for/against positions it has no source for.
//
// Both Markdown contracts are parsed into structure and cached in data/ai.json, keyed by
// input hash (pass 1) + arg hash (pass 2) + prompt version, so each is generated once.
// Graceful skip without GEMINI_API_KEY.

import './load-env.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { buildAiInput, buildArgInput, aiHash, argHash, PROMPT_VERSION } from './aiinput.js';
import { parseExplainer, parseArguments } from './aimd.js';

/** @typedef {import('../src/lib/types.js').Bill} Bill */
/** @typedef {import('../src/lib/types.js').BillAI} BillAI */
/** @typedef {{ fetched: string, total: number, speeches: any[] }} Deliberation */

const ROOT = join(import.meta.dirname, '..');
const BILLS = join(ROOT, 'static', 'bills.json');
const AI_CACHE = join(ROOT, 'data', 'ai.json');
const DELIB_DIR = join(ROOT, 'data', 'deliberation');

// gemma-4-31b-it works on the free tier and accepts grounding + systemInstruction.
// (gemma-4-26b-a4b-it returns 503/500 under load; gemini-2.5-flash is a fine fallback.)
const MODEL = process.env.GEMINI_MODEL ?? 'gemma-4-31b-it';
const KEY = process.env.GEMINI_API_KEY;
const DELAY_MS = 4500; // free tier ≈ 15 req/min
const MAX_RETRIES = 5;

/** @typedef {BillAI & { hash: string, argHash: string, v: number }} Entry */
/** @typedef {Record<string, Entry>} Cache */

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pass 1: outline-based explainer (no for/against — that is pass 2's job).
const EXPLAIN_SYSTEM = `あなたは日本の法律案を、政治にくわしくない一般の人にもわかるように解説する専門家です。
出力は必ず次の形式のMarkdown（日本語）にしてください。

TITLE: <正式名称を「何をする法案か」が一目で分かるやさしい言い換えに。20〜40字程度。例:「防災の司令塔となる『防災庁』をつくるために関係する法律をまとめて変える法案」。太字は使わない>
SUMMARY: <この法案が何をするかを1〜2文で>
## 概要
- この法案が何をするかを3〜10個の箇条書きで具体的に説明する。各項目は1〜2文。
## なぜ重要か
この法案がなぜ重要か、だれにどう影響するかを2〜4文で説明する。
## 変わること
- 現状: <いまのしくみ> → 改正後: <この法案で変わる内容>

ルール:
- 「概要」は3〜10個の箇条書き。むずかしい用語は使うときにかんたんな説明を添える。各項目は具体的に（水増しや繰り返しはしない）。
- 重要なキーワード（制度名・金額・期限・固有名詞など）は **二重アスタリスク** で太字にする。1セクションにつき1〜3語程度。
- 「変わること」は、前と後がはっきり分かる変化だけを「現状: … → 改正後: …」の形で1行ずつ書く。矢印は必ず文字の「→」をそのまま書く（$\\rightarrow$ や \\to、-> は使わない）。明確な前後の変化がなければ、このセクションは省略してよい（無理に作らない）。
- 公式の議案要旨に書かれている内容を最優先で使う。検索は背景や用語の補足にとどめ、推測や不確かな情報は書かない。
- 事実ベース・中立。ここでは賛成・反対の評価や意見は書かない。
- 数字・固有名詞・制度名はできるだけ具体的に残す。「〜を改正する」だけのような中身のない説明（同義反復）は避ける。`;

// Pass 2: arguments strictly from the provided deliberation records + votes.
const ARG_SYSTEM = `あなたは国会での法案審議を中立にまとめる専門家です。以下に、実際の国会会議録の発言と、採決での各会派の賛否（事実）を渡します。
この資料に実際に書かれている賛成・反対の論点だけをまとめてください。

出力は必ず次の形式のMarkdown（日本語）にしてください。

## 賛成の論点
- <資料にある賛成の論点>（会派名）
## 反対の論点
- <資料にある反対の論点>（会派名）

ルール:
- 資料（会議録の発言・採決結果）に書かれていないことは絶対に書かない。論点・人物・数字・会派を創作しないこと。
- 各論点の末尾に、その発言をした会派名を全角カッコ（　）で添える。会派が分からなければカッコは付けない。
- 賛成・反対の論点はそれぞれ最大5個まで。実際に述べられた要点だけを簡潔に1〜2文で。
- 資料に賛成（または反対）の論点が無ければ、そのセクションは見出しだけにして箇条書きを付けない。
- 中立の言葉でまとめ、どちらかに肩入れしない。検索や推測はしない。`;

/**
 * @param {any} res
 * @returns {{ title: string, url: string }[]}
 */
function extractSources(res) {
  const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set();
  /** @type {{ title: string, url: string }[]} */
  const out = [];
  for (const c of chunks) {
    const web = c?.web;
    if (web?.uri && !seen.has(web.uri)) {
      seen.add(web.uri);
      out.push({ title: web.title || web.uri, url: web.uri });
    }
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * One model call with retry/backoff. `useSearch` toggles Google Search grounding.
 * @param {GoogleGenAI} ai
 * @param {string} system
 * @param {string} input
 * @param {boolean} useSearch
 * @returns {Promise<any>}
 */
async function callModel(ai, system, input, useSearch) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
        contents: input,
        config: {
          systemInstruction: system,
          temperature: useSearch ? 0.4 : 0.2,
          ...(useSearch ? { tools: [{ googleSearch: {} }] } : {})
        }
      });
    } catch (e) {
      const status = e?.status ?? e?.code;
      if ((status === 429 || status === 503 || status === 500) && attempt < MAX_RETRIES) {
        const wait = 10 * (attempt + 1);
        console.log(`  · rate limited (${status}), waiting ${wait}s (retry ${attempt + 1})`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
}

/**
 * @param {string} id
 * @returns {Deliberation | null}
 */
function readDeliberation(id) {
  const p = join(DELIB_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The official source URLs we point the model (and humans) at for a bill, for logging.
 * @param {Bill} bill
 * @returns {string[]}
 */
function sourceUrlsOf(bill) {
  const l = bill.links ?? {};
  return [l.detail, l.fullText, l.outlinePdf, l.progress].filter(
    (/** @type {string | undefined} */ u) => Boolean(u)
  );
}

/**
 * Run both passes for one bill. Returns null if the explainer pass produced nothing, or if
 * the bill had no grounded source at all (fail closed — see below).
 * @param {GoogleGenAI} ai
 * @param {Bill} bill
 * @param {Deliberation | null} delib
 * @returns {Promise<BillAI | null>}
 */
export async function generate(ai, bill, delib) {
  // Pass 1 — explainer (grounded).
  const res1 = await callModel(ai, EXPLAIN_SYSTEM, buildAiInput(bill), true);
  const explained = parseExplainer(res1.text ?? '');
  if (!explained || (!explained.plainTitle && explained.description.length === 0)) return null;
  const sources = extractSources(res1);

  // Fail closed: with NO official outline AND NO grounding sources, the model had no real
  // material to work from — the title alone is too abstract, so anything it produced is
  // ungrounded invention (this is exactly how a "study the issue" bill got summarized as a
  // donation ban). Refuse it; the UI falls back to the official title.
  if (!bill.outline && sources.length === 0) {
    const urls = sourceUrlsOf(bill);
    console.warn(
      `  ⚠ ungrounded — skipping ${bill.id}: no official outline + no grounding sources.` +
        `\n     source: ${urls.length ? urls.join(' | ') : '(none on record)'}`
    );
    return null;
  }

  // Pass 2 — arguments (gated, not grounded).
  /** @type {BillAI['arguments']} */
  let args = null;
  const argInput = buildArgInput(bill, delib);
  if (argInput) {
    await sleep(DELAY_MS); // space the second call within the rate limit
    const res2 = await callModel(ai, ARG_SYSTEM, argInput, false);
    args = parseArguments(res2.text ?? '');
  }

  return { ...explained, arguments: args, sources };
}

async function main() {
  /** @type {Cache} */
  const cache = existsSync(AI_CACHE) ? JSON.parse(readFileSync(AI_CACHE, 'utf8')) : {};
  const write = () => writeFileSync(AI_CACHE, JSON.stringify(cache, null, 2));

  if (!KEY) {
    console.warn('GEMINI_API_KEY not set — skipping AI generation (existing cache kept).');
    write();
    return;
  }
  if (!existsSync(BILLS)) {
    console.error('static/bills.json not found — run `npm run data` first.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: KEY });
  /** @type {Bill[]} */
  const bills = JSON.parse(readFileSync(BILLS, 'utf8'));

  /** @param {Bill} b */
  const isFresh = (b) => {
    const e = cache[b.id];
    if (!e || e.v !== PROMPT_VERSION || e.hash !== aiHash(buildAiInput(b))) return false;
    return e.argHash === argHash(buildArgInput(b, readDeliberation(b.id)));
  };

  const todo = bills.filter((b) => !isFresh(b));
  console.log(
    `Model: ${MODEL} (grounded) · ${bills.length} bills · ${bills.length - todo.length} cached · ${todo.length} to generate → data/ai.json`
  );
  if (todo.length === 0) {
    console.log('Everything up to date.');
    return;
  }

  const started = Date.now();
  let made = 0;
  let failed = 0;
  let withArgs = 0;
  for (let i = 0; i < todo.length; i++) {
    const bill = todo[i];
    const n = `[${i + 1}/${todo.length}]`;
    const label = `${bill.id} ${bill.title.slice(0, 24)}…`;
    const delib = readDeliberation(bill.id);
    process.stdout.write(`${n} ⏳ ${label}\n`);
    try {
      const result = await generate(ai, bill, delib);
      if (result) {
        cache[bill.id] = {
          ...result,
          hash: aiHash(buildAiInput(bill)),
          argHash: argHash(buildArgInput(bill, delib)),
          v: PROMPT_VERSION
        };
        made++;
        if (result.arguments) withArgs++;
        write(); // checkpoint after every success
        const arg = result.arguments ? ` · 論点 ${result.arguments.for.length}賛/${result.arguments.against.length}反` : '';
        console.log(`${n} ✓ ${result.plainTitle.slice(0, 36)}${arg}`);
      } else {
        failed++;
        // No summary written: either the explainer parse was empty, or the bill was
        // ungrounded and we failed closed (the ⚠ line above names which, with its source).
        console.log(`${n} · no summary written for ${bill.id}`);
      }
    } catch (e) {
      failed++;
      console.warn(`${n} ! ${bill.id} failed (${e?.status ?? e?.message}) — will backfill next run`);
    }
    const elapsed = Math.round((Date.now() - started) / 1000);
    const eta = Math.round((elapsed / (i + 1)) * (todo.length - i - 1));
    console.log(`      progress: ${made} done (${withArgs} with 論点), ${failed} failed · ${elapsed}s elapsed · ~${eta}s left`);
    if (i < todo.length - 1) await sleep(DELAY_MS);
  }
  console.log(`Done. ${made} generated (${withArgs} with 論点), ${failed} failed, ${bills.length - todo.length} unchanged → data/ai.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
