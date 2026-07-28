import type { CardPool } from './pool';
import { NEUTRAL_CLASS_ID } from './types';

/** シールド戦のデッキ枚数。構築戦と同じ40枚ちょうど。 */
export const DECK_SIZE = 40;

/** cardId → 投入枚数 */
export type Deck = ReadonlyMap<number, number>;

export interface DeckValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly total: number;
}

/**
 * そのカードをデッキに入れられる上限枚数。
 * 「開封して実際に手に入れた枚数」と「カード自身の投入上限」の小さい方。
 */
export function maxCopiesOf(pool: CardPool, cardId: number): number {
  const entry = pool.get(cardId);
  if (entry === undefined) return 0;
  return Math.min(entry.count, entry.card.deckEnabledNum);
}

/**
 * デッキがシールド戦のルールを満たすか検証する。
 *
 * - 40枚ちょうど
 * - 選択クラス + ニュートラルのみ
 * - 開封して所持している枚数まで
 * - カードごとの deck_enabled_num（通常3）まで
 */
export function validateDeck(deck: Deck, pool: CardPool, classId: number): DeckValidation {
  const errors: string[] = [];
  let total = 0;

  for (const [cardId, count] of deck) {
    if (count === 0) continue;

    if (count < 0) {
      errors.push(`カードID ${cardId} の枚数が不正です（${count} 枚）`);
      continue;
    }

    total += count;

    const entry = pool.get(cardId);
    if (entry === undefined) {
      errors.push(`カードID ${cardId} はカードプールにありません`);
      continue;
    }

    const { card } = entry;
    const name = `カードID ${cardId}`;

    if (card.classId !== classId && card.classId !== NEUTRAL_CLASS_ID) {
      errors.push(`${name} は選択中のクラスでは使えません`);
    }

    if (count > maxCopiesOf(pool, cardId)) {
      if (entry.count < card.deckEnabledNum) {
        errors.push(`${name} は所持 ${entry.count} 枚を超えて投入できません（${count} 枚）`);
      } else {
        errors.push(`${name} は ${card.deckEnabledNum} 枚までです（${count} 枚）`);
      }
    }
  }

  if (total !== DECK_SIZE) {
    errors.push(`デッキは${DECK_SIZE}枚ちょうどにしてください（現在 ${total} 枚）`);
  }

  return { valid: errors.length === 0, errors, total };
}
