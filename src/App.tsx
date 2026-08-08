import { useEffect, useMemo, useState } from 'react';
import { SealedSetup } from './components/SealedSetup';
import { PoolView } from './components/PoolView';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckPreviewModal } from './components/DeckPreviewModal';
import { AddPacksModal } from './components/AddPacksModal';
import { needsFreeChoice } from './session/presets';
import type { Deck } from './domain/deckRules';
import type { OpenedCard } from './domain/types';
import {
  buildPoolFor,
  clearSession,
  createSession,
  loadDeck,
  loadSession,
  saveDeck,
  saveSession,
  addedOpenedCards,
  totalPackCount,
  withExtraPacks,
  type SealedConfig,
  type SealedSession,
} from './session/sealedSession';

type View = 'setup' | 'pool' | 'deck';

function restoreDeck(): { classId: number | null; deck: Deck } {
  const saved = loadDeck();
  if (saved === null) return { classId: null, deck: new Map() };
  return {
    classId: saved.classId,
    deck: new Map(Object.entries(saved.cards).map(([id, n]) => [Number(id), n])),
  };
}

export function App() {
  const [session, setSession] = useState<SealedSession | null>(loadSession);
  const [view, setView] = useState<View>(() => (loadSession() === null ? 'setup' : 'pool'));
  const [restored] = useState(restoreDeck);
  const [classId, setClassId] = useState<number | null>(restored.classId);
  const [deck, setDeck] = useState<Deck>(restored.deck);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddPacks, setShowAddPacks] = useState(false);
  /** 直前の追加開封で出たカード。次の開封や設定変更まで表示し続ける */
  const [addedCards, setAddedCards] = useState<readonly OpenedCard[]>([]);

  const deckTotal = [...deck.values()].reduce((sum, n) => sum + n, 0);

  /**
   * 画面を切り替えたら先頭に戻す。
   * 前の画面のスクロール位置が残ると、遷移先の途中から表示されて見出しが見えなくなる。
   * session も見ているのは、追加開封（プール画面のまま中身が変わる）を拾うため。
   */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view, session]);

  // プールはシードと設定から決まるので、保存せず毎回再生成する
  const poolResult = useMemo(() => (session === null ? null : buildPoolFor(session)), [session]);

  const handleStart = (config: SealedConfig, presetId: string, seed?: number): void => {
    const next = createSession(config, seed, presetId);
    saveSession(next);
    setSession(next);
    setClassId(null);
    setDeck(new Map());
    // 前のセッションの追加分が新しい開封結果に残らないようにする
    setAddedCards([]);
    setView('pool');
  };

  /**
   * 開封のやり直し。カードプールもデッキも失われるので必ず確認を挟む。
   * シードが変わるため、同じプールは二度と再現できない。
   */
  const handleReset = (): void => {
    const deckTotal = [...deck.values()].reduce((sum, n) => sum + n, 0);
    const lines = [
      '開封をやり直すと、いまのカードプールは失われます。',
      deckTotal > 0 ? `組みかけのデッキ（${deckTotal}枚）も破棄されます。` : '',
      session !== null ? `同じプールを再現したい場合は seed: ${session.seed} を控えてください。` : '',
      '',
      'やり直しますか？',
    ].filter((line) => line !== '');

    if (!window.confirm(lines.join('\n'))) return;

    clearSession();
    setSession(null);
    setClassId(null);
    setDeck(new Map());
    setAddedCards([]);
    setView('setup');
  };

  /**
   * デッキは変更のたびに自動保存する。
   * 以前は「保存」ボタンを押したときだけ localStorage に書いていたが、
   * 40枚ちょうどにならないとボタンが押せず、作りかけがリロードで消えていた。
   */
  const persistDeck = (nextClassId: number | null, nextDeck: Deck): void => {
    if (nextClassId === null) {
      saveDeck({ classId: null, cards: {} });
      return;
    }
    saveDeck({ classId: nextClassId, cards: Object.fromEntries(nextDeck) });
  };

  const handleClassChange = (nextClassId: number | null): void => {
    setClassId(nextClassId);
    persistDeck(nextClassId, nextClassId === null ? new Map() : deck);
  };

  const handleDeckChange = (nextDeck: Deck): void => {
    setDeck(nextDeck);
    persistDeck(classId, nextDeck);
  };

  /**
   * 追加開封。パック数を増やすだけなので、既に持っているカードもデッキも失われない。
   * シードは変えない（変えると先頭の開封結果まで変わってしまう）。
   */
  const handleAddPacks = (extra: ReadonlyMap<number, number>): void => {
    if (session === null || poolResult === null) return;

    const next: SealedSession = {
      ...session,
      config: withExtraPacks(session.config, extra),
    };
    // 何が増えたのかを画面で示すため、追加前後の開封結果を突き合わせる
    const added = addedOpenedCards(poolResult.openedCards, buildPoolFor(next).openedCards);

    saveSession(next);
    setSession(next);
    setAddedCards(added);
    setShowAddPacks(false);
    setView('pool');
  };

  return (
    <div className="app">
      {/* どの画面からでも触れるよう、やり直しはヘッダーに置いて固定表示する */}
      <header className="app-header">
        <h1>シャドバWB シールド戦シミュレーター</h1>
        <div className="app-header-right">
          {session !== null && (
            <span className="seed-chip" title="このシードを控えておくと同じプールを再現できます">
              seed: {session.seed}
            </span>
          )}
          {session !== null && classId !== null && (
            <button
              onClick={() => setShowPreview(true)}
              disabled={deckTotal === 0}
              title={deckTotal === 0 ? 'デッキにカードがありません' : undefined}
            >
              デッキ確認 {deckTotal > 0 && <span className="muted">({deckTotal})</span>}
            </button>
          )}
          {session !== null && (
            <button onClick={() => setShowAddPacks(true)}>追加で開ける</button>
          )}
          {session !== null && <button onClick={handleReset}>開封をやり直す</button>}
        </div>
      </header>

      <main>
        {view === 'setup' && <SealedSetup onStart={handleStart} />}

        {view === 'pool' && poolResult !== null && session !== null && (
          <PoolView
            result={poolResult}
            onBuildDeck={() => setView('deck')}
            addedCards={addedCards}
            onDismissAdded={() => setAddedCards([])}
            {...(needsFreeChoice(session.presetId, totalPackCount(session.config))
              ? {
                  notice:
                    'The k4sen 形式: この開封結果を見て、好きな弾を5パック追加してください。',
                  onAddPacks: () => setShowAddPacks(true),
                }
              : {})}
          />
        )}

        {view === 'deck' && poolResult !== null && (
          <DeckBuilder
            pool={poolResult.pool}
            classId={classId}
            deck={deck}
            onClassChange={handleClassChange}
            onDeckChange={handleDeckChange}
            onBack={() => setView('pool')}
          />
        )}

      </main>

      {/* ヘッダーから開くので、デッキ構築画面以外でも確認できる */}
      {showPreview && classId !== null && (
        <DeckPreviewModal deck={deck} classId={classId} onClose={() => setShowPreview(false)} />
      )}

      {showAddPacks && session !== null && (
        <AddPacksModal
          config={session.config}
          onApply={handleAddPacks}
          onClose={() => setShowAddPacks(false)}
        />
      )}

      <footer className="app-footer">
        <p>
          非公式のファンツールです。Cygames および Shadowverse: Worlds Beyond 運営とは関係ありません。
          カード情報・画像の権利は Cygames, Inc. に帰属します。
        </p>
        <p>
          レギュレーションの「The k4sen 形式」は、当ツールが独自に再現したものです。
          イベントおよびその運営・出演者とは一切関係ありません。
        </p>
      </footer>
    </div>
  );
}
