import { useMemo, useState } from 'react';
import type { CardPool } from '../domain/pool';
import { poolCardsForClass } from '../domain/pool';
import { DECK_SIZE, maxCopiesOf, validateDeck, type Deck } from '../domain/deckRules';
import type { Rarity } from '../domain/types';
import { getCard } from '../data/cardDatabase';
import { CLASSES, RARITY_CLASS, className } from '../ui/labels';
import {
  TYPE_FILTER_LABELS,
  sortPoolEntries,
  typeKeyOf,
  type CardTypeKey,
} from '../ui/poolSort';
import { CardImage } from './CardImage';
import { DeckPreviewModal } from './DeckPreviewModal';
import { CardDetailModal } from './CardDetailModal';
import { MouseGuide } from './MouseGuide';
import type { LiteCard } from '../data/cardTypes';

interface Props {
  readonly pool: CardPool;
  /** クラスとデッキは App が保持する。画面を行き来しても状態がずれないようにするため */
  readonly classId: number | null;
  readonly deck: Deck;
  readonly onClassChange: (classId: number | null) => void;
  readonly onDeckChange: (deck: Deck) => void;
  readonly onBack: () => void;
  readonly onSave: (classId: number, deck: Deck) => void;
}

const COSTS = [0, 1, 2, 3, 4, 5, 6, 7] as const; // 7 は「7以上」
const TYPE_KEYS: readonly CardTypeKey[] = ['follower', 'amulet', 'spell'];

