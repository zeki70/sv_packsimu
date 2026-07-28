import type { PoolEntry } from '../domain/pool';
import { NEUTRAL_CLASS_ID, type Rarity } from '../domain/types';

export type PoolSortMode = 'cost' | 'rarity';
export type SortDirection = 'asc' | 'desc';
export type CardTypeKey = 'follower' | 'amulet' | 'spell';

/** 並び替えに必要なカード情報だけを受け取る。カードDBに直接依存させないため */
export interface SortableCardInfo {
  readonly cost: number;
  /** 1=フォロワー, 2/3=アミュレット, 4=スペル */
  readonly type: number;
}

export type CardInfoLookup = (cardId: number) => SortableCardInfo | undefined;

export interface PoolFilter {
  readonly rarity: Rarity | null;
  /** null = 全クラス。0 を渡すとニュートラルだけになる */
  readonly classId: number | null;
  readonly type: CardTypeKey | null;
}

export interface PoolSort {
  readonly mode: PoolSortMode;
  readonly direction: SortDirection;
}

export const NO_FILTER: PoolFilter = { rarity: null, classId: null, type: null };

export const SORT_MODE_LABELS: Readonly<Record<PoolSortMode, string>> = {
  cost: 'コスト',
  rarity: 'レアリティ',
};

export const TYPE_FILTER_LABELS: Readonly<Record<CardTypeKey, string>> = {
  follower: 'フォロワー',
  amulet: 'アミュレット',
  spell: 'スペル',
};

/** 並び替えモードを切り替えたときの既定方向。レアリティはレジェンドを先に出す */
export const DEFAULT_DIRECTION: Readonly<Record<PoolSortMode, SortDirection>> = {
  cost: 'asc',
  rarity: 'desc',
};

export function typeKeyOf(type: number): CardTypeKey {
  if (type === 1) return 'follower';
  if (type === 2 || type === 3) return 'amulet';
  return 'spell';
}

/** 同コスト内でのタイプの並び順: フォロワー → スペル → アミュレット */
const TYPE_SORT_ORDER: Readonly<Record<CardTypeKey, number>> = {
  follower: 0,
  spell: 1,
  amulet: 2,
};

/**
 * 同コスト内でのクラスの並び順。
 * ニュートラルを先頭に置き、そのあとをクラスID昇順にする。
 */
function classSortKey(classId: number): number {
  return classId === NEUTRAL_CLASS_ID ? -1 : classId;
}

/**
 * 主キーが同値のときの並び。
 * ニュートラル → 当該クラスの順に並べ、その中をフォロワー → スペル → アミュレット、
 * 最後にカードID昇順で確定させる。
 */
function compareWithinSameCost(
  a: PoolEntry,
  b: PoolEntry,
  lookup: CardInfoLookup,
): number {
  const classDiff = classSortKey(a.card.classId) - classSortKey(b.card.classId);
  if (classDiff !== 0) return classDiff;

  const typeOf = (entry: PoolEntry): number => {
    const info = lookup(entry.card.cardId);
    return info === undefined ? TYPE_SORT_ORDER.follower : TYPE_SORT_ORDER[typeKeyOf(info.type)];
  };

  const typeDiff = typeOf(a) - typeOf(b);
  if (typeDiff !== 0) return typeDiff;

  return a.card.cardId - b.card.cardId;
}

/**
 * カードプールを絞り込んで並び替える。
 *
 * - `cost`: コスト → クラス → タイプ → カードID
 * - `rarity`: レアリティ → コスト → クラス → タイプ → カードID
 *
 * 同コスト内はニュートラルを先に置き、その中をフォロワー → スペル → アミュレット、
 * 最後にカードID昇順で並べる。
 *
 * `direction` は先頭のキーにだけ効く。同値のときの並びを安定させるため、
 * 2番目以降のキーは常に昇順にする。
 */
export function sortPoolEntries(
  entries: readonly PoolEntry[],
  lookup: CardInfoLookup,
  sort: PoolSort = { mode: 'cost', direction: 'asc' },
): readonly PoolEntry[] {
  const sign = sort.direction === 'desc' ? -1 : 1;
  const costOf = (cardId: number): number => lookup(cardId)?.cost ?? 0;

  // コピーしてから並び替えるので、渡された配列は壊れない
  return [...entries].sort((a, b) => {
    if (sort.mode === 'rarity' && a.card.rarity !== b.card.rarity) {
      return sign * (a.card.rarity - b.card.rarity);
    }

    const costDiff = costOf(a.card.cardId) - costOf(b.card.cardId);
    if (costDiff !== 0) {
      // コスト順のときだけ方向が効く。レアリティ順では常に昇順の副キー
      return sort.mode === 'cost' ? sign * costDiff : costDiff;
    }

    return compareWithinSameCost(a, b, lookup);
  });
}

export function filterAndSortPool(
  entries: readonly PoolEntry[],
  filter: PoolFilter,
  lookup: CardInfoLookup,
  sort: PoolSort = { mode: 'cost', direction: 'asc' },
): readonly PoolEntry[] {
  const filtered = entries.filter((entry) => {
    if (filter.rarity !== null && entry.card.rarity !== filter.rarity) return false;
    if (filter.classId !== null && entry.card.classId !== filter.classId) return false;
    if (filter.type !== null) {
      const info = lookup(entry.card.cardId);
      if (info === undefined || typeKeyOf(info.type) !== filter.type) return false;
    }
    return true;
  });

  return sortPoolEntries(filtered, lookup, sort);
}
