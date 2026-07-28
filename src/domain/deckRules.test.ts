import { describe, it, expect } from 'vitest';
import { DECK_SIZE, maxCopiesOf, validateDeck } from './deckRules';
import type { CardPool, PoolEntry } from './pool';
import { Rarity, NEUTRAL_CLASS_ID, type PoolCard } from './types';

function card(cardId: number, classId: number, deckEnabledNum = 3): PoolCard {
  return { cardId, setId: 10008, rarity: Rarity.Bronze, classId, deckEnabledNum };
}

function makePool(entries: readonly (readonly [PoolCard, number])[]): CardPool {
  const map = new Map<number, PoolEntry>();
  for (const [c, count] of entries) {
    map.set(c.cardId, { card: c, count, normalCount: count, premiumCount: 0 });
  }
  return map;
}

/** 指定クラスのカードを 1..n 種、各3枚所持しているプール */
function poolWithClassCards(classId: number, kinds: number): CardPool {
  return makePool(Array.from({ length: kinds }, (_, i) => [card(i + 1, classId), 3] as const));
}

/** ちょうど 40 枚になるデッキ（各3枚 × 13種 + 1枚） */
function fullDeck(): Map<number, number> {
  const deck = new Map<number, number>();
  for (let i = 1; i <= 13; i++) deck.set(i, 3);
  deck.set(14, 1);
  return deck;
}

describe('maxCopiesOf', () => {
  it('所持枚数が上限を下回るときは所持枚数が上限になる', () => {
    const pool = makePool([[card(1, 1), 1]]);
    expect(maxCopiesOf(pool, 1)).toBe(1);
  });

  it('所持枚数が多くても deckEnabledNum を超えられない', () => {
    const pool = makePool([[card(1, 1), 7]]);
    expect(maxCopiesOf(pool, 1)).toBe(3);
  });

  it('deckEnabledNum が 1 のカードは1枚まで', () => {
    const pool = makePool([[card(1, 1, 1), 5]]);
    expect(maxCopiesOf(pool, 1)).toBe(1);
  });

  it('未所持カードは0', () => {
    expect(maxCopiesOf(makePool([]), 999)).toBe(0);
  });
});

describe('validateDeck', () => {
  const pool = poolWithClassCards(1, 14);

  it('40枚ちょうど・同一クラスなら valid', () => {
    const result = validateDeck(fullDeck(), pool, 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.total).toBe(DECK_SIZE);
  });

  it('39枚は invalid', () => {
    const deck = fullDeck();
    deck.set(14, 0);
    const result = validateDeck(deck, pool, 1);
    expect(result.valid).toBe(false);
    expect(result.total).toBe(39);
  });

  it('41枚は invalid', () => {
    const deck = fullDeck();
    deck.set(14, 2);
    const result = validateDeck(deck, pool, 1);
    expect(result.valid).toBe(false);
    expect(result.total).toBe(41);
  });

  it('所持枚数を超えて投入すると invalid', () => {
    const scarce = makePool([
      [card(1, 1), 1], // 1枚しか開封できていない
      ...Array.from({ length: 20 }, (_, i) => [card(i + 2, 1), 3] as const),
    ]);
    const deck = new Map<number, number>([[1, 2]]);
    for (let i = 2; i <= 14; i++) deck.set(i, 3);
    // 2 + 13*3 = 41 なので1枚減らして40枚に揃える
    deck.set(14, 2);

    const result = validateDeck(deck, scarce, 1);
    expect(result.total).toBe(DECK_SIZE);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('所持'))).toBe(true);
  });

  it('deckEnabledNum を超えて投入すると invalid', () => {
    const rich = makePool(
      Array.from({ length: 14 }, (_, i) => [card(i + 1, 1), 9] as const),
    );
    const deck = new Map<number, number>();
    for (let i = 1; i <= 10; i++) deck.set(i, 4); // 4枚投入
    const result = validateDeck(deck, rich, 1);
    expect(result.valid).toBe(false);
  });

  it('他クラスのカードが混ざると invalid', () => {
    const mixed = makePool([
      ...Array.from({ length: 13 }, (_, i) => [card(i + 1, 1), 3] as const),
      [card(14, 2), 3], // 別クラス
    ]);
    const result = validateDeck(fullDeck(), mixed, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('クラス'))).toBe(true);
  });

  it('ニュートラルは混ぜられる', () => {
    const withNeutral = makePool([
      ...Array.from({ length: 13 }, (_, i) => [card(i + 1, 1), 3] as const),
      [card(14, NEUTRAL_CLASS_ID), 3],
    ]);
    const result = validateDeck(fullDeck(), withNeutral, 1);
    expect(result.valid).toBe(true);
  });

  it('プールに存在しないカードは invalid', () => {
    const deck = fullDeck();
    deck.set(999, 1);
    deck.set(14, 0);
    const result = validateDeck(deck, pool, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('プール'))).toBe(true);
  });

  it('枚数0のエントリは無視され、合計にも含まれない', () => {
    const deck = fullDeck();
    deck.set(99, 0);
    const result = validateDeck(deck, pool, 1);
    expect(result.total).toBe(DECK_SIZE);
    expect(result.valid).toBe(true);
  });

  it('負の枚数は invalid', () => {
    const deck = fullDeck();
    deck.set(1, -1);
    const result = validateDeck(deck, pool, 1);
    expect(result.valid).toBe(false);
  });
});
