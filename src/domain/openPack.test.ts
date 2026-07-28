import { describe, it, expect } from 'vitest';
import { openPack, openPacks } from './openPack';
import { mulberry32 } from './rng';
import { Rarity, type PoolCard, type SetCardIndex } from './types';
import { CARDS_PER_PACK, NORMAL_SLOT_COUNT, PITY_THRESHOLD } from './rates';

/** テスト用に、各レアリティ n 枚ずつ持つ弾を作る。 */
function makeIndex(setId = 10008, perRarity = 20): SetCardIndex {
  const make = (rarity: Rarity, offset: number): PoolCard[] =>
    Array.from({ length: perRarity }, (_, i) => ({
      cardId: setId * 1000 + offset + i,
      setId,
      rarity,
      classId: i % 8,
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

describe('openPack — パック構成', () => {
  it('1パックはちょうど8枚', () => {
    const result = openPack(makeIndex(), 0, mulberry32(1));
    expect(result.cards).toHaveLength(CARDS_PER_PACK);
  });

  it('最後の1枚はシルバーレア以上確定枠', () => {
    const index = makeIndex();
    for (let seed = 0; seed < 500; seed++) {
      const result = openPack(index, 0, mulberry32(seed));
      const guaranteed = result.cards[NORMAL_SLOT_COUNT];
      expect(guaranteed).toBeDefined();
      expect(guaranteed!.rarity).not.toBe(Rarity.Bronze);
    }
  });

  it('排出されるカードは指定した弾のものだけ', () => {
    const index = makeIndex(10005);
    const result = openPack(index, 0, mulberry32(42));
    for (const card of result.cards) {
      expect(card.setId).toBe(10005);
    }
  });
});

describe('openPack — レジェンド確定保証（天井）', () => {
  it('レジェンドが出なければ連続カウントが1増える', () => {
    const index = makeIndex();
    // レジェンドが出ないシードを探す
    for (let seed = 0; seed < 200; seed++) {
      const result = openPack(index, 3, mulberry32(seed));
      if (!result.cards.some((c) => c.rarity === Rarity.Legend)) {
        expect(result.pity).toBe(4);
        return;
      }
    }
    throw new Error('レジェンド無しのパックが見つからなかった');
  });

  it('レジェンドが出たら連続カウントは0にリセットされる', () => {
    const index = makeIndex();
    for (let seed = 0; seed < 500; seed++) {
      const result = openPack(index, 5, mulberry32(seed));
      if (result.cards.some((c) => c.rarity === Rarity.Legend)) {
        expect(result.pity).toBe(0);
        return;
      }
    }
    throw new Error('レジェンド入りのパックが見つからなかった');
  });

  it('カウントが閾値に達した状態で開けると必ずレジェンドが含まれる', () => {
    const index = makeIndex();
    for (let seed = 0; seed < 300; seed++) {
      const result = openPack(index, PITY_THRESHOLD, mulberry32(seed));
      const legends = result.cards.filter((c) => c.rarity === Rarity.Legend);
      expect(legends.length).toBeGreaterThanOrEqual(1);
      expect(result.cards).toHaveLength(CARDS_PER_PACK);
      expect(result.pity).toBe(0);
    }
  });

  it('天井パックの確定レジェンドは8枚のどの位置にも出うる（8枚目固定ではない）', () => {
    const index = makeIndex();
    const positions = new Set<number>();
    for (let seed = 0; seed < 400; seed++) {
      const result = openPack(index, PITY_THRESHOLD, mulberry32(seed));
      result.cards.forEach((c, i) => {
        if (c.rarity === Rarity.Legend) positions.add(i);
      });
    }
    // 通常枠(0..6)にも確定枠(7)にもレジェンドが現れること
    expect(positions.size).toBeGreaterThan(1);
    expect([...positions].some((p) => p < NORMAL_SLOT_COUNT)).toBe(true);
  });

  it('9パック連続でレジェンドが出ないことはあっても、10パック目までには必ず出る', () => {
    const index = makeIndex();
    for (let seed = 0; seed < 100; seed++) {
      const { cards } = openPacks(index, 10, mulberry32(seed));
      expect(cards.some((c) => c.rarity === Rarity.Legend)).toBe(true);
    }
  });
});

describe('openPacks — 連続開封', () => {
  it('n パック開けると n×8 枚になる', () => {
    const { cards } = openPacks(makeIndex(), 48, mulberry32(7));
    expect(cards).toHaveLength(48 * CARDS_PER_PACK);
  });

  it('開始カウントを引き継げる', () => {
    const index = makeIndex();
    const first = openPacks(index, 3, mulberry32(11));
    const second = openPacks(index, 3, mulberry32(12), first.pity);
    expect(second.pity).toBeGreaterThanOrEqual(0);
    expect(second.pity).toBeLessThanOrEqual(PITY_THRESHOLD);
  });
});

describe('openPack — 排出率', () => {
  const TRIALS = 60_000;

  /**
   * 天井カウントを持ち越さずに開封する。
   *
   * カウントを持ち越すと天井パックが混ざる。天井パックは「レジェンドが出なかったパック」
   * だけなので、それを標本から除外するとレジェンド率が上振れしてしまう。
   * 素の排出率を測るときは常に pity=0 で開ける。
   */
  function openWithoutPity(index: ReturnType<typeof makeIndex>, rng: () => number) {
    const result = openPack(index, 0, rng);
    expect(result.replacedByPity).toBe(false);
    return result;
  }

  const emptyCounts = (): Record<number, number> => ({
    [Rarity.Bronze]: 0,
    [Rarity.Silver]: 0,
    [Rarity.Gold]: 0,
    [Rarity.Legend]: 0,
  });

  it('通常枠の排出率が公表値に収束する', () => {
    const index = makeIndex();
    const rng = mulberry32(20260728);
    const counts = emptyCounts();
    let slots = 0;

    for (let i = 0; i < TRIALS; i++) {
      const result = openWithoutPity(index, rng);
      for (let s = 0; s < NORMAL_SLOT_COUNT; s++) {
        counts[result.cards[s]!.rarity]! += 1;
        slots += 1;
      }
    }

    const rate = (r: Rarity) => counts[r]! / slots;
    expect(rate(Rarity.Bronze)).toBeCloseTo(0.6744, 2);
    expect(rate(Rarity.Silver)).toBeCloseTo(0.25, 2);
    expect(rate(Rarity.Gold)).toBeCloseTo(0.06, 2);
    // レジェンド 1.500% + 旧エクスチェンジチケット枠 0.060% = 1.560%
    expect(rate(Rarity.Legend)).toBeCloseTo(0.0156, 3);
  });

  it('確定枠の排出率が公表値に収束する', () => {
    const index = makeIndex();
    const rng = mulberry32(999);
    const counts = emptyCounts();

    for (let i = 0; i < TRIALS; i++) {
      counts[openWithoutPity(index, rng).cards[NORMAL_SLOT_COUNT]!.rarity]! += 1;
    }

    expect(counts[Rarity.Bronze]).toBe(0);
    expect(counts[Rarity.Silver]! / TRIALS).toBeCloseTo(0.9244, 2);
    expect(counts[Rarity.Gold]! / TRIALS).toBeCloseTo(0.06, 2);
    expect(counts[Rarity.Legend]! / TRIALS).toBeCloseTo(0.0156, 3);
  });
});
