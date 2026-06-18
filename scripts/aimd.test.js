import { describe, it, expect } from 'vitest';
import { parseExplainer, parseArguments } from './aimd.js';

// Pass-1 (explainer) output.
const SAMPLE = `TITLE: 防災の司令塔となる「防災庁」をつくるために関係する法律をまとめて変える法案
SUMMARY: 災害対応の司令塔となる「防災庁」を新設するため、関係する複数の法律をまとめて改正します。

## 概要
- 防災の司令塔となる「防災庁」を新たに設ける
- 各省庁に分かれていた防災の仕事を一つにまとめる
- 予算や人員の根拠規定を整える

## なぜ重要か
大きな災害が増えるなか、対応の指揮系統がばらばらだと初動が遅れます。司令塔を一本化することで、いざというときの判断を速くします。

## 変わること
- 現状: 各省庁が個別に防災を担当 → 改正後: **防災庁**が一括して指揮`;

describe('parseExplainer', () => {
  it('extracts title, oneLiner, description, whyItMatters, beforeAfter', () => {
    const a = parseExplainer(SAMPLE);
    expect(a).not.toBeNull();
    expect(a.plainTitle).toContain('防災庁');
    expect(a.oneLiner).toContain('司令塔');
    expect(a.description).toHaveLength(3);
    expect(a.description[0]).toContain('防災庁');
    expect(a.whyItMatters).toContain('指揮系統');
    expect(a.beforeAfter).toHaveLength(1);
    expect(a.beforeAfter[0].before).toContain('各省庁');
    expect(a.beforeAfter[0].after).toBe('**防災庁**が一括して指揮');
  });

  it('strips ** from title but keeps **bold**, handles fullwidth colons', () => {
    const a = parseExplainer('TITLE：**やさしい題**\nSUMMARY：要点です。\n## 概要\n- **重要**な点。');
    expect(a.plainTitle).toBe('やさしい題');
    expect(a.oneLiner).toBe('要点です。');
    expect(a.description[0]).toContain('**重要**');
  });

  it('normalises LaTeX/ASCII arrows to a literal → in before/after', () => {
    const a = parseExplainer(
      'TITLE: x\n## 変わること\n- 1クラス40人 $\\rightarrow$ **35人**'
    );
    expect(a.beforeAfter[0].before).toBe('1クラス40人');
    expect(a.beforeAfter[0].after).toBe('**35人**');
  });

  it('returns null on empty', () => {
    expect(parseExplainer('')).toBeNull();
  });
});

describe('parseArguments', () => {
  it('parses for/against points with party and house attribution', () => {
    const a = parseArguments(
      '## 賛成の論点\n- 災害対応が速くなる（自由民主党, 衆）\n## 反対の論点\n- 権限の集中が過度だ（立憲民主党）'
    );
    expect(a).not.toBeNull();
    expect(a.for).toHaveLength(1);
    expect(a.for[0].point).toContain('災害対応');
    expect(a.for[0].party).toBe('自由民主党');
    expect(a.for[0].house).toBe('衆');
    expect(a.against[0].party).toBe('立憲民主党');
    expect(a.against[0].house).toBeUndefined();
  });

  it('returns null when a side is missing (one-sided is not a fair for/against)', () => {
    expect(parseArguments('## 賛成の論点\n- 良い点（自民）\n## 反対の論点')).toBeNull();
    expect(parseArguments('## 反対の論点\n- 懸念がある（立憲）')).toBeNull();
    expect(parseArguments('## 賛成の論点\n## 反対の論点')).toBeNull();
    expect(parseArguments('')).toBeNull();
  });
});
