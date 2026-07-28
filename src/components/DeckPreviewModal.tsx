import { useEffect, useMemo } from 'react';
import type { Deck } from '../domain/deckRules';
import { DECK_SIZE } from '../domain/deckRules';
import { getCard } from '../data/cardDatabase';
import { RARITY_CLASS, className } from '../ui/labels';
import { compareCards } from '../ui/poolSort';
import type { Rarity } from '../domain/types';
import { CardImage } from './CardImage';

interface Props {
  readonly deck: Deck;
  readonly classId: number;
  readonly onClose: () => void;
}

/** デッキを画像で並べて確認するモーダル。 */
export function DeckPreviewModal({ deck, classId, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // デッキリストと同じ並び規則にそろえる
  const rows = useMemo(
    () =>
      [...deck.entries()]
        .map(([cardId, count]) => ({ cardId, count, info: getCard(cardId) }))
        .filter((row) => row.info !== undefined && row.count > 0)
        .sort((a, b) => compareCards(a.info!, b.info!)),
    [deck],
  );

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  const curve = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const row of rows) {
      const cost = Math.min(row.info!.cost, 8);
      buckets.set(cost, (buckets.get(cost) ?? 0) + row.count);
    }
    const max = Math.max(1, ...buckets.values());
    return { buckets, max };
  }, [rows]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="デッキ確認"
      >
        <header className="modal-header">
          <h3>
            デッキ確認 — {className(classId)}{' '}
            <span className={total === DECK_SIZE ? 'ok' : 'warn'}>
              {total}/{DECK_SIZE}
            </span>
          </h3>
          <button onClick={onClose}>閉じる</button>
        </header>

        <p className="notice">
          {total === DECK_SIZE
            ? 'このデッキを Shadowverse: Worlds Beyond のアプリで同じように組んで対戦してください。'
            : `あと ${DECK_SIZE - total} 枚です。40枚そろえたら、Shadowverse: Worlds Beyond のアプリで同じデッキを組んでください。`}
        </p>

        <div className="curve">
          {Array.from({ length: 9 }, (_, cost) => {
            const n = curve.buckets.get(cost) ?? 0;
            return (
              <div key={cost} className="curve-col" title={`コスト${cost === 8 ? '8+' : cost}: ${n}枚`}>
                <span className="curve-n">{n > 0 ? n : ''}</span>
                <div className="curve-bar" style={{ height: `${(n / curve.max) * 100}%` }} />
                <span className="curve-cost">{cost === 8 ? '8+' : cost}</span>
              </div>
            );
          })}
        </div>

        <ul className="preview-grid">
          {rows.map((row) => (
            <li
              key={row.cardId}
              className={`card-tile ${RARITY_CLASS[row.info!.rarity as Rarity]}`}
              // コストとカード名は画像に入っているので、ホバー時の補足だけにする
              title={`${row.info!.name}（${row.info!.cost}コスト）×${row.count}`}
            >
              <CardImage
                cardId={row.info!.cardId}
                imageHash={row.info!.imageHash}
                name={row.info!.name}
              />
              <span className="card-count">×{row.count}</span>
            </li>
          ))}
          {rows.length === 0 && <li className="muted">デッキが空です</li>}
        </ul>
      </div>
    </div>
  );
}
