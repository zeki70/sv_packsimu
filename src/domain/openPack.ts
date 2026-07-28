import {
  CARDS_PER_PACK,
  GUARANTEED_SLOT_WEIGHTS,
  NORMAL_SLOT_COUNT,
  NORMAL_SLOT_WEIGHTS,
  PITY_THRESHOLD,
  PREMIUM_RATE,
  type RarityWeight,
} from './rates';
import { pickUniform, pickWeighted, type Rng } from './rng';
import { Rarity, type OpenedCard, type SetCardIndex } from './types';

export interface PackOpenResult {
  readonly cards: readonly OpenedCard[];
  /** このパックを開けた後の「レジェンド未排出が続いたパック数」 */
  readonly pity: number;
  /** 天井によってレジェンドへの置き換えが発生したか。排出率の検証で除外するために持つ */
  readonly replacedByPity: boolean;
}

export interface MultiPackResult {
  readonly cards: readonly OpenedCard[];
  readonly pity: number;
}

function drawFromRarity(
  index: SetCardIndex,
  rarity: Rarity,
  rng: Rng,
  forcePremium: boolean,
): OpenedCard {
  const candidates = index.byRarity[rarity];
  if (candidates.length === 0) {
    throw new Error(
      `弾 ${index.setId} にレアリティ ${rarity} のカードが1枚もありません。カードDBを確認してください`,
    );
  }

  const card = pickUniform(rng, candidates);
  // 分岐で乱数の消費数が変わらないよう、常に引いてから判定する
  const premiumRoll = rng() < PREMIUM_RATE;

  return {
    cardId: card.cardId,
    setId: card.setId,
    rarity,
    premium: forcePremium || premiumRoll,
  };
}

function drawSlot(index: SetCardIndex, weights: readonly RarityWeight[], rng: Rng): OpenedCard {
  const entry = pickWeighted(rng, weights);
  return drawFromRarity(index, entry.rarity, rng, entry.guaranteedPremium);
}

/**
 * 1パック（8枚 = 通常枠7枚 + シルバーレア以上確定枠1枚）を開封する。
 *
 * 天井は「弾ごとに独立」して数えるため、この関数は弾をまたぐ状態を持たない。
 * 呼び出し側が弾ごとの pity を管理すること。
 *
 * @param pity この弾でレジェンドが出ないまま開けたパック数
 */
export function openPack(index: SetCardIndex, pity: number, rng: Rng): PackOpenResult {
  const cards: OpenedCard[] = [];
  for (let i = 0; i < NORMAL_SLOT_COUNT; i++) {
    cards.push(drawSlot(index, NORMAL_SLOT_WEIGHTS, rng));
  }
  cards.push(drawSlot(index, GUARANTEED_SLOT_WEIGHTS, rng));

  const drewLegend = cards.some((c) => c.rarity === Rarity.Legend);

  // レジェンド確定保証: 確定枠は8枚の中からランダムに選ばれる（8枚目固定ではない）
  let replacedByPity = false;
  if (!drewLegend && pity >= PITY_THRESHOLD) {
    const slot = Math.min(Math.floor(rng() * CARDS_PER_PACK), CARDS_PER_PACK - 1);
    cards[slot] = drawFromRarity(index, Rarity.Legend, rng, false);
    replacedByPity = true;
  }

  return {
    cards,
    // レジェンドを獲得した時点でカウントは即リセットされる
    pity: drewLegend || replacedByPity ? 0 : pity + 1,
    replacedByPity,
  };
}

/**
 * 同一の弾を連続で開封する。天井カウントはこの弾の中だけで引き継がれる。
 *
 * @param startPity 既に開封済みのパックから引き継ぐカウント
 */
export function openPacks(
  index: SetCardIndex,
  packCount: number,
  rng: Rng,
  startPity = 0,
): MultiPackResult {
  const cards: OpenedCard[] = [];
  let pity = startPity;

  for (let i = 0; i < packCount; i++) {
    const result = openPack(index, pity, rng);
    pity = result.pity;
    cards.push(...result.cards);
  }

  return { cards, pity };
}
