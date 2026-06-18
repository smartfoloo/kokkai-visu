// Parse the Gemini Markdown contracts into structure. Grounding (googleSearch) can't be
// combined with enforced JSON output, so we ask for simple Markdown and parse it ourselves.
//
// Pass 1 (parseExplainer) — outline-based:
//   TITLE: <plain-language title>
//   SUMMARY: <one or two sentences>
//   ## 概要
//   - bullet (3–10)
//   ## なぜ重要か
//   <paragraph>
//   ## 変わること
//   - 現状: <before> → 改正後: <after>
//
// Pass 2 (parseArguments) — deliberation-based:
//   ## 賛成の論点
//   - <point>（会派）
//   ## 反対の論点
//   - <point>（会派）

/**
 * @typedef {object} AiSection
 * @property {string} heading
 * @property {string} body
 * @property {string[]} bullets
 */

// The model sometimes emits arrows as LaTeX ($\rightarrow$), ASCII (->), or other unicode
// (⇒). Normalise them all to a literal "→" so the UI never shows raw markup.
/**
 * @param {string} s
 * @returns {string}
 */
function normalizeArrows(s) {
  return s
    .replace(/\$([^$]*?)\\?(?:rightarrow|longrightarrow|Rightarrow|to)([^$]*?)\$/g, '$1→$2')
    .replace(/\\(?:rightarrow|longrightarrow|Rightarrow|to)\b/g, '→')
    .replace(/[⇒⟶➡]/g, '→')
    .replace(/\s*(?:->|=>|―>|—>)\s*/g, ' → ');
}

/**
 * @param {string} s
 * @returns {string}
 */