export function DeckBuilder({
  pool,
  classId,
  deck,
  onClassChange,
  onDeckChange,
  onBack,
  onSave,
}: Props) {
  const [search, setSearch] = useState('');
  const [costFilter, setCostFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<CardTypeKey | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [detailCard, setDetailCard] = useState<LiteCard | null>(null);

  const deckTotal = [...deck.values()].reduce((sum, n) => sum + n, 0);

  const available = useMemo(
    () => (classId === null ? [] : poolCardsForClass(pool, classId)),
    [pool, classId],
  );

  const visible = useMemo(() => {
    const query = search.trim();
    const filtered = available.filter((entry) => {
      const info = getCard(entry.card.cardId);
      if (info === undefined) return false;

      if (costFilter !== null) {
        const matches = costFilter === 7 ? info.cost >= 7 : info.cost === costFilter;
        if (!matches) return false;
      }
      if (typeFilter !== null && typeKeyOf(info.type) !== typeFilter) return false;
      if (query !== '' && !info.name.includes(query) && !info.skillText.includes(query)) {
        return false;
      }
      return true;
    });

    // カードプール画面と同じ並び（コスト → ニュートラル先 → フォロワー/スペル/アミュレット → ID）
    return sortPoolEntries(filtered, getCard);
  }, [available, search, costFilter, typeFilter]);

  const validation = useMemo(
    () => (classId === null ? null : validateDeck(deck, pool, classId)),
    [deck, pool, classId],
  );

  const changeCount = (cardId: number, delta: number): void => {
    const current = deck.get(cardId) ?? 0;
    const limit = maxCopiesOf(pool, cardId);
    const next = Math.min(Math.max(current + delta, 0), limit);
    if (next === current) return;

    // 既存 Map を書き換えず、新しい Map を作って差し替える
    const updated = new Map(deck);
    if (next === 0) updated.delete(cardId);
    else updated.set(cardId, next);
    onDeckChange(updated);
  };

  /**
   * クラスを変えると、いま入っているカードはそのクラスで使えなくなる。
   * 黙って持ち越すと不正なデッキが残るので、確認のうえ破棄する。
   */
  const requestClassChange = (): void => {
    if (deckTotal > 0) {
      const ok = window.confirm(
        `クラスを変えると、いま組んでいるデッキ（${deckTotal}枚）は破棄されます。よろしいですか？`,
      );
      if (!ok) return;
    }
    onDeckChange(new Map());
    onClassChange(null);
  };

  const clearDeck = (): void => {
    if (deckTotal === 0) return;
    if (!window.confirm(`デッキ（${deckTotal}枚）を空にします。よろしいですか？`)) return;
    onDeckChange(new Map());
  };

  const deckList = useMemo(
    () =>
      [...deck.entries()]
        .map(([cardId, count]) => ({ cardId, count, info: getCard(cardId) }))
        .filter((row) => row.info !== undefined)
        .sort((a, b) => a.info!.cost - b.info!.cost || a.cardId - b.cardId),
    [deck],
  );

  if (classId === null) {
    return (
      <section className="class-select">
        <h2>クラスを選ぶ</h2>
        <p className="muted">
          デッキは選んだクラス＋ニュートラルのカードだけで組みます。プールにある枚数が多いクラスほど組みやすくなります。
        </p>
        <ul className="class-grid">
          {CLASSES.map((cls) => {
            const entries = poolCardsForClass(pool, cls.id);
            const usable = entries.reduce(
              (sum, e) => sum + Math.min(e.count, e.card.deckEnabledNum),
              0,
            );
            return (
              <li key={cls.id}>
                <button
                  className={usable >= DECK_SIZE ? 'class-card' : 'class-card class-card--thin'}
                  onClick={() => onClassChange(cls.id)}
                >
                  <span className="class-name">{cls.name}</span>
                  <span className="class-count">投入可能 {usable} 枚</span>
                  {usable < DECK_SIZE && <span className="warn tiny">40枚に届きません</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button onClick={onBack}>カードプールに戻る</button>
      </section>
    );
  }

  return (
    <section className="builder">
      <header className="builder-header">
        <div>
          <h2>デッキ構築 — {className(classId)}</h2>
          <p className="muted tiny">選択クラス＋ニュートラル、開封した枚数まで、40枚ちょうど</p>
        </div>
        <div className="builder-actions">
          <button onClick={requestClassChange}>クラスを変える</button>
          <button onClick={onBack}>プールを見る</button>
          <button onClick={() => setShowPreview(true)} disabled={deckTotal === 0}>
            デッキ確認
          </button>
          <button
            className="primary"
            disabled={validation?.valid !== true}
            onClick={() => onSave(classId, deck)}
          >
            保存する
          </button>
        </div>
      </header>

      <div className="builder-body">
        <div className="pool-pane">
          <MouseGuide mode="builder" />

          {/* スクロールしても検索と絞り込みが画面に残るように固定する */}
          <div className="pool-filters">
            <div className="filter-row">
              <input
                className="search"
                type="search"
                placeholder="カード名・効果テキストで検索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="muted tiny">{visible.length} 種</span>
            </div>

            <div className="filter-row">
              <button
                className={costFilter === null ? 'chip chip--on' : 'chip'}
                onClick={() => setCostFilter(null)}
              >
                コスト全部
              </button>
              {COSTS.map((cost) => (
                <button
                  key={cost}
                  className={costFilter === cost ? 'chip chip--on' : 'chip'}
                  onClick={() => setCostFilter(costFilter === cost ? null : cost)}
                >
                  {cost === 7 ? '7+' : cost}
                </button>
              ))}
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
          </div>

          <ul className="card-grid">
            {visible.map((entry) => {
              const info = getCard(entry.card.cardId)!;
              const limit = maxCopiesOf(pool, entry.card.cardId);
              const inDeck = deck.get(entry.card.cardId) ?? 0;
              return (
                <li
                  key={entry.card.cardId}
                  className={`card-tile ${RARITY_CLASS[entry.card.rarity]} ${
                    inDeck > 0 ? 'card-tile--in-deck' : ''
                  }`}
                >
                  <button
                    className="card-hit"
                    onClick={() => changeCount(entry.card.cardId, 1)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setDetailCard(info);
                    }}
                    // コストとカード名は画像に入っているので、ホバー時の補足だけにする
                    title={`${info.name}（${info.cost}コスト / 所持 ${entry.count} 枚 / 投入上限 ${limit} 枚）\n左クリックで追加・右クリックで詳細`}
                  >
                    <CardImage cardId={info.cardId} imageHash={info.imageHash} name={info.name} />
                    <span className="card-count">
                      {inDeck}/{limit}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="deck-pane">
          <div className={deckTotal === DECK_SIZE ? 'deck-count ok' : 'deck-count'}>
            {deckTotal} / {DECK_SIZE}
          </div>
          <div className="deck-progress">
            <div
              className={deckTotal > DECK_SIZE ? 'deck-progress-bar over' : 'deck-progress-bar'}
              style={{ width: `${Math.min(100, (deckTotal / DECK_SIZE) * 100)}%` }}
            />
          </div>

          <ul className="deck-list">
            {deckList.map((row) => (
              <li
                key={row.cardId}
                className={RARITY_CLASS[row.info!.rarity as Rarity]}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setDetailCard(row.info!);
                }}
              >
                <CardImage
                  cardId={row.info!.cardId}
                  imageHash={row.info!.imageHash}
                  name={row.info!.name}
                  variant="band"
                />
                <span className="deck-cost">{row.info!.cost}</span>
                <span className="deck-name" title={row.info!.name}>
                  {row.info!.name}
                </span>
                <span className="deck-controls">
                  <button onClick={() => changeCount(row.cardId, -1)} aria-label="1枚減らす">
                    −
                  </button>
                  <span className="deck-n">{row.count}</span>
                  <button onClick={() => changeCount(row.cardId, 1)} aria-label="1枚増やす">
                    ＋
                  </button>
                </span>
              </li>
            ))}
            {deckList.length === 0 && <li className="muted">左のカードをクリックして追加します</li>}
          </ul>

          {deckTotal > 0 && (
            <button className="clear-deck" onClick={clearDeck}>
              デッキを空にする
            </button>
          )}

          {validation !== null && validation.errors.length > 0 && (
            <ul className="errors">
              {validation.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {showPreview && (
        <DeckPreviewModal deck={deck} classId={classId} onClose={() => setShowPreview(false)} />
      )}

      {detailCard !== null && (
        <CardDetailModal
          card={detailCard}
          owned={pool.get(detailCard.cardId)?.count ?? 0}
          onClose={() => setDetailCard(null)}
        />
      )}
    </section>
  );
}
