// Plain-language status for beginners. Maps the detailed legislative stage to a friendly
// label and a simple 3-step journey (提出 → 議論中 → 成立) anyone can follow.

/** @typedef {import('./types.js').Bill} Bill */
/** @typedef {import('./types.js').Outline} Outline */

/**
 * Fallback card blurb when no AI one-liner exists: a useful preview of the official
 * 要旨 — its lead, or (when the lead is just boilerplate) the point headings.
 * @param {Bill} b
 * @returns {string | null}
 */
export function cardBlurb(b) {
  if (!b.outline) return null;
  return outlinePreview(b.outline);
}

/**
 * @param {Outline} o
 * @returns {string}
 */
function outlinePreview(o) {
  const generic = /次のとおりである。?$/.test(o.lead) && o.lead.length < 50;
  if (!generic && o.lead.length > 15) return o.lead;
  const heads = o.points.map((p) => p.heading).filter(Boolean);
  return heads.length ? heads.slice(0, 3).join('／') : o.lead;
}

/** @typedef {'new' | 'active' | 'done' | 'failed'} Tone */

/**
 * @typedef {object} SimpleStatus
 * @property {string} label friendly status, e.g. 「委員会で議論中」
 * @property {Tone} tone
 * @property {1 | 2 | 3} step position on the 提出 → 議論中 → 成立 bar
 */

/** The three milestones a beginner needs — not the 5 procedural stages. */
export const STEPS = ['提出', '議論中', '成立'];

/**
 * @param {Bill} b
 * @returns {SimpleStatus}
 */
export function simpleStatus(b) {
  if (b.finalState === '成立' || b.stage === '成立') {
    return { label: '成立済み', tone: 'done', step: 3 };
  }
  if (b.finalState === '廃案' || b.stage === '廃案') {
    return { label: '見送り・廃案', tone: 'failed', step: 3 };
  }
  switch (b.stage) {
    case '提出':
      return { label: '提出されたばかり', tone: 'new', step: 1 };
    case '委員会審議':
      return { label: '委員会で議論中', tone: 'active', step: 2 };
    case '本会議':
      return { label: '本会議で採決へ', tone: 'active', step: 2 };
    case '参議院':
      return { label: 'もう一方の議院で審議中', tone: 'active', step: 2 };
    default:
      return { label: '審議中', tone: 'active', step: 2 };
  }
}

/**
 * Friendly group key + heading + one-line description, ordered for the feed.
 * @typedef {object} FeedGroup
 * @property {Tone} key
 * @property {string} heading
 * @property {string} blurb
 */

/** @type {FeedGroup[]} */
export const FEED_GROUPS = [
  { key: 'active', heading: 'いま議論されている法案', blurb: '国会で審議が進んでいる法案です。' },
  { key: 'new', heading: '出されたばかりの法案', blurb: 'これから議論が始まる、提出されたばかりの法案。' },
  { key: 'done', heading: '成立した法律', blurb: '今国会で可決され、法律になったもの。' },
  { key: 'failed', heading: '見送り・廃案になった法案', blurb: '今国会では成立しなかった法案。' }
];
