// Parse an official 議案要旨 (bill outline) into structure, and build a compact
// skeleton for the LLM. The 要旨 format varies: the lead may be long
// ("本法律案は、…その主な内容は次のとおりである。") or short ("…の主な内容は次のとおりである。");
// top-level points are marked 一、 / 二　/ 三 with kanji numerals; some points carry
// arabic (１２３) sub-items in their body; some 要旨 are a single paragraph with no points.

/**
 * @typedef {object} YoushiPoint
 * @property {string} heading
 * @property {string} body
 */
/**
 * @typedef {object} Youshi
 * @property {string} lead
 * @property {YoushiPoint[]} points
 * @property {string} [enforcement]
 */

// Footer / chrome that the sangiin page appends after the substance.
const FOOTER =
  /(議案要旨のPDF|議案等のファイル|提出法律案|成立法律|委員会の修正案|利用案内|著作権|免責事項|ご意見・ご質問|All rights reserved|ページの先頭|サイトマップ|関連リンク|議案審議情報一覧)/;

// A top-level point marker: kanji numerals followed by 、 a space, or a fullwidth space.
const MARKER = /^[一二三四五六七八九十]+[、，\s　]/;

const SHIFT = /施行(期日|日|する|に)/;

/**
 * Parse cleaned 要旨 text → structure, or null when there is no usable outline.
 * @param {string | undefined | null} text
 * @returns {Youshi | null}
 */
export function parseYoushi(text) {
  if (!text) return null;
  // The shugiin listing page is navigation, not an outline. Key off "照会できる情報の一覧"
  // (unique to that page) — NOT the "議案本文情報一覧" breadcrumb that real 本文/要綱 pages
  // also carry, which would falsely reject genuine content.
  if (/照会できる情報の一覧/.test(text)) return null;

  let lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Drop footer chrome.
  const fi = lines.findIndex((l) => FOOTER.test(l));
  if (fi >= 0) lines = lines.slice(0, fi);

  // Skip the leading （…委員会） line and the title line ending in 要旨.
  let start = 0;
  const titleIdx = lines.findIndex((l) => /要旨\s*$/.test(l));
  if (titleIdx >= 0) start = titleIdx + 1;
  else if (lines[0] && /^（.*）$/.test(lines[0])) start = 1;
  const body = lines.slice(start);
  if (!body.length) return null;

  const firstMarker = body.findIndex((l) => MARKER.test(l));
  const lead = (firstMarker < 0 ? body : body.slice(0, firstMarker)).join('').trim();

  /** @type {YoushiPoint[]} */
  const points = [];
  if (firstMarker >= 0) {
    /** @type {{ heading: string, body: string[] } | null} */
    let cur = null;
    for (const l of body.slice(firstMarker)) {
      if (MARKER.test(l)) {
        if (cur) points.push({ heading: cur.heading, body: cur.body.join('').trim() });
        cur = { heading: l.replace(MARKER, '').trim(), body: [] };
      } else if (cur) {
        cur.body.push(l);
      }
    }
    if (cur) points.push({ heading: cur.heading, body: cur.body.join('').trim() });
  }

  // Pull a trailing 施行期日 point out as `enforcement`.
  /** @type {string | undefined} */
  let enforcement;
  const last = points[points.length - 1];
  if (last && (SHIFT.test(last.heading) || SHIFT.test(last.body))) {
    points.pop();
    enforcement = [last.heading, last.body].filter(Boolean).join('：').replace('：施行期日', '');
    if (/^施行期日/.test(last.heading)) enforcement = last.body || last.heading;
  }

  // Require real substance.
  if (lead.length < 15 && points.length === 0) return null;
  return { lead, points, enforcement };
}

/**
 * Compact, high-signal input for the LLM: lead + the official point headings.
 * @param {Youshi} y
 * @returns {string}
 */
export function youshiSkeleton(y) {
  const heads = y.points.map((p) => (p.heading || p.body).slice(0, 90)).filter(Boolean);
  let s = y.lead;
  if (heads.length) s += '\n主な内容:\n- ' + heads.join('\n- ');
  return s.slice(0, 900);
}
