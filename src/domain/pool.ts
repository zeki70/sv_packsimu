import { openPacks } from './openPack';
import type { Rng } from './rng';
import {
  NEUTRAL_CLASS_ID,
  Rarity,
  type OpenedCard,
  type PoolCard,
  type SetCardIndex,
} from './types';

const ALL_RARITIES: readonly Rarity[] = [
  Rarity.Bronze,
  Rarity.Silver,
  Rarity.Gold,
  Rarity.Legend,
];

/** カード1種の所持状況。 */
export interface PoolEntry {
  readonly card: PoolCard;
  /** 開封して手に入れた枚数 */
  readonly count: number;
}

/** cardId → 所持状況 */
export type CardPool = ReadonlyMap<number, PoolEntry>;

export interface BuildPoolInput {
  readonly indexes: readonly SetCardIndex[];
  /** setId → 開封するパック数 */
  readonly packCounts: ReadonlyMap<number, number>;
  /** ベーシックカードをプールに無償追加するか */
  readonly includeBasic: boolean;
  readonly basicCards: readonly PoolCard[];
  readonly rng: Rng;
}

export interface BuildPoolResult {
  readonly pool: CardPool;
  /** 開封演出用の排出順。ベーシックの無償追加分は含まない */
  readonly openedCards: readonly OpenedCard[];
  /** setId → 開封後の天井カウント。弾ごとに独立している */
  readonly pityBySet: ReadonlyMap<number, number>;
}

function indexCardsById(indexes: readonly SetCardIndex[]): Map<number, PoolCard> {
  const lookup = new Map<number, PoolCard>();
  for (const index of indexes) {
    for (const rarity of ALL_RARITIES) {
      for (const card of index.byRarity[rarity]) {
        lookup.set(card.cardId, card);
      }
    }
  }
  return lookup;
}

function addToPool(pool: Map<number, PoolEntry>, card: PoolCard, copies: number): void {
  const prev = pool.get(card.cardId);
  // 既存エントリを書き換えず、新しいオブジェクトに差し替える
  pool.set(card.cardId, { card, count: (prev?.count ?? 0) + copies });
}

/**
 * シールド戦のカードプールを生成する。
 *
 * レジェンド確定保証のカウントは弾ごとに独立しているため、弾ごとに openPacks を呼び、
 * カウンタを共有しない。
 */
export function buildPool(input: BuildPoolInput): BuildPoolResult {
  const { indexes, packCounts, includeBasic, basicCards, rng } = input;

  const lookup = indexCardsById(indexes);
  const openedCards: OpenedCard[] = [];
  const pityBySet = new Map<number, number>();

  for (const index of indexes) {
    const packCount = packCounts.get(index.setId) ?? 0;
    const result = openPacks(index, packCount, rng);
    openedCards.push(...result.cards);
    pityBySet.set(index.setId, result.pity);
  }

  const pool = new Map<number, PoolEntry>();

  for (const opened of openedCards) {
    const card = lookup.get(opened.cardId);
    if (card === undefined) {
      throw new Error(
        `排出されたカード ${opened.cardId} が弾 ${opened.setId} のインデックスに見つかりません`,
      );
    }
    addToPool(pool, card, 1);
  }

  // ベーシックはパック排出ではなく全プレイヤーが初期所持しているため、
  // 開封結果とは別に上限枚数ぶんを無償で追加する
  if (includeBasic) {
    for (const card of basicCards) {
      addToPool(pool, card, card.deckEnabledNum);
    }
  }

  return { pool, openedCards, pityBySet };
}

export function ownedCount(pool: CardPool, cardId: number): number {
  return pool.get(cardId)?.count ?? 0;
}

/** 指定クラス + ニュートラルのカードだけを返す。 */
export function poolCardsForClass(pool: CardPool, classId: number): readonly PoolEntry[] {
  return [...pool.values()].filter(
    (entry) => entry.card.classId === classId || entry.card.classId === NEUTRAL_CLASS_ID,
  );
}
