// Fetch real Diet deliberation speeches for each bill from the National Diet Library
// 国会会議録 API (kokkai.ndl.go.jp) so the for/against section can be grounded in what
// lawmakers actually said — never invented by the model. We search the bill title within
// the bill's session, keep the speeches that actually argue for/against (討論 above all),
// and cache a small, ranked selection per bill in data/deliberation/{id}.json. Bills with
// no usable record get an empty selection written so we don't refetch forever.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {import('../src/lib/types.js').Bill} Bill */
/** @typedef {{ speaker: string, party: string, house: '衆' | '参', date: string, meeting: string, text: string }} Speech */
/** @typedef {{ fetched: string, total: number, speeches: Speech[] }} Deliberation */

const ROOT = join(import.meta.dirname, '..');
const DELIB_DIR = join(ROOT, 'data', 'deliberation');
const BILLS = join(ROOT, 'static', 'bills.json');

const API = 'https://kokkai.ndl.go.jp/api/speech';
const DELAY_MS = 800; // polite crawl
const MAX_SPEECHES = 8; // keep the prompt focused
const MAX_SPEECH_CHARS = 1200; // bound any single speech
const MAX_TOTAL_CHARS = 6000; // bound total token cost

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string | null | undefined} house @returns {'衆' | '参'} */
const houseCode = (house) => (house === '参議院' ? '参' : '衆');

// Strip the leading "○speaker　" marker the API prepends to each speech body.
/** @param {string} s */
const cleanSpeech = (s) => s.replace(/^○[^\s　]+[\s　]*/, '').replace(/\s+/g, ' ').trim();

/**
 * Score a speech by how clearly it argues for/against the bill. 討論 (the formal
 * for/against statements made just before a vote) is the gold source; substantive
 * speeches that weigh the bill come next. Procedural chair/clerk lines score 0.
 * @param {string} text
 * @returns {number}
 */
function score(text) {
  let s = 0;
  const hasStance = /賛成|反対/.test(text);
  if (/討論/.test(text) && hasStance) s += 10;
  if (/(賛成|反対)(の|いた|し)/.test(text)) s += 5;
  if (hasStance && text.length > 200) s += 3;
  if (/懸念|問題|指摘|評価|危惧|是非|デメリット|メリット|慎重/.test(text)) s += 3;
  // Procedural noise: chairs announcing agenda / roll-call, with no real argument.
  if (text.length < 150) s -= 10;
  if (/^(次に|これより|本案|ただいま議題|起立|採決|散会|休憩)/.test(text) && !hasStance) s -= 5;
  return s;
}

/**
 * Query the NDL speech API for one bill and return a ranked, bounded selection.
 * @param {Bill} bill
 * @returns {Promise<Deliberation>}
 */
async function deliberationFor(bill) {
  const empty = { fetched: new Date().toISOString(), total: 0, speeches: [] };
  const params = new URLSearchParams({
    any: bill.title,
    sessionFrom: String(bill.session),
    sessionTo: String(bill.session),
    maximumRecords: '100',
    recordPacking: 'json'
  });
  let json;
  try {
    const res = await fetch(`${API}?${params}`, {
      headers: { 'User-Agent': 'kokkai-visu/0.1 (research)' }
    });
    if (!res.ok) return empty;
    json = await res.json();
  } catch {
    return empty;
  }

  const records = json?.speechRecord ?? [];
  const total = Number(json?.numberOfRecords ?? records.length);

  const scored = records
    // 議院運営委員会 is scheduling/procedure, never substantive debate on the bill.
    .filter((/** @type {any} */ r) => !String(r?.nameOfMeeting ?? '').includes('議院運営委員会'))
    .map((/** @type {any} */ r) => {
      const text = cleanSpeech(String(r?.speech ?? ''));
      return {
        score: score(text),
        speech: {
          speaker: String(r?.speaker ?? '').trim(),
          party: String(r?.speakerGroup ?? '').trim(),
          house: houseCode(r?.nameOfHouse),
          date: String(r?.date ?? '').trim(),
          meeting: String(r?.nameOfMeeting ?? '').trim(),
          text: text.slice(0, MAX_SPEECH_CHARS)
        }
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  /** @type {Speech[]} */
  const speeches = [];
  let chars = 0;
  for (const { speech } of scored) {
    if (speeches.length >= MAX_SPEECHES || chars + speech.text.length > MAX_TOTAL_CHARS) break;
    speeches.push(speech);
    chars += speech.text.length;
  }
  return { fetched: new Date().toISOString(), total, speeches };
}

async function main() {
  /** @type {Bill[]} */
  const bills = JSON.parse(readFileSync(BILLS, 'utf8'));
  mkdirSync(DELIB_DIR, { recursive: true });

  let fetched = 0;
  let withSpeech = 0;
  let cached = 0;
  for (const bill of bills) {
    const path = join(DELIB_DIR, `${bill.id}.json`);
    if (existsSync(path)) {
      cached++;
      continue;
    }
    const delib = await deliberationFor(bill);
    writeFileSync(path, JSON.stringify(delib, null, 2)); // empty selection is a valid marker
    fetched++;
    if (delib.speeches.length) {
      withSpeech++;
      console.log(
        `✓ ${bill.id}  ${bill.title.slice(0, 24)}…  ${delib.speeches.length} speeches (${delib.total} matched)`
      );
    } else {
      console.log(`· ${bill.id}  no usable deliberation (${delib.total} matched)`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done. ${fetched} fetched (${withSpeech} with speeches), ${cached} already cached.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
