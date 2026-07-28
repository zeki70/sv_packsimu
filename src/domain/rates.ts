import { Rarity } from './types';

/**
 * 排出率。出典は `排出率画像/` の公式「カードパック詳細」画面。
 * 排出率は全パック共通のため、弾ごとにテーブルを分けない。
 */

/** 1パックの総枚数 */
export const CARDS_PER_PACK = 8;

/** うち通常枠の枚数。残り1枚はシルバーレア以上確定枠 */
export const NORMAL_SLOT_COUNT = 7;

/** 各カードがプレミアム版になる確率（レアリティ抽選とは独立） */
export const PREMIUM_RATE = 0.08;

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
  /**
   * エクスチェンジチケット枠の置き換え。
   * チケットは本アプリで意味を持たないため、プレミアム確定のレジェンドとして排出する。
   */
  readonly guaranteedPremium: boolean;
}

/** 通常枠（7枚）— 1枚ごとに独立抽選 */
export const NORMAL_SLOT_WEIGHTS: readonly RarityWeight[] = [
  { rarity: Rarity.Legend, weight: 0.0006, guaranteedPremium: true }, // 旧エクスチェンジチケット(4種)
  { rarity: Rarity.Legend, weight: 0.015, guaranteedPremium: false },
  { rarity: Rarity.Gold, weight: 0.06, guaranteedPremium: false },
  { rarity: Rarity.Silver, weight: 0.25, guaranteedPremium: false },
  { rarity: Rarity.Bronze, weight: 0.6744, guaranteedPremium: false },
];

/** シルバーレア以上確定枠（1枚） */
export const GUARANTEED_SLOT_WEIGHTS: readonly RarityWeight[] = [
  { rarity: Rarity.Legend, weight: 0.0006, guaranteedPremium: true }, // 旧エクスチェンジチケット(4種)
  { rarity: Rarity.Legend, weight: 0.015, guaranteedPremium: false },
  { rarity: Rarity.Gold, weight: 0.06, guaranteedPremium: false },
  { rarity: Rarity.Silver, weight: 0.9244, guaranteedPremium: false },
];
