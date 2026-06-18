// Build the unified bills.json + meta.json the front end consumes.
//
//   HoR gian.csv  ─┐
//                  ├─► merge by (session, normalized title) ─► Bill[] ─► static/bills.json
//   HoC gian.csv  ─┘                                                  └─► static/meta.json
//
// HoR is the rich spine (審議状況, era dates, faction for/against). HoC enriches with
// the sangiin outline URL and numeric roll-call tallies. Summaries (if cached by
// summarize.js) are merged in from data/ai.json.

import './load-env.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { STAGES } from '../src/lib/types.js';
import { parseJpDate, daysSince } from './jpdate.js';
import { classify, allCategoryLabels } from './categories.js';
import { parseYoushi } from './youshi.js';
import { buildAiInput, aiHash, PROMPT_VERSION } from './aiinput.js';
import { splitFactions, primaryPartyKey, allPartyDefs } from '../src/lib/parties.js';

/** @typedef {import('../src/lib/types.js').Bill} Bill */
/** @typedef {import('../src/lib/types.js').Meta} Meta */
/** @typedef {import('../src/lib/types.js').Stage} Stage */
/** @typedef {import('../src/lib/types.js').TimelineEvent} TimelineEvent */
/** @typedef {import('../src/lib/types.js').VoteRecord} VoteRecord */
/** @typedef {import('../src/lib/types.js').BillAI} BillAI */
/** @typedef {Record<string, string>} Row */
/** @typedef {BillAI & { hash: string, argHash: string, v: number }} AiCacheEntry */

const ROOT = join(import.meta.dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const CONTENT_DIR = join(ROOT, 'data', 'content');
const STATIC_DIR = join(ROOT, 'static');
const AI_CACHE = join(ROOT, 'data', 'ai.json');

/**
 * @param {string} id
 * @returns {string | null}
 */
function readContent(id) {
  const contentPath = join(CONTENT_DIR, `${id}.txt`);
  if (!existsSync(contentPath)) return null;
  const content = readFileSync(contentPath, 'utf8').trim();
  return content.length ? content : null;
}

/**
 * Trust a cached AI explanation only if generated from the current input + prompt.
 * @param {string} input
 * @param {AiCacheEntry | undefined} entry
 * @returns {BillAI | null}
 */
function freshAi(input, entry) {
  if (!entry || entry.v !== PROMPT_VERSION || aiHash(input) !== entry.hash) return null;
  const { hash: _h, argHash: _a, v: _v, ...ai } = entry;
  return ai;
}

const HOR_URL =
  'https://raw.githubusercontent.com/smartnews-smri/house-of-representatives/master/data/gian.csv';
const HOC_URL =
  'https://raw.githubusercontent.com/smartnews-smri/house-of-councillors/master/data/gian.csv';

const SESSION = Number(process.env.SESSION ?? 0); // 0 → auto (latest)
const BILL_TYPES = new Set(['閣法', '衆法', '参法']); // 法律案 only for the MVP board

// SMRI refreshes once a day; reuse a same-day local cache to avoid re-downloading the
// ~11MB CSV on every local rebuild (and to be polite upstream). Set FRESH=1 to force.
const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * @param {string} url
 * @param {string} cacheName
 * @returns {Promise<Row[]>}
 */
async function fetchCsv(url, cacheName) {
  mkdirSync(RAW_DIR, { recursive: true });
  const cache = join(RAW_DIR, cacheName);
  let text;
  const cacheFresh =
    !process.env.FRESH &&
    existsSync(cache) &&
    Date.now() - statSync(cache).mtimeMs < MAX_CACHE_AGE_MS;
  if (cacheFresh) {
    text = readFileSync(cache, 'utf8');
  } else {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
      writeFileSync(cache, text);
    } catch (e) {
      if (existsSync(cache)) {
        console.warn(`! fetch ${url} failed (${e}); using cached ${cacheName}`);
        text = readFileSync(cache, 'utf8');
      } else {
        throw e;
      }
    }
  }
  return /** @type {{ data: Row[] }} */ (Papa.parse(text, { header: true, skipEmptyLines: true }))
    .data;
}

