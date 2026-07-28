import { useMemo, useState } from 'react';
import type { CardPool } from '../domain/pool';
import { poolCardsForClass } from '../domain/pool';
import { DECK_SIZE, maxCopiesOf, validateDeck, type Deck } from '../domain/deckRules';
import { getCard } from '../data/cardDatabase';
import { CLASSES, RARITY_CLASS, className, typeKey, typeLabel } from '../ui/labels';
import { CardImage } from './CardImage';

interface Props {
  readonly pool: CardPool;
  readonly initialClassId: number | null;
  readonly initialDeck: Deck;
  readonly onBack: () => void;
  readonly onSave: (classId: number, deck: Deck) => void;
}

const COSTS = [0, 1, 2, 3, 4, 5, 6, 7] as const; // 7 は「7以上」
const TYPE_FILTERS = ['follower', 'amulet', 'spell'] as const;

export function DeckBuilder({ pool, initialClassId, initialDeck, onBack, onSave }: Props) {
  const [classId, setClassId] = useState<number | null>(initialClassId);
  const [deck, setDeck] = useState<Deck>(initialDeck);
  const [search, setSearch] = useState('');
  const [costFilter, setCostFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [ownedOnly, setOwnedOnly] = useState(true);

  const available = useMemo(
    () => (classId === null ? [] : poolCardsForClass(pool, classId)),
    [pool, classId],
  );

  const visible = useMemo(() => {
    const query = search.trim();
    return available
      .filter((entry) => {
        const info = getCard(entry.card.cardId);
        if (info === undefined) return false;

        if (costFilter !== null) {
          const matches = costFilter === 7 ? info.cost >= 7 : info.cost === costFilter;
          if (!matches) return false;
        }
        if (typeFilter !== null && typeKey(info.type) !== typeFilter) return false;
        if (query !== '' && !info.name.includes(query) && !info.skillText.includes(query)) {
          return false;
        }
        if (ownedOnly && maxCopiesOf(pool, entry.card.cardId) === 0) return false;
        return true;
      })
      .sort((a, b) => {
        const ai = getCard(a.card.cardId)!;
        const bi = getCard(b.card.cardId)!;
        if (ai.cost !== bi.cost) return ai.cost - bi.cost;
        if (a.card.rarity !== b.card.rarity) return b.card.rarity - a.card.rarity;
        return a.card.cardId - b.card.cardId;
      });
  }, [available, pool, search, costFilter, typeFilter, ownedOnly]);

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
    setDeck(updated);
  };

  const deckTotal = [...deck.values()].reduce((sum, n) => sum + n, 0);

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
                  onClick={() => setClassId(cls.id)}
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
          <button onClick={() => setClassId(null)}>クラスを変える</button>
          <button onClick={onBack}>プールを見る</button>
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
          <div className="filter-row">
            <input
              className="search"
              type="search"
              placeholder="カード名・効果テキストで検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={ownedOnly}
                onChange={(e) => setOwnedOnly(e.target.checked)}
              />
              所持しているカードだけ
            </label>
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
            {TYPE_FILTERS.map((key) => (
              <button
                key={key}
                className={typeFilter === key ? 'chip chip--on' : 'chip'}
                onClick={() => setTypeFilter(typeFilter === key ? null : key)}
              >
                {typeLabel(key === 'follower' ? 1 : key === 'amulet' ? 2 : 4)}
              </button>
            ))}
          </div>

          <p className="muted tiny">{visible.length} 種を表示中</p>

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
                      changeCount(entry.card.cardId, -1);
                    }}
                    title={`${info.name}（所持 ${entry.count} 枚 / 投入上限 ${limit} 枚）`}
                  >
                    <CardImage cardId={info.cardId} imageHash={info.imageHash} name={info.name} />
                    <span className="card-cost">{info.cost}</span>
                    <span className="card-count">
                      {inDeck}/{limit}
                    </span>
                    {entry.premiumCount > 0 && <span className="premium-badge">P</span>}
                    <span className="card-name">{info.name}</span>
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

          <ul className="deck-list">
            {deckList.map((row) => (
              <li key={row.cardId} className={RARITY_CLASS[row.info!.rarity as 1 | 2 | 3 | 4]}>
                <span className="deck-cost">{row.info!.cost}</span>
                <span className="deck-name">{row.info!.name}</span>
                <span className="deck-controls">
                  <button onClick={() => changeCount(row.cardId, -1)}>−</button>
                  <span className="deck-n">{row.count}</span>
                  <button onClick={() => changeCount(row.cardId, 1)}>＋</button>
                </span>
              </li>
            ))}
            {deckList.length === 0 && <li className="muted">左のカードをクリックして追加します</li>}
          </ul>

          {validation !== null && validation.errors.length > 0 && (
            <ul className="errors">
              {validation.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
