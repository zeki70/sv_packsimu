import { describe, it, expect } from 'vitest';
import {
  NO_FILTER,
  filterAndSortPool,
  typeKeyOf,
  type CardInfoLookup,
  type PoolFilter,
} from './poolSort';
import type { PoolEntry } from '../domain/pool';
import { Rarity, NEUTRAL_CLASS_ID } from '../domain/types';

interface Spec {
  readonly cardId: number;
  readonly cost: number;
  readonly type?: number;
  readonly rarity?: Rarity;
  readonly classId?: number;
}

function entry({ cardId, rarity = Rarity.Bronze, classId = 1 }: Spec): PoolEntry {
  return {
    card: { cardId, setId: 10008, rarity, classId, deckEnabledNum: 3 },
    count: 1,
  };
}

function build(specs: readonly Spec[]): {
  entries: PoolEntry[];
  lookup: CardInfoLookup;
} {
  const info = new Map(specs.map((s) => [s.cardId, { cost: s.cost, type: s.type ?? 1 }]));
  return { entries: specs.map(entry), lookup: (cardId) => info.get(cardId) };
}

const ids = (entries: readonly PoolEntry[]) => entries.map((e) => e.card.cardId);

describe('typeKeyOf', () => {
  it('1=フォロワー, 2/3=アミュレット, 4=スペル', () => {
    expect(typeKeyOf(1)).toBe('follower');
    expect(typeKeyOf(2)).toBe('amulet');
    expect(typeKeyOf(3)).toBe('amulet');
    expect(typeKeyOf(4)).toBe('spell');
  });
});

describe('コスト順', () => {
  const { entries, lookup } = build([
    { cardId: 3, cost: 5 },
    { cardId: 1, cost: 1 },
    { cardId: 2, cost: 3 },
  ]);

  it('昇順', () => {
    const sort = { mode: 'cost', direction: 'asc' } as const;
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup, sort))).toEqual([1, 2, 3]);
  });

  it('降順', () => {
    const sort = { mode: 'cost', direction: 'desc' } as const;
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup, sort))).toEqual([3, 2, 1]);
  });

  it('既定はコスト昇順', () => {
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([1, 2, 3]);
  });

  it('同じコスト・同じクラス・同じタイプなら方向によらずカードID昇順', () => {
    const same = build([
      { cardId: 30, cost: 2 },
      { cardId: 10, cost: 2 },
      { cardId: 20, cost: 2 },
    ]);
    for (const direction of ['asc', 'desc'] as const) {
      const sort = { mode: 'cost', direction } as const;
      expect(ids(filterAndSortPool(same.entries, NO_FILTER, same.lookup, sort))).toEqual([
        10, 20, 30,
      ]);
    }
  });
});