/**
 * @param {string} title
 * @returns {string}
 */
function norm(title) {
  return title.replace(/[\s　]+/g, '').replace(/[（(].*?[)）]/g, '');
}

/**
 * @param {Row[]} rows
 * @param {string} key
 * @returns {number}
 */
function latestSession(rows, key) {
  return rows.reduce((max, r) => Math.max(max, Number(r[key]) || 0), 0);
}

// --- HoC index: normalized title → row (for the chosen session) -------------
/**
 * @param {Row[]} rows
 * @param {number} session
 * @returns {Map<string, Row>}
 */
function indexHoC(rows, session) {
  /** @type {Map<string, Row>} */
  const idx = new Map();
  for (const r of rows) {
    if (Number(r['審議回次']) !== session) continue;
    idx.set(norm(r['件名'] ?? ''), r);
  }
  return idx;
}

// --- Stage derivation -------------------------------------------------------
const FAILED_STATUSES = /未了|撤回|否決|承諾なし|不承認|閉会中審査/;

/**
 * @param {Row} hor
 * @param {'衆' | '参'} origin
 * @returns {{ stage: Stage, finalState: '成立' | '廃案' | null }}
 */
function deriveStage(hor, origin) {
  const status = hor['審議状況'] ?? '';
  if (/成立|公布|可決成立/.test(status)) return { stage: '成立', finalState: '成立' };
  if (FAILED_STATUSES.test(status)) return { stage: '廃案', finalState: '廃案' };

  // In-progress: pick furthest reached milestone from populated date columns.
  /** @param {string} col */
  const has = (col) => !!parseJpDate(hor[col]);
  // Sangiin reached?
  if (
    has('参議院付託年月日／参議院付託委員会') ||
    has('参議院議案受理年月日') ||
    /参議院/.test(status)
  ) {
    return { stage: '参議院', finalState: null };
  }
  // First-house plenary?
  if (has('衆議院審査終了年月日／衆議院審査結果') || has('衆議院審議終了年月日／衆議院審議結果')) {
    return { stage: '本会議', finalState: null };
  }
  // Committee?
  if (has('衆議院付託年月日／衆議院付託委員会')) {
    return { stage: '委員会審議', finalState: null };
  }
  return { stage: '提出', finalState: null };
}

/**
 * @param {Row} hor
 * @param {Stage} stage
 * @returns {string | null | undefined}
 */
function stageEntryDate(hor, stage) {
  switch (stage) {
    case '提出':
      return parseJpDate(hor['衆議院議案受理年月日']) ?? parseJpDate(hor['衆議院予備審査議案受理年月日']);
    case '委員会審議':
      return parseJpDate(hor['衆議院付託年月日／衆議院付託委員会']);
    case '本会議':
      return (
        parseJpDate(hor['衆議院審査終了年月日／衆議院審査結果']) ??
        parseJpDate(hor['衆議院付託年月日／衆議院付託委員会'])
      );
    case '参議院':
      return (
        parseJpDate(hor['参議院付託年月日／参議院付託委員会']) ??
        parseJpDate(hor['参議院議案受理年月日'])
      );
    case '成立':
      return parseJpDate(hor['公布年月日／法律番号']) ?? parseJpDate(hor['参議院審議終了年月日／参議院審議結果']);
    case '廃案':
      return (
        parseJpDate(hor['参議院審議終了年月日／参議院審議結果']) ??
        parseJpDate(hor['衆議院審議終了年月日／衆議院審議結果']) ??
        parseJpDate(hor['衆議院付託年月日／衆議院付託委員会'])
      );
  }
}

// --- Timeline ---------------------------------------------------------------
/**
 * @param {Row} hor
 * @returns {TimelineEvent[]}
 */
