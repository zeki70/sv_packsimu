import { useMemo, useState } from 'react';
import type { BuildPoolResult } from '../domain/pool';
import { Rarity, NEUTRAL_CLASS_ID } from '../domain/types';
import { getCard, setName } from '../data/cardDatabase';
import { CLASSES, RARITY_CLASS, RARITY_NAME, RARITY_ORDER, className } from '../ui/labels';
import { SORT_MODE_LABELS, filterAndSortPool, type PoolSortMode } from '../ui/poolSort';
import { CardImage } from './CardImage';

interface Props {
  readonly result: BuildPoolResult;
  readonly onBuildDeck: () => void;
  readonly onReset: () => void;
}

const costOf = (cardId: number): number => getCard(cardId)?.cost ?? 0;

export function PoolView({ result, onBuildDeck, onReset }: Props) {
  const [rarityFilter, setRarityFilter] = useState<Rarity | null>(null);
  const [classFilter, setClassFilter] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<PoolSortMode>('cost');

  const stats = useMemo(() => {
    const byRarity = new Map<Rarity, number>();
    for (const card of result.openedCards) {
      byRarity.set(card.rarity, (byRarity.get(card.rarity) ?? 0) + 1);
    }
    return { byRarity, total: result.openedCards.length };
  }, [result]);

  const entries = useMemo(
    () =>
      filterAndSortPool(
        [...result.pool.values()],
        { rarity: rarityFilter, classId: classFilter },
        costOf,
        sortMode,
      ),
    [result, rarityFilter, classFilter, sortMode],
  );

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
        <span className="filter-label">並び順</span>
        {(['cost', 'rarity'] as const).map((mode) => (
          <button
            key={mode}
            className={sortMode === mode ? 'chip chip--on' : 'chip'}
            onClick={() => setSortMode(mode)}
          >
            {SORT_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <span className="filter-label">クラス</span>
        <button
          className={classFilter === null ? 'chip chip--on' : 'chip'}
          onClick={() => setClassFilter(null)}
        >
          すべて
        </button>
        <button
          className={classFilter === NEUTRAL_CLASS_ID ? 'chip chip--on' : 'chip'}
          onClick={() => setClassFilter(classFilter === NEUTRAL_CLASS_ID ? null : NEUTRAL_CLASS_ID)}
        >
          ニュートラル
        </button>
        {CLASSES.map((cls) => (
          <button
            key={cls.id}
            className={classFilter === cls.id ? 'chip chip--on' : 'chip'}
            onClick={() => setClassFilter(classFilter === cls.id ? null : cls.id)}
          >
            {cls.name}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <span className="filter-label">レアリティ</span>
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
            onClick={() => setRarityFilter(rarityFilter === rarity ? null : rarity)}
          >
            {RARITY_NAME[rarity]}
          </button>
        ))}
      </div>

      <p className="muted tiny">{entries.length} 種を表示中</p>

      <ul className="card-grid">
        {entries.map((entry) => {
          const info = getCard(entry.card.cardId);
          if (info === undefined) return null;
          return (
            <li key={entry.card.cardId} className={`card-tile ${RARITY_CLASS[entry.card.rarity]}`}>
              <CardImage cardId={info.cardId} imageHash={info.imageHash} name={info.name} />
              <span className="card-cost">{info.cost}</span>
              <span className="card-count">×{entry.count}</span>
              <span className="card-name">{info.name}</span>
              <span className="card-meta">{className(info.classId)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