function clean(s) {
  // Strip leading markdown markers/space, but KEEP **bold** so the UI can render it.
  return normalizeArrows(s.replace(/^[#\s>]+/, '')).trim();
}

// The plain title should never carry bold markers.
/**
 * @param {string} s
 * @returns {string}
 */
const stripBold = (s) => s.replace(/\*\*/g, '').trim();

/**
 * Generic heading/bullet/body parser shared by both passes.
 * @param {string} text
 * @returns {{ plainTitle: string, oneLiner: string, sections: AiSection[] } | null}
 */
function parseSections(text) {
  if (!text) return null;
  const lines = text.replace(/\r/g, '').split('\n');

  let plainTitle = '';
  let oneLiner = '';
  /** @type {AiSection[]} */
  const sections = [];
  /** @type {AiSection | null} */
  let cur = null;

  const flush = () => {
    if (cur) {
      cur.body = cur.body.trim();
      sections.push(cur);
      cur = null;
    }
  };

  for (const raw of lines) {
    const t = raw.trimEnd().trim();
    if (!t) {
      if (cur && cur.body) cur.body += '\n';
      continue;
    }

    const mTitle = t.match(/^TITLE\s*[:：]\s*(.+)$/i);
    if (mTitle) {
      plainTitle = stripBold(clean(mTitle[1]));
      continue;
    }
    const mSummary = t.match(/^SUMMARY\s*[:：]\s*(.+)$/i);
    if (mSummary) {
      oneLiner = stripBold(clean(mSummary[1]));
      continue;
    }
    // Section heading: "## ..." (also tolerate "■"/"●" leaders).
    const mHead = t.match(/^(?:#{2,4}\s+|[■●▶]\s*)(.+)$/);
    if (mHead) {
      flush();
      cur = { heading: stripBold(clean(mHead[1])), body: '', bullets: [] };
      continue;
    }
    // Bullet
    const mBullet = t.match(/^[-*・]\s+(.+)$/);
    if (mBullet && cur) {
      cur.bullets.push(clean(mBullet[1]));
      continue;
    }
    // Body line
    if (cur) {
      cur.body += clean(t) + '\n';
    } else if (!plainTitle && !oneLiner) {
      oneLiner = clean(t);
    }
  }
  flush();

  for (const s of sections) s.body = s.body.replace(/\n{2,}/g, '\n').trim();
  if (!plainTitle && !oneLiner && sections.length === 0) return null;
  return { plainTitle, oneLiner, sections };
}

/**
 * Split a "現状: A → 改正後: B" bullet into a before/after pair. Returns null when no
 * arrow is present, so we only keep genuine, structured changes.
 * @param {string} bullet
 * @returns {{ before: string, after: string } | null}
 */
function toBeforeAfter(bullet) {
  const i = bullet.indexOf('→');
  if (i < 0) return null;
  // Keep **bold** (the UI renders it); only drop the 現状/改正後 label prefix.
  const strip = (/** @type {string} */ s) =>
    s.trim().replace(/^(?:現状|現行|従来|これまで|改正後|改正前|今後|変更後|新)\s*[:：]?\s*/, '').trim();
  const before = strip(bullet.slice(0, i));
  const after = strip(bullet.slice(i + 1));
  if (!before || !after) return null;
  return { before, after };
}

/**
 * Parse the pass-1 (explainer) contract into fixed fields.
 * @param {string} text
 * @returns {{ plainTitle: string, oneLiner: string, description: string[], whyItMatters: string, beforeAfter: { before: string, after: string }[] } | null}
 */
export function parseExplainer(text) {
  const p = parseSections(text);
  if (!p) return null;

  /** @type {string[]} */
  let description = [];
  let whyItMatters = '';
  /** @type {{ before: string, after: string }[]} */
  let beforeAfter = [];

  for (const s of p.sections) {
    const h = s.heading;
    if (/概要|何をする|ポイント|内容|要点/.test(h) && !description.length) {
      description = s.bullets.length ? s.bullets : s.body ? [s.body] : [];
    } else if (/なぜ|重要|意義|影響|背景/.test(h) && !whyItMatters) {
      whyItMatters = [s.body, ...s.bullets].filter(Boolean).join(' ').trim();
    } else if (/変わ|前後|改正|現状|変更|ビフォー|before/i.test(h) && !beforeAfter.length) {
      beforeAfter = s.bullets.map(toBeforeAfter).filter(Boolean);
    }
  }

  // Fallbacks if the model drifted from the exact headings.
  if (!description.length) {
    const firstWithBullets = p.sections.find((s) => s.bullets.length);
    if (firstWithBullets) description = firstWithBullets.bullets;
  }

  if (!p.plainTitle && !p.oneLiner && !description.length) return null;
  return { plainTitle: p.plainTitle, oneLiner: p.oneLiner, description, whyItMatters, beforeAfter };
}

/**
 * Pull a "（会派, 衆）" attribution off the end of an argument bullet.
 * @param {string} bullet
 * @returns {{ point: string, party?: string, house?: '衆' | '参' }}
 */
function toArgPoint(bullet) {
  const m = bullet.match(/[（(]([^（）()]*)[）)]\s*$/);
  const point = stripBold((m ? bullet.slice(0, m.index) : bullet).trim());
  /** @type {{ point: string, party?: string, house?: '衆' | '参' }} */
  const out = { point };
  if (m) {
    const attr = m[1];
    if (/衆/.test(attr)) out.house = '衆';
    else if (/参/.test(attr)) out.house = '参';
    const party = attr.split(/[、,・\/／\s]/)[0]?.trim();
    if (party && party !== '衆' && party !== '参' && party !== '衆議院' && party !== '参議院')
      out.party = party;
  }
  return out;
}

/**
 * Parse the pass-2 (arguments) contract. Returns null when no for/against points are
 * present, so the section is omitted rather than shown empty.
 * @param {string} text
 * @returns {{ for: { point: string, party?: string, house?: '衆' | '参' }[], against: { point: string, party?: string, house?: '衆' | '参' }[] } | null}
 */
export function parseArguments(text) {
  const p = parseSections(text);
  if (!p) return null;

  /** @type {ReturnType<typeof toArgPoint>[]} */
  let forPoints = [];
  /** @type {ReturnType<typeof toArgPoint>[]} */
  let againstPoints = [];

  for (const s of p.sections) {
    // 反対 first: "反対" matches but "賛成" must not match an 反対 heading.
    if (/反対|デメリット|懸念|問題点|against/i.test(s.heading) && !againstPoints.length) {
      againstPoints = s.bullets.map(toArgPoint).filter((x) => x.point);
    } else if (/賛成|メリット|利点|評価|for/i.test(s.heading) && !forPoints.length) {
      forPoints = s.bullets.map(toArgPoint).filter((x) => x.point);
    }
  }

  // A "for vs against" framing is only fair when both sides are represented; showing one
  // side alone would misrepresent the debate, so omit the section unless both have points.
  if (!forPoints.length || !againstPoints.length) return null;
  return { for: forPoints, against: againstPoints };
}
