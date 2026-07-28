import { Rarity } from '../domain/types';
import { TYPE_FILTER_LABELS, typeKeyOf } from './poolSort';

export interface ClassDef {
  readonly id: number;
  readonly name: string;
}

/** WB のクラス。カードDBの `class` と対応する（0 はニュートラル） */
export const CLASSES: readonly ClassDef[] = [
  { id: 1, name: 'エルフ' },
  { id: 2, name: 'ロイヤル' },
  { id: 3, name: 'ウィッチ' },
  { id: 4, name: 'ドラゴン' },
  { id: 5, name: 'ナイトメア' },
  { id: 6, name: 'ビショップ' },
  { id: 7, name: 'ネメシス' },
];

export function className(classId: number): string {
  if (classId === 0) return 'ニュートラル';
  return CLASSES.find((c) => c.id === classId)?.name ?? `クラス${classId}`;
}

/**
 * 1=フォロワー, 2/3=アミュレット, 4=スペル
 * 判定は poolSort の typeKeyOf に集約し、ここでは表示名に変換するだけにする。
 */
export function typeLabel(type: number): string {
  return TYPE_FILTER_LABELS[typeKeyOf(type)];
}

export const RARITY_ORDER: readonly Rarity[] = [
  Rarity.Legend,
  Rarity.Gold,
  Rarity.Silver,
  Rarity.Bronze,
];

export const RARITY_NAME: Readonly<Record<Rarity, string>> = {
  [Rarity.Bronze]: 'ブロンズ',
  [Rarity.Silver]: 'シルバー',
  [Rarity.Gold]: 'ゴールド',
  [Rarity.Legend]: 'レジェンド',
};

export const RARITY_CLASS: Readonly<Record<Rarity, string>> = {
  [Rarity.Bronze]: 'r-bronze',
  [Rarity.Silver]: 'r-silver',
  [Rarity.Gold]: 'r-gold',
  [Rarity.Legend]: 'r-legend',
};
