import { describe, it, expect } from 'vitest';
import {
  BASIC_SET_ID,
  allCards,
  basicPoolCards,
  buildSetIndex,
  cardImageUrl,
  getCard,
  latestPackSetIds,
  packSetIds,
  setName,
  toPoolCard,
} from './cardDatabase';
import { Rarity } from '../domain/types';

describe('cardDatabase', () => {
  it('トークンを含まないカードだけを持つ', () => {
    const cards = allCards();
    expect(cards.length).toBeGreaterThan(600);
    // トークン置き場の擬似弾は同期時に除外されている
    expect(cards.every((c) => c.setId !== 90000)).toBe(true);
  });

  it('全カードのレアリティが 1..4 に収まる', () => {
    for (const card of allCards()) {
      expect(card.rarity).toBeGreaterThanOrEqual(Rarity.Bronze);
      expect(card.rarity).toBeLessThanOrEqual(Rarity.Legend);
    }
  });

  it('全カードの deckEnabledNum が 1 以上', () => {
    for (const card of allCards()) {
      expect(card.deckEnabledNum).toBeGreaterThanOrEqual(1);
    }
  });

  it('packSetIds はベーシックを含まない', () => {
    expect(packSetIds()).not.toContain(BASIC_SET_ID);
    expect(packSetIds().length).toBeGreaterThanOrEqual(6);
  });

  it('latestPackSetIds は新しい弾から指定数を返す（昇順）', () => {
    const latest = latestPackSetIds(6);
    expect(latest).toHaveLength(6);

    const sorted = [...latest].sort((a, b) => a - b);
    expect(latest).toEqual(sorted);

    // 全弾のうち最も新しい弾が含まれている
    const newest = Math.max(...packSetIds());
    expect(latest).toContain(newest);
  });

  it('latestPackSetIds は弾数を超えて要求されても全弾を返す', () => {
    expect(latestPackSetIds(999)).toHaveLength(packSetIds().length);
  });

  it('buildSetIndex は4レアリティすべてに候補を持つ', () => {
    for (const setId of packSetIds()) {
      const index = buildSetIndex(setId);
      expect(index.setId).toBe(setId);
      for (const rarity of [Rarity.Bronze, Rarity.Silver, Rarity.Gold, Rarity.Legend]) {
        expect(index.byRarity[rarity].length).toBeGreaterThan(0);
      }
      // 他の弾のカードが混ざらない
      for (const rarity of [Rarity.Bronze, Rarity.Silver, Rarity.Gold, Rarity.Legend]) {
        expect(index.byRarity[rarity].every((c) => c.setId === setId)).toBe(true);
      }
    }
  });

  it('basicPoolCards はベーシック弾のカードだけを返す', () => {
    const basics = basicPoolCards();
    expect(basics.length).toBeGreaterThan(0);
    expect(basics.every((c) => c.setId === BASIC_SET_ID)).toBe(true);
  });

  it('setName は弾名を解決する', () => {
    expect(setName(BASIC_SET_ID)).toBe('ベーシック');
  });

  it('toPoolCard はドメイン型に変換する', () => {
    const card = allCards()[0]!;
    const pool = toPoolCard(card);
    expect(pool.cardId).toBe(card.cardId);
    expect(pool.setId).toBe(card.setId);
    expect(pool.classId).toBe(card.classId);
    expect(pool.deckEnabledNum).toBe(card.deckEnabledNum);
  });

  it('getCard は cardId から引ける', () => {
    const card = allCards()[10]!;
    expect(getCard(card.cardId)?.name).toBe(card.name);
    expect(getCard(-1)).toBeUndefined();
  });

  it('cardImageUrl は公式CDNのURLを組み立てる', () => {
    expect(cardImageUrl('abc123')).toBe(
      'https://shadowverse-wb.com/uploads/card_image/jpn/card/abc123.png',
    );
  });
});
