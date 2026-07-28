import rawDb from './cards.json';
import type { LiteCard, LiteCardDb } from './cardTypes';
import { Rarity, type PoolCard, type SetCardIndex } from '../domain/types';

/** ベーシック弾。パック排出が存在せず、全プレイヤーが初期所持している扱いにする */
export const BASIC_SET_ID = 10000;
/** トークン置き場の擬似弾。閲覧はできるが排出・デッキ構築の対象外 */
export const TOKEN_SET_ID = 90000;

const db = rawDb as LiteCardDb;

const ALL_RARITIES: readonly Rarity[] = [
  Rarity.Bronze,
  Rarity.Silver,
  Rarity.Gold,
  Rarity.Legend,
];

function isRarity(value: number): value is Rarity {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

const cardById = new Map<number, LiteCard>(db.cards.map((c) => [c.cardId, c]));

/** トークンは詳細表示のためだけに DB へ入れてある。一覧・排出からは必ず外す */
const playableCards: readonly LiteCard[] = db.cards.filter((c) => !c.isToken);

const packSetIdsAsc: readonly number[] = [
  ...new Set(
    playableCards.map((c) => c.setId).filter((id) => id !== BASIC_SET_ID && id !== TOKEN_SET_ID),
  ),
].sort((a, b) => a - b);

const setIndexCache = new Map<number, SetCardIndex>();

/** デッキに入れられるカードだけを返す（トークンを含まない） */
export function allCards(): readonly LiteCard[] {
  return playableCards;
}

/** トークンも引ける。詳細表示で「生成されるトークン」を辿るため */
export function getCard(cardId: number): LiteCard | undefined {
  return cardById.get(cardId);
}

/**
 * このカードが生成するトークンなどの関連カード。
 * 自分自身とスタイル違い（同名）は除き、解決できた分だけ返す。
 */
export function relatedCards(card: LiteCard): readonly LiteCard[] {
  const seen = new Set<number>([card.cardId]);
  const result: LiteCard[] = [];

  for (const id of card.relatedCardIds ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const related = cardById.get(id);
    if (related !== undefined && related.name !== card.name) result.push(related);
  }
  return result;
}

export function setName(setId: number): string {
  return db.setNames[String(setId)] ?? `弾 ${setId}`;
}

/** カードDBの生成日時（ISO8601）。画面に出して鮮度を示す */
export function generatedAt(): string {
  return db.generatedAt;
}

/** パック排出のある弾のID（ベーシックを除く）。昇順。 */
export function packSetIds(): readonly number[] {
  return packSetIdsAsc;
}

/**
 * 新しい弾から `count` 個を返す（表示順を保つため昇順）。
 * 弾IDをハードコードしないので、新弾が追加されればそのまま追随する。
 */
export function latestPackSetIds(count: number): readonly number[] {
  return packSetIdsAsc.slice(Math.max(0, packSetIdsAsc.length - count));
}

export function toPoolCard(card: LiteCard): PoolCard {
  if (!isRarity(card.rarity)) {
    throw new Error(`カード ${card.cardId} のレアリティが不正です: ${card.rarity}`);
  }
  return {
    cardId: card.cardId,
    setId: card.setId,
    rarity: card.rarity,
    classId: card.classId,
    deckEnabledNum: card.deckEnabledNum,
  };
}

/** 指定した弾の排出候補をレアリティ別にまとめる。結果はキャッシュする。 */
export function buildSetIndex(setId: number): SetCardIndex {
  const cached = setIndexCache.get(setId);
  if (cached !== undefined) return cached;

  const byRarity = Object.fromEntries(
    ALL_RARITIES.map((rarity) => [rarity, [] as PoolCard[]]),
  ) as Record<Rarity, PoolCard[]>;

  for (const card of playableCards) {
    if (card.setId !== setId) continue;
    if (!isRarity(card.rarity)) continue;
    byRarity[card.rarity].push(toPoolCard(card));
  }

  const index: SetCardIndex = { setId, byRarity };
  setIndexCache.set(setId, index);
  return index;
}

export function basicPoolCards(): readonly PoolCard[] {
  return playableCards.filter((c) => c.setId === BASIC_SET_ID).map(toPoolCard);
}

/**
 * 公式CDNのカード画像URL。
 * カード詳細の拡大表示にだけ使う。一覧や開封演出では同梱した縮小WebPを使うこと。
 */
export function cardImageUrl(imageHash: string): string {
  return `https://shadowverse-wb.com/uploads/card_image/jpn/card/${imageHash}.png`;
}
