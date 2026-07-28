import type { PoolEntry } from '../domain/pool';
import type { Rarity } from '../domain/types';

export type PoolSortMode = 'cost' | 'rarity';

export interface PoolFilter {
  readonly rarity: Rarity | null;
  /** null = 全クラス。0 を渡すとニュートラルだけになる */
  readonly classId: number | null;
}

export const SORT_MODE_LABELS: Readonly<Record<PoolSortMode, string>> = {
  cost: 'コスト順',
  rarity: 'レアリティ順',
};

/**
 * カードプールを絞り込んで並び替える。
 *
 * コストは `getCost` で外から渡す。カードDBに依存させないことで、
 * 並び順のテストを実データ抜きで書けるようにしている。
 *
 * - `cost`: コスト昇順 → カードID昇順
 * - `rarity`: レアリティ降順（レジェンド優先）→ コスト昇順 → カードID昇順
 */
export function filterAndSortPool(
  entries: readonly PoolEntry[],
  filter: PoolFilter,
  getCost: (cardId: number) => number,
  mode: PoolSortMode = 'cost',
): readonly PoolEntry[] {
  const filtered = entries.filter((entry) => {
    if (filter.rarity !== null && entry.card.rarity !== filter.rarity) return false;
    if (filter.classId !== null && entry.card.classId !== filter.classId) return false;
    return true;
  });

  // 元の配列を破壊しないよう、filter が返した新しい配列の上で並び替える
  return filtered.sort((a, b) => {
    if (mode === 'rarity' && a.card.rarity !== b.card.rarity) {
      return b.card.rarity - a.card.rarity;
    }

    const costDiff = getCost(a.card.cardId) - getCost(b.card.cardId);
    if (costDiff !== 0) return costDiff;

    return a.card.cardId - b.card.cardId;
  });
}
