import { Rarity } from './types';

/**
 * 排出率。出典は `排出率画像/` の公式「カードパック詳細」画面。
 * 排出率は全パック共通のため、弾ごとにテーブルを分けない。
 */

/** 1パックの総枚数 */
export const CARDS_PER_PACK = 8;

/** うち通常枠の枚数。残り1枚はシルバーレア以上確定枠 */
export const NORMAL_SLOT_COUNT = 7;

/**
 * レジェンド確定保証（天井）。
 * 「9パック連続でレジェンドが排出されなかった場合、10パック目から排出される
 *   カードのうち1枚が必ずレジェンドとして排出されます」
 * → 連続未排出カウントが 9 に達した状態で開ける次のパックが確定パック。
 */
export const PITY_THRESHOLD = 9;

export interface RarityWeight {
  readonly rarity: Rarity;
  /** 0..1 の確率。同一テーブル内の合計が 1 になること */
  readonly weight: number;
}

/**
 * エクスチェンジチケット(4種) 0.060% 枠。
 * チケットは本アプリで意味を持たないため、レジェンドとして排出する。
 * 下のテーブルではレジェンドの重みに合算してある（1.500% + 0.060% = 1.560%）。
 */
const LEGEND_WEIGHT = 0.015 + 0.0006;

/** 通常枠（7枚）— 1枚ごとに独立抽選 */
export const NORMAL_SLOT_WEIGHTS: readonly RarityWeight[] = [
  { rarity: Rarity.Legend, weight: LEGEND_WEIGHT },
  { rarity: Rarity.Gold, weight: 0.06 },
  { rarity: Rarity.Silver, weight: 0.25 },
  { rarity: Rarity.Bronze, weight: 0.6744 },
];

/** シルバーレア以上確定枠（1枚） */
export const GUARANTEED_SLOT_WEIGHTS: readonly RarityWeight[] = [
  { rarity: Rarity.Legend, weight: LEGEND_WEIGHT },
  { rarity: Rarity.Gold, weight: 0.06 },
  { rarity: Rarity.Silver, weight: 0.9244 },
];
