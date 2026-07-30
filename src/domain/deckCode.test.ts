import { describe, it, expect } from 'vitest';
import { DECK_DETAIL_URL, buildDeckUrl, decodeCardId, encodeCardId } from './deckCode';
import { DECK_SIZE, type Deck } from './deckRules';

/**
 * 公式サイトが実際に吐いたデッキURLのハッシュ（ロイヤル40枚）。
 * これを再現できることが、このモジュールの正しさの根拠になる。
 */
const OFFICIAL_HASH =
  '2.2.fIck.cEc-.cEc-.cEpU.cEpU.cEpU.cEr2.cEr2.cEr2.cc-q.cc-q.cc-q.cc--.cc--.cc--.cd1U.cd1U.cd1U.cdEI.cdEI.cdEI.cdTc.cdTc.cdU4.cdjO.evTW.evTW.fDE-.fDE-.fDE-.fDkE.fHts.fHts.fHts.fI7e.fI7e.fI7e.fIAc.fIck.fIck';

/** 公式ハッシュから復元した「cardId → 枚数」 */
function officialDeck(): Deck {
  const deck = new Map<number, number>();
  for (const code of OFFICIAL_HASH.split('.').slice(2)) {
    const cardId = decodeCardId(code);
    deck.set(cardId, (deck.get(cardId) ?? 0) + 1);
  }
  return deck;
}

describe('encodeCardId', () => {
  it('数字 → 大文字 → 小文字 の順で値を割り当てる', () => {
    expect(encodeCardId(0)).toBe('0000');
    expect(encodeCardId(9)).toBe('0009');
    expect(encodeCardId(10)).toBe('000A');
    expect(encodeCardId(35)).toBe('000Z');
    expect(encodeCardId(36)).toBe('000a');
    expect(encodeCardId(61)).toBe('000z');
    expect(encodeCardId(62)).toBe('000-');
    expect(encodeCardId(63)).toBe('000_');
    expect(encodeCardId(64)).toBe('0010');
  });

  it('公式ハッシュのカードコードと一致する', () => {
    expect(encodeCardId(10021310)).toBe('cEc-'); // メイドの作法
    expect(encodeCardId(10824110)).toBe('fIck'); // 天命の弾丸・バニー＆バロン
  });

  it('4桁で表せないIDは受け付けない', () => {
    expect(() => encodeCardId(64 ** 4)).toThrow(RangeError);
    expect(() => encodeCardId(-1)).toThrow(RangeError);
    expect(() => encodeCardId(1.5)).toThrow(RangeError);
  });

  it('デコードで元のIDに戻る', () => {
    for (const cardId of [0, 1, 63, 64, 10021310, 10824110, 64 ** 4 - 1]) {
      expect(decodeCardId(encodeCardId(cardId))).toBe(cardId);
    }
  });
});

describe('buildDeckUrl', () => {
  it('公式が吐いたURLをそのまま再現する', () => {
    const url = buildDeckUrl(officialDeck(), 2);
    expect(url).toBe(`${DECK_DETAIL_URL}?hash=${OFFICIAL_HASH}&lang=ja`);
  });

  it('40枚ちょうどでなければ null', () => {
    // 1種そのまま抜いて40枚未満にする
    const short = new Map([...officialDeck()].slice(1));
    expect(buildDeckUrl(short, 2)).toBeNull();
    expect(buildDeckUrl(new Map(), 2)).toBeNull();
  });

  it('クラス未選択・ニュートラルでは null', () => {
    expect(buildDeckUrl(officialDeck(), 0)).toBeNull();
    expect(buildDeckUrl(officialDeck(), -1)).toBeNull();
  });

  it('フォーマットは常にアンリミテッド、クラスIDはそのまま入る', () => {
    const deck: Deck = new Map([[10021310, DECK_SIZE]]);
    const url = buildDeckUrl(deck, 7);
    expect(url).not.toBeNull();
    expect(new URL(url!).searchParams.get('hash')!.split('.').slice(0, 2)).toEqual(['2', '7']);
  });

  it('カード40枚ぶんのコードが並ぶ', () => {
    const hash = new URL(buildDeckUrl(officialDeck(), 2)!).searchParams.get('hash')!;
    const codes = hash.split('.').slice(2);
    expect(codes).toHaveLength(DECK_SIZE);
    expect(codes.map(decodeCardId).sort((a, b) => a - b)).toEqual(
      [...officialDeck()]
        .flatMap(([cardId, count]) => Array.from({ length: count }, () => cardId))
        .sort((a, b) => a - b),
    );
  });
});
