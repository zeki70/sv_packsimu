/**
 * 軽量カードDB（src/data/cards.json）の型。
 * scripts/syncCardData.ts が書き出し、src/data/cardDatabase.ts が読む。
 */

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
  evoSkillText?: string;
  evoImageHash?: string;
}

export interface LiteCardDb {
  generatedAt: string;
  setNames: Record<string, string>;
  cards: LiteCard[];
}
