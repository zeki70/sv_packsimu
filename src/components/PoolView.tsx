import { useMemo, useState } from 'react';
import type { BuildPoolResult } from '../domain/pool';
import { Rarity, NEUTRAL_CLASS_ID } from '../domain/types';
import { getCard, setName } from '../data/cardDatabase';
import type { LiteCard } from '../data/cardTypes';
import { CLASSES, RARITY_CLASS, RARITY_NAME, RARITY_ORDER, className } from '../ui/labels';
import {
  DEFAULT_DIRECTION,
  SORT_MODE_LABELS,
  TYPE_FILTER_LABELS,
  filterAndSortPool,
  type CardTypeKey,
  type PoolSort,
  type PoolSortMode,
} from '../ui/poolSort';
import { CardImage } from './CardImage';
import { CardDetailModal } from './CardDetailModal';
import { MouseGuide } from './MouseGuide';

interface Props {
  readonly result: BuildPoolResult;
  readonly onBuildDeck: () => void;
  readonly onReset: () => void;
}

const lookup = (cardId: number): LiteCard | undefined => getCard(cardId);

const SORT_MODES: readonly PoolSortMode[] = ['cost', 'rarity'];
const TYPE_KEYS: readonly CardTypeKey[] = ['follower', 'amulet', 'spell'];

export function PoolView({ result, onBuildDeck, onReset }: Props) {
  const [rarityFilter, setRarityFilter] = useState<Rarity | null>(null);
  const [classFilter, setClassFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<CardTypeKey | null>(null);
  const [sort, setSort] = useState<PoolSort>({ mode: 'cost', direction: 'asc' });
  const [detailCard, setDetailCard] = useState<LiteCard | null>(null);

  /** 同じ並び順をもう一度押したら昇順・降順を反転する */
  const changeSort = (mode: PoolSortMode): void => {
    setSort((prev) =>
      prev.mode === mode
        ? { mode, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { mode, direction: DEFAULT_DIRECTION[mode] },
    );
  };

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
        { rarity: rarityFilter, classId: classFilter, type: typeFilter },
        lookup,
        sort,
      ),
    [result, rarityFilter, classFilter, typeFilter, sort],
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

      <MouseGuide mode="pool" />

      <div className="filter-row">
        <span className="filter-label">並び順</span>
        {SORT_MODES.map((mode) => (
          <button
            key={mode}
            className={sort.mode === mode ? 'chip chip--on' : 'chip'}
            onClick={() => changeSort(mode)}
            title={sort.mode === mode ? 'もう一度押すと昇順・降順が入れ替わります' : undefined}
          >
            {SORT_MODE_LABELS[mode]}
            {sort.mode === mode && (
              <span className="sort-arrow">{sort.direction === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>
        ))}
        <span className="muted tiny">
          {sort.mode === 'cost'
            ? sort.direction === 'asc'
              ? '低コスト順'
              : '高コスト順'
            : sort.direction === 'desc'
              ? 'レジェンドが先'
              : 'ブロンズが先'}
        </span>
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
        <span className="filter-label">タイプ</span>
        <button
          className={typeFilter === null ? 'chip chip--on' : 'chip'}
          onClick={() => setTypeFilter(null)}
        >
          すべて
        </button>
        {TYPE_KEYS.map((key) => (
          <button
            key={key}
            className={typeFilter === key ? 'chip chip--on' : 'chip'}
            onClick={() => setTypeFilter(typeFilter === key ? null : key)}
          >
            {TYPE_FILTER_LABELS[key]}
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
            <li
              key={entry.card.cardId}
              className={`card-tile ${RARITY_CLASS[entry.card.rarity]}`}
              // コストとカード名は画像に入っているので、ホバー時の補足だけにする
              title={`${info.name}（${info.cost}コスト / ${className(info.classId)}）×${entry.count}\n右クリックで詳細`}
              onContextMenu={(e) => {
                e.preventDefault();
                setDetailCard(info);
              }}
            >
              <CardImage cardId={info.cardId} imageHash={info.imageHash} name={info.name} />
              <span className="card-count">×{entry.count}</span>
            </li>
          );
        })}
      </ul>

      {detailCard !== null && (
        <CardDetailModal
          card={detailCard}
          owned={result.pool.get(detailCard.cardId)?.count ?? 0}
          onClose={() => setDetailCard(null)}
        />
      )}
    </section>
  );
}
