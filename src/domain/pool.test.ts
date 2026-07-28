import { describe, it, expect } from 'vitest';
import { buildPool, ownedCount, poolCardsForClass } from './pool';
import { mulberry32 } from './rng';
import { CARDS_PER_PACK } from './rates';
import { Rarity, NEUTRAL_CLASS_ID, type PoolCard, type SetCardIndex } from './types';

function makeIndex(setId: number, perRarity = 20): SetCardIndex {
  const make = (rarity: Rarity, offset: number): PoolCard[] =>
    Array.from({ length: perRarity }, (_, i) => ({
      cardId: setId * 1000 + offset + i,
      setId,
      rarity,
      classId: i % 8, // 0 = ニュートラル, 1..7 = 各クラス
      deckEnabledNum: 3,
    }));

  return {
    setId,
    byRarity: {
      [Rarity.Bronze]: make(Rarity.Bronze, 100),
      [Rarity.Silver]: make(Rarity.Silver, 200),
      [Rarity.Gold]: make(Rarity.Gold, 300),
      [Rarity.Legend]: make(Rarity.Legend, 400),
    },
  };
}

const BASIC_CARDS: readonly PoolCard[] = Array.from({ length: 56 }, (_, i) => ({
  cardId: 10000000 + i,
  setId: 10000,
  rarity: Rarity.Bronze,
  classId: i % 8,
  deckEnabledNum: 3,
}));

const SIX_SETS = [10003, 10004, 10005, 10006, 10007, 10008];

describe('buildPool', () => {
  it('既定の 6弾×8パック で 384枚 開封される', () => {
    const result = buildPool({
      indexes: SIX_SETS.map((id) => makeIndex(id)),
      packCounts: new Map(SIX_SETS.map((id) => [id, 8])),
      includeBasic: false,
      basicCards: BASIC_CARDS,
      rng: mulberry32(1),
    });

    expect(result.openedCards).toHaveLength(6 * 8 * CARDS_PER_PACK);
    expect(result.openedCards).toHaveLength(384);
  });

  it('ベーシックを有効にすると全56種が3枚ずつ無償で入る', () => {
    const result = buildPool({
      indexes: [makeIndex(10008)],
      packCounts: new Map([[10008, 8]]),
      includeBasic: true,
      basicCards: BASIC_CARDS,
      rng: mulberry32(2),
    });

    for (const card of BASIC_CARDS) {
      expect(ownedCount(result.pool, card.cardId)).toBe(3);
    }
    // ベーシックは開封ではないので開封結果には含まれない
    expect(result.openedCards.every((c) => c.setId !== 10000)).toBe(true);
  });

  it('ベーシックを無効にするとプールに入らない', () => {
    const result = buildPool({
      indexes: [makeIndex(10008)],
      packCounts: new Map([[10008, 8]]),
      includeBasic: false,
      basicCards: BASIC_CARDS,
      rng: mulberry32(3),
    });

    for (const card of BASIC_CARDS) {
      expect(ownedCount(result.pool, card.cardId)).toBe(0);
    }
  });

  it('天井カウントは弾ごとに独立して管理される', () => {
    const result = buildPool({
      indexes: SIX_SETS.map((id) => makeIndex(id)),
      packCounts: new Map(SIX_SETS.map((id) => [id, 10])),
      includeBasic: false,
      basicCards: BASIC_CARDS,
      rng: mulberry32(4),
    });

    // 弾ごとにカウンタが存在する
    expect(result.pityBySet.size).toBe(SIX_SETS.length);

    // 各弾10パックずつなので、どの弾も最低1枚はレジェンドが出ている
    for (const setId of SIX_SETS) {
      const legends = result.openedCards.filter(
        (c) => c.setId === setId && c.rarity === Rarity.Legend,
      );
      expect(legends.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('重複したカードは枚数が合算される', () => {
    const result = buildPool({
      indexes: [makeIndex(10008, 1)], // 各レアリティ1枚だけ → 必ず重複する
      packCounts: new Map([[10008, 20]]),
      includeBasic: false,
      basicCards: BASIC_CARDS,
      rng: mulberry32(5),
    });

    // 候補が4種しかないので、開封枚数が全てそこに集約される
    expect(result.pool.size).toBeLessThanOrEqual(4);
    const total = [...result.pool.values()].reduce((sum, e) => sum + e.count, 0);
    expect(total).toBe(20 * CARDS_PER_PACK);
  });

  it('パック数0の弾は開封されない', () => {
    const result = buildPool({
      indexes: [makeIndex(10007), makeIndex(10008)],
      packCounts: new Map([
        [10007, 0],
        [10008, 5],
      ]),
      includeBasic: false,
      basicCards: BASIC_CARDS,
      rng: mulberry32(6),
    });

    expect(result.openedCards.every((c) => c.setId === 10008)).toBe(true);
    expect(result.openedCards).toHaveLength(5 * CARDS_PER_PACK);
  });
});

describe('poolCardsForClass', () => {
  it('選んだクラスとニュートラルだけを返す', () => {
    const result = buildPool({
      indexes: SIX_SETS.map((id) => makeIndex(id)),
      packCounts: new Map(SIX_SETS.map((id) => [id, 8])),
      includeBasic: false,
      basicCards: BASIC_CARDS,
      rng: mulberry32(7),
    });

    const forElf = poolCardsForClass(result.pool, 1);
    expect(forElf.length).toBeGreaterThan(0);
    for (const entry of forElf) {
      expect([1, NEUTRAL_CLASS_ID]).toContain(entry.card.classId);
    }
  });
});
