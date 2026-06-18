// The source material we feed the LLM for a bill, and which we hash to decide whether a
// cached AI explanation is still fresh. Shared by summarize.js (generation) and
// build-data.js (cache verification) so both compute the identical hash.
//
// Two inputs:
//   buildAiInput  — the official 議案要旨 (outline). Drives pass 1 (概要 / なぜ重要か /
//                   変わること). Always present.
//   buildArgInput — real Diet deliberation speeches + recorded votes. Drives pass 2
//                   (賛成・反対の論点). Returns null when there is no real material, which
//                   is the gate that keeps the model from inventing arguments.
import { createHash } from 'node:crypto';

/** @typedef {import('../src/lib/types.js').Bill} Bill */
/** @typedef {import('../src/lib/types.js').VoteRecord} VoteRecord */
/** @typedef {{ speaker: string, party: string, house: '衆' | '参', date: string, meeting: string, text: string }} Speech */
/** @typedef {{ fetched: string, total: number, speeches: Speech[] }} Deliberation */

// Bump to force regeneration when the prompt/output format changes. build-data and
// summarize both read this so cached entries from an older prompt are dropped.
export const PROMPT_VERSION = 8;

/**
 * @param {Pick<Bill, 'title' | 'billType' | 'submitter' | 'outline'>} bill
 * @returns {string}
 */
export function buildAiInput(bill) {
  const parts = [`法案名: ${bill.title}`, `種類: ${bill.billType}`, `提出者: ${bill.submitter}`];
  if (bill.outline) {
    parts.push(`\n【議案要旨】\n${bill.outline.lead}`);
    for (const p of bill.outline.points) {
      parts.push(`■ ${p.heading}${p.body ? `\n${p.body}` : ''}`);
    }
    if (bill.outline.enforcement) parts.push(`施行: ${bill.outline.enforcement}`);
  } else {
    parts.push('（公式の議案要旨は未公表。検索で補ってください）');
  }
  return parts.join('\n');
}

/**
 * Format the recorded party votes (factual) into lines, or null if none.
 * @param {VoteRecord[]} votes
 * @returns {string | null}
 */
function voteLines(votes) {
  const lines = [];
  for (const v of votes ?? []) {
    if (!v.forParties.length && !v.againstParties.length) continue;
    const parts = [];
    if (v.forParties.length) parts.push(`賛成会派 = ${v.forParties.join('、')}`);
    if (v.againstParties.length) parts.push(`反対会派 = ${v.againstParties.join('、')}`);
    lines.push(`${v.house}議院: ${parts.join(' / ')}`);
  }
  return lines.length ? lines.join('\n') : null;
}

/**
 * Build the pass-2 (arguments) source block from real deliberation speeches and recorded
 * votes. Returns null when neither exists — the evidence gate. The model is told to use
 * ONLY this material, so when it is null pass 2 is skipped entirely.
 * @param {Pick<Bill, 'title' | 'votes'>} bill
 * @param {Deliberation | null} deliberation
 * @returns {string | null}
 */
export function buildArgInput(bill, deliberation) {
  const speeches = deliberation?.speeches ?? [];
  const votes = voteLines(bill.votes);
  if (!speeches.length && !votes) return null;

  const parts = [`法案名: ${bill.title}`];
  if (speeches.length) {
    parts.push(
      '\n【国会会議録での発言（賛否の論点の根拠。ここに書かれた発言だけを使うこと）】'
    );
    for (const s of speeches) {
      const head = `〈${s.house} / ${s.date} / ${s.meeting}〉 ${s.speaker}（${s.party}）`;
      parts.push(`${head}\n${s.text}\n---`);
    }
  }
  if (votes) {
    parts.push('\n【採決での各会派の賛否（事実）】');
    parts.push(votes);
  }
  return parts.join('\n');
}

/**
 * @param {string} input
 * @returns {string}
 */
export const aiHash = (input) => createHash('sha256').update(input).digest('hex').slice(0, 16);

/**
 * Separate hash for the pass-2 (arguments) source, so the for/against section regenerates
 * when new deliberation records or votes appear without re-running pass 1.
 * @param {string | null} input
 * @returns {string}
 */
export const argHash = (input) => (input === null ? 'none' : aiHash(input));
