/** カードのレアリティ。値はカードDBの `rarity` フィールドと一致する。 */
export const Rarity = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Legend: 4,
} as const;

export type Rarity = (typeof Rarity)[keyof typeof Rarity];

export const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
  [Rarity.Bronze]: 'ブロンズレア',
  [Rarity.Silver]: 'シルバーレア',
  [Rarity.Gold]: 'ゴールドレア',
  [Rarity.Legend]: 'レジェンド',
};

/** ニュートラルのクラスID。カードDBの `class` フィールドと一致する。 */
export const NEUTRAL_CLASS_ID = 0;

/**
 * パック排出・デッキ構築に必要な最小限のカード情報。
 * カードDBの `common` から間引いて作る（画像やフレーバーテキストは含めない）。
 */
export interface PoolCard {
  readonly cardId: number;
  readonly setId: number;
  readonly rarity: Rarity;
  /** 0 = ニュートラル */
  readonly classId: number;
  /** デッキ投入上限。通常3。カードDBの `deck_enabled_num` をそのまま使う */
  readonly deckEnabledNum: number;
}

/**
 * 開封で1枚引き当てた結果。
 *
 * プレミアム版は見た目だけの違いでデッキ構築に影響しないため、区別しない。
 */
export interface OpenedCard {
  readonly cardId: number;
  readonly setId: number;
  readonly rarity: Rarity;
}

/**
 * 1つの弾について、レアリティ別に排出候補を引けるようにしたインデックス。
 * トークンは含めないこと。
 */
export interface SetCardIndex {
  readonly setId: number;
  readonly byRarity: Readonly<Record<Rarity, readonly PoolCard[]>>;
}