function buildTimeline(hor) {
  /** @type {TimelineEvent[]} */
  const ev = [];
  /**
   * @param {string} col
   * @param {string} label
   * @param {'衆' | '参'} [house]
   * @param {boolean} [isCommittee] when the after-slash detail is a committee name
   */
  const push = (col, label, house, isCommittee = false) => {
    const raw = hor[col];
    const date = parseJpDate(raw);
    if (!date) return;
    let after = (raw ?? '').split('／')[1]?.trim();
    // Committee-assignment cells store the bare committee name ("厚生労働"); show the
    // full 「厚生労働委員会」. Skip names already ending in 会 (e.g. 憲法審査会).
    if (isCommittee && after && !/会$/.test(after)) after = `${after}委員会`;
    ev.push({ date, label, house, detail: after || undefined });
  };
  push('衆議院議案受理年月日', '衆議院 受理', '衆');
  push('衆議院付託年月日／衆議院付託委員会', '衆議院 委員会付託', '衆', true);
  push('衆議院審査終了年月日／衆議院審査結果', '衆議院 委員会審査終了', '衆');
  push('衆議院審議終了年月日／衆議院審議結果', '衆議院 本会議議決', '衆');
  push('参議院議案受理年月日', '参議院 受理', '参');
  push('参議院付託年月日／参議院付託委員会', '参議院 委員会付託', '参', true);
  push('参議院審査終了年月日／参議院審査結果', '参議院 委員会審査終了', '参');
  push('参議院審議終了年月日／参議院審議結果', '参議院 本会議議決', '参');
  push('公布年月日／法律番号', '公布', undefined);
  return ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// --- Votes ------------------------------------------------------------------
/**
 * @param {Row} hor
 * @param {Row | undefined} hoc
 * @returns {VoteRecord[]}
 */
function buildVotes(hor, hoc) {
  /** @type {VoteRecord[]} */
  const votes = [];
  const forF = splitFactions(hor['衆議院審議時賛成会派']);
  const againstF = splitFactions(hor['衆議院審議時反対会派']);
  if (forF.length || againstF.length || hor['衆議院審議時会派態度']) {
    votes.push({
      house: '衆',
      forParties: forF,
      againstParties: againstF,
      attitude: hor['衆議院審議時会派態度'] || undefined,
      result: (hor['衆議院審議終了年月日／衆議院審議結果'] ?? '').split('／')[1]?.trim() || undefined
    });
  }
  // HoC numeric roll-call (when present)
  if (hoc) {
    const tallyRaw = hoc['参議院本会議経過情報 - 投票結果'] ?? '';
    const m = tallyRaw.match(/賛成\s*(\d+).*?反対\s*(\d+)/s);
    const method = hoc['参議院本会議経過情報 - 採決方法'] || undefined;
    const result = hoc['参議院本会議経過情報 - 議決'] || undefined;
    if (m || method || result) {
      votes.push({
        house: '参',
        forParties: [],
        againstParties: [],
        method,
        result,
        tally: m ? { for: Number(m[1]), against: Number(m[2]) } : undefined
      });
    }
  }
  return votes;
}

async function main() {
  console.log('Fetching SMRI datasets…');
  const [horAll, hocAll] = await Promise.all([
    fetchCsv(HOR_URL, 'hor.csv'),
    fetchCsv(HOC_URL, 'hoc.csv')
  ]);

  const session = SESSION || latestSession(horAll, '掲載回次');
  console.log(`Session: ${session}`);

  const hocIdx = indexHoC(hocAll, session);
  /** @type {Record<string, AiCacheEntry>} */
  const aiCache = existsSync(AI_CACHE) ? JSON.parse(readFileSync(AI_CACHE, 'utf8')) : {};

  /** @type {Bill[]} */
  const bills = [];
  for (const r of horAll) {
    if (Number(r['掲載回次']) !== session) continue;
    const billType = r['議案種類'] ?? '';
    if (!BILL_TYPES.has(billType)) continue;

    const title = (r['議案件名'] ?? '').trim();
    const number = Number(r['番号']) || 0;
    /** @type {'衆' | '参'} */
    const origin = billType === '参法' ? '参' : '衆';
    const hoc = hocIdx.get(norm(title));

    const { stage, finalState } = deriveStage(r, origin);
    const stageEnteredDate = stageEntryDate(r, stage) ?? null;
    const submitterParties = splitFactions(r['議案提出会派']);

    const id = `${session}-${billType}-${number}`;
    const outline = parseYoushi(readContent(id));
    const submitter = (r['議案提出者'] ?? '').replace(/[\s　]+/g, '') || '内閣';
    const aiInput = buildAiInput({ title, billType, submitter, outline });
    bills.push({
      id,
      session,
      number,
      title,
      billType,
      submitter,
      submitterParty: r['議案提出者']?.includes('内閣')
        ? 'cabinet'
        : primaryPartyKey(submitterParties),
      submitterParties,
      category: classify(title),
      status: r['審議状況'] ?? '',
      stage,
      finalState,
      stageEnteredDate,
      daysInStage: daysSince(stageEnteredDate),
      heat: 'normal', // filled in after thresholds are known
      timeline: buildTimeline(r),
      votes: buildVotes(r, hoc),
      outline,
      ai: freshAi(aiInput, aiCache[id]),
      links: {
        progress: r['経過情報URL'] || undefined,
        fullText: r['本文情報URL'] || undefined,
        detail: hoc?.['議案URL'] || undefined,
        outlinePdf: hoc?.['議案要旨'] || undefined
      }
    });
  }

  // --- Heat: per-stage median of daysInStage among active bills -------------
  const thresholds = computeHeatThresholds(bills);
  for (const b of bills) {
    b.heat = heatFor(b, thresholds);
  }

  bills.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || a.number - b.number);

  /** @type {Meta} */
  const meta = {
    session,
    sessionType: sessionTypeFor(session),
    updatedAt: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    billCount: bills.length,
    categories: allCategoryLabels(),
    parties: allPartyDefs().map((p) => ({ key: p.key, label: p.label, color: p.color })),
    heatThresholds: thresholds
  };

  mkdirSync(STATIC_DIR, { recursive: true });
  writeFileSync(join(STATIC_DIR, 'bills.json'), JSON.stringify(bills));
  writeFileSync(join(STATIC_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  const withAi = bills.filter((b) => b.ai).length;
  console.log(`Wrote ${bills.length} bills (${withAi} with AI explanations) → static/bills.json`);
}

// Diet session classifications (常会/臨時会/特別会). Known recent sessions are
// listed explicitly; ordinary sessions (convened each January) are the default.
/** @type {Record<number, string>} */
const SESSION_TYPES = {
  217: '常会',
  218: '臨時会',
  219: '特別会',
  220: '臨時会',
  221: '常会'
};
/**
 * @param {number} session
 * @returns {string}
 */
function sessionTypeFor(session) {
  return SESSION_TYPES[session] ?? '常会';
}

/**
 * @param {number[]} xs
 * @returns {number}
 */
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * @param {Bill[]} bills
 * @returns {Record<string, { warm: number, hot: number }>}
 */
function computeHeatThresholds(bills) {
  /** @type {Record<string, { warm: number, hot: number }>} */
  const out = {};
  for (const stage of STAGES) {
    const active = bills.filter(
      (b) => b.stage === stage && b.finalState === null && b.daysInStage != null
    );
    const med = median(active.map((b) => /** @type {number} */ (b.daysInStage)));
    const base = Math.max(med, 7); // avoid hyper-sensitive heat on tiny medians
    out[stage] = { warm: Math.round(base * 1.5), hot: Math.round(base * 3) };
  }
  return out;
}

/**
 * @param {Bill} b
 * @param {Record<string, { warm: number, hot: number }>} t
 * @returns {'normal' | 'warm' | 'hot'}
 */
function heatFor(b, t) {
  if (b.finalState || b.daysInStage == null) return 'normal';
  const th = t[b.stage];
  if (b.daysInStage >= th.hot) return 'hot';
  if (b.daysInStage >= th.warm) return 'warm';
  return 'normal';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
