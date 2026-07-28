/**
 * 軽量カードDB（src/data/cards.json）の型。
 * scripts/syncCardData.ts が書き出し、src/data/cardDatabase.ts が読む。
 */

/** クレスト・結晶・信仰・アクセラレートなど、カード本体とは別枠の効果 */
export interface SpecificEffect {
  /** '結晶' | 'アクセラレート' | 'クレスト' | '信仰' */
  typeName: string;
  cost?: number;
  skillText: string;
}

export interface LiteCard {
  cardId: number;
  name: string;
  setId: number;
  /** 1=ブロンズ / 2=シルバー / 3=ゴールド / 4=レジェンド */
  rarity: number;
  /** 0=ニュートラル, 1..7=各クラス */
  classId: number;
  /** 1=フォロワー, 2=アミュレット, 3=カウントダウンアミュレット, 4=スペル */
  type: number;
  cost: number;
  atk: number;
  life: number;
  deckEnabledNum: number;
  skillText: string;
  imageHash: string;
  tribeNames: string[];
  /** トークンはパック排出・デッキ構築の対象外。閲覧のためだけに DB に入れる */
  isToken: boolean;
  evoSkillText?: string;
  evoImageHash?: string;
  specificEffects?: SpecificEffect[];
  /** このカードが生成するトークンなどの cardId */
  relatedCardIds?: number[];
}

export interface LiteCardDb {
  generatedAt: string;
  setNames: Record<string, string>;
  cards: LiteCard[];
}
