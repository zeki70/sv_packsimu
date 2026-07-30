import { DECK_SIZE, type Deck } from './deckRules';
import { NEUTRAL_CLASS_ID } from './types';

/**
 * 公式サイトのデッキURL。
 *
 * 例: https://shadowverse-wb.com/ja/deck/detail/?hash=2.2.fIck.cEc-....&lang=ja
 *
 * hash は `.` 区切りで、
 *   1つ目: フォーマット（1=ローテーション / 2=アンリミテッド）
 *   2つ目: クラスID（1=エルフ … 7=ネメシス。カードDBの class と同じ）
 *   3つ目以降: デッキの全カード（40枚ぶん、1枚1トークン）を64進数4桁にしたもの
 * となっている。
 */
export const DECK_DETAIL_URL = 'https://shadowverse-wb.com/ja/deck/detail/';

/**
 * フォーマット種別。シールド戦のプールは過去弾を含むので常にアンリミテッド。
 * ローテーションで開くと落ちている弾のカードが弾かれてしまう。
 */
const UNLIMITED_FORMAT = 2;

/**
 * Cygames 独自の64進数テーブル。
 * 標準の Base64（A〜Z 始まり）と違い「数字 → 大文字 → 小文字」の順に値が割り当てられている。
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/** カード1枚あたりの桁数。カードID（8桁 ≒ 1000万台）は4桁 = 最大 16,777,215 に収まる。 */
const CODE_LENGTH = 4;

const MAX_CARD_ID = DIGITS.length ** CODE_LENGTH - 1;

/** cardId を64進数4桁に変換する。 */
export function encodeCardId(cardId: number): string {
  if (!Number.isInteger(cardId) || cardId < 0 || cardId > MAX_CARD_ID) {
    throw new RangeError(`cardId ${cardId} は ${CODE_LENGTH} 桁の64進数で表せません`);
  }

  let rest = cardId;
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code = DIGITS[rest % DIGITS.length] + code;
    rest = Math.floor(rest / DIGITS.length);
  }
  return code;
}

/** 64進数4桁を cardId に戻す。エンコードが公式と一致していることを検証するために使う。 */
export function decodeCardId(code: string): number {
  if (code.length !== CODE_LENGTH) {
    throw new RangeError(`デッキコード "${code}" の桁数が不正です`);
  }

  let value = 0;
  for (const char of code) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0) throw new RangeError(`デッキコードに使えない文字です: "${char}"`);
    value = value * DIGITS.length + digit;
  }
  return value;
}

/**
 * デッキ（cardId → 枚数）を、公式と同じ並びのカードID列に展開する。
 *
 * 公式のURLは cardId 昇順で並んでいるが、先頭だけはデッキのサムネイルになるカードが
 * 1枚ぶん抜き出されて置かれている。実物のURLを解析したところサムネイルは
 * 最大の cardId（＝最新弾のカード）だったので、それに合わせる。
 * 中身は同じなので順番が違ってもデッキとしては成立するが、公式が吐くものと
 * 同じ形にしておくほうが安全。
 */
function expandCardIds(deck: Deck): readonly number[] {
  const ids: number[] = [];
  for (const [cardId, count] of deck) {
    for (let i = 0; i < count; i += 1) ids.push(cardId);
  }
  ids.sort((a, b) => a - b);

  // 末尾（最大ID）を1枚ぶんサムネイルとして先頭へ移す
  const thumbnail = ids.pop();
  if (thumbnail === undefined) return [];
  return [thumbnail, ...ids];
}

/** カードID列（枚数ぶん重複を含む）から hash を組み立てる。 */
export function buildDeckHash(cardIds: readonly number[], classId: number): string {
  if (!Number.isInteger(classId) || classId <= NEUTRAL_CLASS_ID) {
    throw new RangeError(`クラスID ${classId} ではデッキURLを作れません`);
  }
  return [UNLIMITED_FORMAT, classId, ...cardIds.map(encodeCardId)].join('.');
}

/**
 * 公式サイトでこのデッキを開くURL。40枚ちょうどでないときは null を返す。
 *
 * 公式にデッキを読み込ませるためのものなので、枚数以外（所持枚数・クラス混在）は
 * 検証しない。それらは validateDeck の担当。
 */
export function buildDeckUrl(deck: Deck, classId: number): string | null {
  if (!Number.isInteger(classId) || classId <= NEUTRAL_CLASS_ID) return null;

  const cardIds = expandCardIds(deck);
  if (cardIds.length !== DECK_SIZE) return null;
  if (cardIds.some((id) => !Number.isInteger(id) || id < 0 || id > MAX_CARD_ID)) return null;

  return `${DECK_DETAIL_URL}?hash=${buildDeckHash(cardIds, classId)}&lang=ja`;
}
