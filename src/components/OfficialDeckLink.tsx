import { useMemo } from 'react';
import { buildDeckUrl } from '../domain/deckCode';
import type { Deck } from '../domain/deckRules';

interface Props {
  readonly deck: Deck;
  readonly classId: number;
}

/**
 * 完成したデッキを公式サイトのデッキ詳細ページで開くリンク。
 * 40枚ちょうどでないとURLを作れないので、その場合は何も出さない。
 */
export function OfficialDeckLink({ deck, classId }: Props) {
  const url = useMemo(() => buildDeckUrl(deck, classId), [deck, classId]);
  if (url === null) return null;

  return (
    <a
      className="deck-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="公式サイトのデッキ詳細ページが新しいタブで開きます"
    >
      公式サイトでこのデッキを開く
    </a>
  );
}
