import { useMemo, useState } from 'react';
import type { BuildPoolResult } from '../domain/pool';
import { Rarity } from '../domain/types';
import { getCard, setName } from '../data/cardDatabase';
import { RARITY_CLASS, RARITY_NAME, RARITY_ORDER, className } from '../ui/labels';
import { CardImage } from './CardImage';

interface Props {
  readonly result: BuildPoolResult;
  readonly onBuildDeck: () => void;
  readonly onReset: () => void;
}

export function PoolView({ result, onBuildDeck, onReset }: Props) {
  const [rarityFilter, setRarityFilter] = useState<Rarity | null>(null);

  const stats = useMemo(() => {
    const byRarity = new Map<Rarity, number>();
    let premium = 0;
    for (const card of result.openedCards) {
      byRarity.set(card.rarity, (byRarity.get(card.rarity) ?? 0) + 1);
      if (card.premium) premium += 1;
    }
    return { byRarity, premium, total: result.openedCards.length };
  }, [result]);

  const entries = useMemo(() => {
    const list = [...result.pool.values()];
    const filtered = rarityFilter === null ? list : list.filter((e) => e.card.rarity === rarityFilter);
    return filtered.sort((a, b) => {
      if (a.card.rarity !== b.card.rarity) return b.card.rarity - a.card.rarity;
      if (a.card.classId !== b.card.classId) return a.card.classId - b.card.classId;
      return a.card.cardId - b.card.cardId;
    });
  }, [result, rarityFilter]);

  return (
    <section className="pool">
      <header className="pool-header">
        <h2>カードプール</h2>
        <div className="pool-actions">
          <button onClick={onReset}>開封をやり直す</button>
          <button className="primary" onClick={onBuildDeck}>
            デッキを組む
          </button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">開封枚数</span>
        </div>
        {RARITY_ORDER.map((rarity) => (
          <div key={rarity} className={`stat ${RARITY_CLASS[rarity]}`}>
            <span className="stat-value">{stats.byRarity.get(rarity) ?? 0}</span>
            <span className="stat-label">{RARITY_NAME[rarity]}</span>
          </div>
        ))}
        <div className="stat">
          <span className="stat-value">{stats.premium}</span>
          <span className="stat-label">プレミアム</span>
        </div>
        <div className="stat">
          <span className="stat-value">{result.pool.size}</span>
          <span className="stat-label">種類</span>
        </div>
      </div>

      <div className="pity-row">
        {[...result.pityBySet].map(([setId, pity]) => (
          <span key={setId} className="pity-chip">
            {setName(setId)}: 天井まであと <strong>{Math.max(0, 10 - pity)}</strong> パック
          </span>
        ))}
      </div>

      <div className="filter-row">
        <button
          className={rarityFilter === null ? 'chip chip--on' : 'chip'}
          onClick={() => setRarityFilter(null)}
        >
          すべて
        </button>
        {RARITY_ORDER.map((rarity) => (
          <button
            key={rarity}
            className={rarityFilter === rarity ? 'chip chip--on' : 'chip'}
            onClick={() => setRarityFilter(rarity)}
          >
            {RARITY_NAME[rarity]}
          </button>
        ))}
      </div>

      <ul className="card-grid">
        {entries.map((entry) => {
          const info = getCard(entry.card.cardId);
          if (info === undefined) return null;
          return (
            <li key={entry.card.cardId} className={`card-tile ${RARITY_CLASS[entry.card.rarity]}`}>
              <CardImage cardId={info.cardId} imageHash={info.imageHash} name={info.name} />
              <span className="card-count">×{entry.count}</span>
              {entry.premiumCount > 0 && <span className="premium-badge">P</span>}
              <span className="card-name">{info.name}</span>
              <span className="card-meta">
                {info.cost} / {className(info.classId)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
