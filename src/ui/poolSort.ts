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

/** 並び替えに使うカードの属性。LiteCard はそのまま渡せる */
export interface SortableCard {
  readonly cardId: number;
  readonly classId: number;
  readonly rarity: number;
  readonly cost: number;
  /** 1=フォロワー, 2/3=アミュレット, 4=スペル */
  readonly type: number;
}

export const DEFAULT_SORT: PoolSort = { mode: 'cost', direction: 'asc' };

/**
 * カード2枚の並び順を決める唯一の実装。
 * カードプール・デッキ構築の一覧・デッキリスト・デッキ確認で共有する。
 */
export function compareCards(
  a: SortableCard,
  b: SortableCard,
  sort: PoolSort = DEFAULT_SORT,
): number {
  const sign = sort.direction === 'desc' ? -1 : 1;

  if (sort.mode === 'rarity' && a.rarity !== b.rarity) {
    return sign * (a.rarity - b.rarity);
  }

  const costDiff = a.cost - b.cost;
  if (costDiff !== 0) {
    // コスト順のときだけ方向が効く。レアリティ順では常に昇順の副キー
    return sort.mode === 'cost' ? sign * costDiff : costDiff;
  }

  // ここから先は同コスト内の並び。方向によらず常に同じ順にする
  const classDiff = classSortKey(a.classId) - classSortKey(b.classId);
  if (classDiff !== 0) return classDiff;

  const typeDiff = TYPE_SORT_ORDER[typeKeyOf(a.type)] - TYPE_SORT_ORDER[typeKeyOf(b.type)];
  if (typeDiff !== 0) return typeDiff;

  return a.cardId - b.cardId;
}

function toSortable(entry: PoolEntry, lookup: CardInfoLookup): SortableCard {
  const info = lookup(entry.card.cardId);
  return {
    cardId: entry.card.cardId,
    classId: entry.card.classId,
    rarity: entry.card.rarity,
    cost: info?.cost ?? 0,
    type: info?.type ?? 1,
  };
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
  sort: PoolSort = DEFAULT_SORT,
): readonly PoolEntry[] {
  // 比較のたびに lookup を引かないよう、先に並び替えキーを作っておく
  const decorated = entries.map((entry) => ({ entry, key: toSortable(entry, lookup) }));
  decorated.sort((a, b) => compareCards(a.key, b.key, sort));
  return decorated.map((d) => d.entry);
}

export function filterAndSortPool(
  entries: readonly PoolEntry[],
  filter: PoolFilter,
  lookup: CardInfoLookup,
  sort: PoolSort = DEFAULT_SORT,
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
