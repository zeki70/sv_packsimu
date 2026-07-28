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

  it('同じコストの中では方向によらずカードID昇順', () => {
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
