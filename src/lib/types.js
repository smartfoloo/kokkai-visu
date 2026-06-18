// Shared shapes for the Diet board, as JSDoc typedefs (no runtime type exports).

/** @type {readonly ['提出', '委員会審議', '本会議', '参議院', '成立', '廃案']} */
export const STAGES = ['提出', '委員会審議', '本会議', '参議院', '成立', '廃案'];

/**
 * Columns rendered on the board (成立 and 廃案 share the final column).
 * @type {{ id: Stage, label: string, sub?: string }[]}
 */
export const COLUMNS = [
  { id: '提出', label: '提出', sub: 'Submitted' },
  { id: '委員会審議', label: '委員会審議', sub: 'In committee' },
  { id: '本会議', label: '本会議', sub: 'Plenary' },
  { id: '参議院', label: '参議院', sub: 'Other house' },
  { id: '成立', label: '成立・廃案', sub: 'Enacted / Failed' }
];

/** @typedef {(typeof STAGES)[number]} Stage */
/** @typedef {'normal' | 'warm' | 'hot'} Heat */

/**
 * @typedef {object} VoteRecord
 * @property {'衆' | '参'} house
 * @property {string[]} forParties Faction-level breakdown when available (HoR data).
 * @property {string[]} againstParties
 * @property {string} [attitude] 会派態度: 全会一致 / 多数 など
 * @property {string} [result] 可決 / 否決 / 修正 など
 * @property {{ for: number, against: number }} [tally] Numeric tally (HoC roll-call).
 * @property {string} [method] 採決方法
 */

/**
 * @typedef {object} TimelineEvent
 * @property {string | null} date ISO yyyy-mm-dd
 * @property {string} label
 * @property {'衆' | '参'} [house]
 * @property {string} [detail] committee name, result, law number, etc.
 */

/**
 * The official 議案要旨 (bill outline), parsed into structure.
 * @typedef {object} Outline
 * @property {string} lead
 * @property {{ heading: string, body: string }[]} points
 * @property {string} [enforcement]
 */

/**
 * A single argument point, drawn from a real Diet deliberation record or vote.
 * @typedef {object} ArgPoint
 * @property {string} point the for/against point, as actually stated in the records
 * @property {string} [party] 会派 (faction) the point is attributed to
 * @property {'衆' | '参'} [house]
 */

/**
 * A before/after change pair derived from the official outline.
 * @typedef {object} BeforeAfter
 * @property {string} before 現状 (current state)
 * @property {string} after 改正後 (after the bill)
 */

/**
 * LLM-generated beginner-friendly explanation (みらい議会 style). Sections 1–3 are
 * generated from the official outline; `arguments` is evidence-gated — non-null only
 * when real NDL deliberation speeches and/or recorded votes back it.
 * @typedef {object} BillAI
 * @property {string} plainTitle easy-to-understand title rewrite
 * @property {string} oneLiner one-sentence summary
 * @property {string[]} description what the bill does, 3–10 bullets
 * @property {string} whyItMatters why it matters (short paragraph)
 * @property {BeforeAfter[]} beforeAfter before/after pairs ([] if not derivable)
 * @property {{ for: ArgPoint[], against: ArgPoint[] } | null} arguments for/against points, gated on real sources
 * @property {{ title: string, url: string }[]} sources grounding references
 */

/**
 * @typedef {object} Bill
 * @property {string} id
 * @property {number} session
 * @property {number} number
 * @property {string} title
 * @property {string} billType 閣法 / 衆法 / 参法
 * @property {string} submitter 内閣 or proposer name
 * @property {string | null} submitterParty canonical faction key for coloring
 * @property {string[]} submitterParties raw faction list
 * @property {string} category derived policy category
 * @property {string} status 審議状況 (raw)
 * @property {Stage} stage
 * @property {'成立' | '廃案' | null} finalState for the merged final column
 * @property {string | null} stageEnteredDate
 * @property {number | null} daysInStage
 * @property {Heat} heat
 * @property {TimelineEvent[]} timeline
 * @property {VoteRecord[]} votes
 * @property {Outline | null} outline official 議案要旨, structured (LLM input + fallback)
 * @property {BillAI | null} ai beginner-friendly grounded explanation
 * @property {{ progress?: string, fullText?: string, detail?: string, outlinePdf?: string }} links
 */

/**
 * @typedef {object} Meta
 * @property {number} session
 * @property {string} sessionType 常会 / 臨時会 / 特別会
 * @property {string} updatedAt
 * @property {string} generatedAt
 * @property {number} billCount
 * @property {string[]} categories
 * @property {{ key: string, label: string, color: string }[]} parties
 * @property {Record<Stage, { warm: number, hot: number }>} heatThresholds
 */

export {};
