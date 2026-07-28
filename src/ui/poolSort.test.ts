import { describe, it, expect } from 'vitest';
import { filterAndSortPool, type PoolFilter } from './poolSort';
import type { PoolEntry } from '../domain/pool';
import { Rarity, NEUTRAL_CLASS_ID } from '../domain/types';

interface Spec {
  readonly cardId: number;
  readonly cost: number;
  readonly rarity?: Rarity;
  readonly classId?: number;
}

function entry({ cardId, rarity = Rarity.Bronze, classId = 1 }: Spec): PoolEntry {
  return {
    card: { cardId, setId: 10008, rarity, classId, deckEnabledNum: 3 },
    count: 1,
  };
}

const NO_FILTER: PoolFilter = { rarity: null, classId: null };

function build(specs: readonly Spec[]) {
  const costs = new Map(specs.map((s) => [s.cardId, s.cost]));
  return {
    entries: specs.map(entry),
    getCost: (cardId: number) => costs.get(cardId) ?? 0,
  };
}

const ids = (entries: readonly PoolEntry[]) => entries.map((e) => e.card.cardId);

describe('filterAndSortPool — コスト順', () => {
  it('コストの昇順で並ぶ', () => {
    const { entries, getCost } = build([
      { cardId: 3, cost: 5 },
      { cardId: 1, cost: 1 },
      { cardId: 2, cost: 3 },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, getCost, 'cost'))).toEqual([1, 2, 3]);
  });

  it('同じコストの中ではカードID順', () => {
    const { entries, getCost } = build([
      { cardId: 30, cost: 2 },
      { cardId: 10, cost: 2 },
      { cardId: 20, cost: 2 },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, getCost, 'cost'))).toEqual([10, 20, 30]);
  });

  it('コストが優先され、レアリティは並び順に影響しない', () => {
    const { entries, getCost } = build([
      { cardId: 1, cost: 8, rarity: Rarity.Legend },
      { cardId: 2, cost: 0, rarity: Rarity.Bronze },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, getCost, 'cost'))).toEqual([2, 1]);
  });

  it('既定はコスト順', () => {
    const { entries, getCost } = build([
      { cardId: 1, cost: 9, rarity: Rarity.Legend },
      { cardId: 2, cost: 1, rarity: Rarity.Bronze },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, getCost))).toEqual([2, 1]);
  });
});

describe('filterAndSortPool — レアリティ順', () => {
  it('レジェンド → ゴールド → シルバー → ブロンズ の順', () => {
    const { entries, getCost } = build([
      { cardId: 1, cost: 1, rarity: Rarity.Bronze },
      { cardId: 2, cost: 1, rarity: Rarity.Legend },
      { cardId: 3, cost: 1, rarity: Rarity.Silver },
      { cardId: 4, cost: 1, rarity: Rarity.Gold },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, getCost, 'rarity'))).toEqual([2, 4, 3, 1]);
  });

  it('同じレアリティの中はコスト順、さらにID順', () => {
    const { entries, getCost } = build([
      { cardId: 20, cost: 5, rarity: Rarity.Gold },
      { cardId: 10, cost: 2, rarity: Rarity.Gold },
      { cardId: 5, cost: 2, rarity: Rarity.Gold },
    ]);
    expect(ids(filterAndSortPool(entries, NO_FILTER, getCost, 'rarity'))).toEqual([5, 10, 20]);
  });
});

describe('filterAndSortPool — 絞り込み', () => {
  const { entries, getCost } = build([
    { cardId: 1, cost: 1, classId: 1, rarity: Rarity.Bronze },
    { cardId: 2, cost: 2, classId: 2, rarity: Rarity.Legend },
    { cardId: 3, cost: 3, classId: NEUTRAL_CLASS_ID, rarity: Rarity.Gold },
    { cardId: 4, cost: 4, classId: 1, rarity: Rarity.Legend },
  ]);

  it('クラス指定でそのクラスだけになる（ニュートラルは混ざらない）', () => {
    expect(ids(filterAndSortPool(entries, { rarity: null, classId: 1 }, getCost))).toEqual([1, 4]);
  });

  it('ニュートラルだけを選べる', () => {
    const filter = { rarity: null, classId: NEUTRAL_CLASS_ID };
    expect(ids(filterAndSortPool(entries, filter, getCost))).toEqual([3]);
  });

  it('レアリティ指定で絞れる', () => {
    const filter = { rarity: Rarity.Legend, classId: null };
    expect(ids(filterAndSortPool(entries, filter, getCost))).toEqual([2, 4]);
  });

  it('クラスとレアリティは同時に効く（AND）', () => {
    const filter = { rarity: Rarity.Legend, classId: 1 };
    expect(ids(filterAndSortPool(entries, filter, getCost))).toEqual([4]);
  });

  it('該当なしなら空', () => {
    const filter = { rarity: Rarity.Silver, classId: 7 };
    expect(filterAndSortPool(entries, filter, getCost)).toEqual([]);
  });

  it('絞り込み後もコスト順が保たれる', () => {
    const shuffled = build([
      { cardId: 9, cost: 7, classId: 1 },
      { cardId: 8, cost: 2, classId: 1 },
      { cardId: 7, cost: 2, classId: 2 },
      { cardId: 6, cost: 5, classId: 1 },
    ]);
    const result = filterAndSortPool(
      shuffled.entries,
      { rarity: null, classId: 1 },
      shuffled.getCost,
    );
    expect(ids(result)).toEqual([8, 6, 9]);
  });
});

describe('filterAndSortPool — 副作用', () => {
  it('元の配列を書き換えない', () => {
    const { entries, getCost } = build([
      { cardId: 2, cost: 9 },
      { cardId: 1, cost: 1 },
    ]);
    const before = ids(entries);
    filterAndSortPool(entries, NO_FILTER, getCost, 'rarity');
    expect(ids(entries)).toEqual(before);
  });
});