describe('同コスト内の並び', () => {
  const FOLLOWER = 1;
  const AMULET = 2;
  const COUNTDOWN_AMULET = 3;
  const SPELL = 4;

  it('ニュートラルが先、そのあとにクラスのカードが並ぶ', () => {
    const { entries, lookup } = build([
      { cardId: 1, cost: 3, classId: 5, type: FOLLOWER },
      { cardId: 2, cost: 3, classId: NEUTRAL_CLASS_ID, type: FOLLOWER },
      { cardId: 3, cost: 3, classId: 5, type: FOLLOWER },
      { cardId: 4, cost: 3, classId: NEUTRAL_CLASS_ID, type: FOLLOWER },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([2, 4, 1, 3]);
  });

  it('各グループ内はフォロワー → スペル → アミュレットの順', () => {
    const { entries, lookup } = build([
      { cardId: 1, cost: 3, classId: 1, type: AMULET },
      { cardId: 2, cost: 3, classId: 1, type: SPELL },
      { cardId: 3, cost: 3, classId: 1, type: FOLLOWER },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([3, 2, 1]);
  });

  it('カウントダウンアミュレット(type 3)もアミュレットとして最後に並ぶ', () => {
    const { entries, lookup } = build([
      { cardId: 1, cost: 3, classId: 1, type: COUNTDOWN_AMULET },
      { cardId: 2, cost: 3, classId: 1, type: SPELL },
      { cardId: 3, cost: 3, classId: 1, type: FOLLOWER },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([3, 2, 1]);
  });

  it('ニュートラル → クラス → タイプ → ID の優先順位で並ぶ', () => {
    const { entries, lookup } = build([
      { cardId: 40, cost: 2, classId: 3, type: FOLLOWER },
      { cardId: 30, cost: 2, classId: 3, type: FOLLOWER },
      { cardId: 20, cost: 2, classId: 3, type: SPELL },
      { cardId: 12, cost: 2, classId: NEUTRAL_CLASS_ID, type: AMULET },
      { cardId: 11, cost: 2, classId: NEUTRAL_CLASS_ID, type: SPELL },
      { cardId: 10, cost: 2, classId: NEUTRAL_CLASS_ID, type: FOLLOWER },
    ]);
    // N: フォロワー10 → スペル11 → アミュレット12
    // クラス3: フォロワー30,40 → スペル20
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([10, 11, 12, 30, 40, 20]);
  });

  it('コストが違えばコストが優先される', () => {
    const { entries, lookup } = build([
      { cardId: 1, cost: 5, classId: NEUTRAL_CLASS_ID, type: FOLLOWER },
      { cardId: 2, cost: 1, classId: 7, type: AMULET },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([2, 1]);
  });

  it('複数クラスがある場合はクラスID昇順で並ぶ', () => {
    const { entries, lookup } = build([
      { cardId: 3, cost: 1, classId: 7, type: FOLLOWER },
      { cardId: 1, cost: 1, classId: 2, type: FOLLOWER },
      { cardId: 2, cost: 1, classId: 4, type: FOLLOWER },
      { cardId: 0, cost: 1, classId: NEUTRAL_CLASS_ID, type: FOLLOWER },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup))).toEqual([0, 1, 2, 3]);
  });

  it('レアリティ順のときも同コスト内は同じ規則で並ぶ', () => {
    const { entries, lookup } = build([
      { cardId: 1, cost: 3, classId: 1, type: AMULET, rarity: Rarity.Gold },
      { cardId: 2, cost: 3, classId: NEUTRAL_CLASS_ID, type: SPELL, rarity: Rarity.Gold },
      { cardId: 3, cost: 3, classId: 1, type: FOLLOWER, rarity: Rarity.Gold },
    ]);
    const sort = { mode: 'rarity', direction: 'desc' } as const;
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup, sort))).toEqual([2, 3, 1]);
  });
});

describe('レアリティ順', () => {
  const { entries, lookup } = build([
    { cardId: 1, cost: 1, rarity: Rarity.Bronze },
    { cardId: 2, cost: 1, rarity: Rarity.Legend },
    { cardId: 3, cost: 1, rarity: Rarity.Silver },
    { cardId: 4, cost: 1, rarity: Rarity.Gold },
  ]);

  it('降順はレジェンドが先頭', () => {
    const sort = { mode: 'rarity', direction: 'desc' } as const;
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup, sort))).toEqual([2, 4, 3, 1]);
  });

  it('昇順はブロンズが先頭', () => {
    const sort = { mode: 'rarity', direction: 'asc' } as const;
    expect(ids(filterAndSortPool(entries, NO_FILTER, lookup, sort))).toEqual([1, 3, 4, 2]);
  });

  it('同じレアリティの中は方向によらずコスト昇順', () => {
    const same = build([
      { cardId: 20, cost: 5, rarity: Rarity.Gold },
      { cardId: 10, cost: 2, rarity: Rarity.Gold },
      { cardId: 5, cost: 2, rarity: Rarity.Gold },
    ]);
    for (const direction of ['asc', 'desc'] as const) {
      const sort = { mode: 'rarity', direction } as const;
      expect(ids(filterAndSortPool(same.entries, NO_FILTER, same.lookup, sort))).toEqual([
        5, 10, 20,
      ]);
    }
  });
});

describe('絞り込み', () => {
  const { entries, lookup } = build([
    { cardId: 1, cost: 1, classId: 1, rarity: Rarity.Bronze, type: 1 },
    { cardId: 2, cost: 2, classId: 2, rarity: Rarity.Legend, type: 4 },
    { cardId: 3, cost: 3, classId: NEUTRAL_CLASS_ID, rarity: Rarity.Gold, type: 2 },
    { cardId: 4, cost: 4, classId: 1, rarity: Rarity.Legend, type: 3 },
    { cardId: 5, cost: 5, classId: 1, rarity: Rarity.Silver, type: 4 },
  ]);

  const withFilter = (patch: Partial<PoolFilter>) =>
    ids(filterAndSortPool(entries, { ...NO_FILTER, ...patch }, lookup));

  it('クラスで絞れる（ニュートラルは混ざらない）', () => {
    expect(withFilter({ classId: 1 })).toEqual([1, 4, 5]);
  });

  it('ニュートラルだけを選べる', () => {
    expect(withFilter({ classId: NEUTRAL_CLASS_ID })).toEqual([3]);
  });

  it('レアリティで絞れる', () => {
    expect(withFilter({ rarity: Rarity.Legend })).toEqual([2, 4]);
  });

  it('フォロワーで絞れる', () => {
    expect(withFilter({ type: 'follower' })).toEqual([1]);
  });

  it('アミュレットは type 2 と 3 の両方を拾う', () => {
    expect(withFilter({ type: 'amulet' })).toEqual([3, 4]);
  });

  it('スペルで絞れる', () => {
    expect(withFilter({ type: 'spell' })).toEqual([2, 5]);
  });

  it('クラス・レアリティ・タイプは同時に効く（AND）', () => {
    expect(withFilter({ classId: 1, rarity: Rarity.Legend, type: 'amulet' })).toEqual([4]);
  });

  it('該当なしなら空', () => {
    expect(withFilter({ rarity: Rarity.Silver, classId: 7 })).toEqual([]);
  });

  it('絞り込み後も並び順が保たれる', () => {
    const shuffled = build([
      { cardId: 9, cost: 7, classId: 1 },
      { cardId: 8, cost: 2, classId: 1 },
      { cardId: 7, cost: 2, classId: 2 },
      { cardId: 6, cost: 5, classId: 1 },
    ]);
    const result = filterAndSortPool(
      shuffled.entries,
      { ...NO_FILTER, classId: 1 },
      shuffled.lookup,
    );
    expect(ids(result)).toEqual([8, 6, 9]);
  });
});

describe('副作用', () => {
  it('元の配列を書き換えない', () => {
    const { entries, lookup } = build([
      { cardId: 2, cost: 9 },
      { cardId: 1, cost: 1 },
    ]);
    const before = ids(entries);
    filterAndSortPool(entries, NO_FILTER, lookup, { mode: 'rarity', direction: 'desc' });
    expect(ids(entries)).toEqual(before);
  });
});
