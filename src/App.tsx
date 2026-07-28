import { useMemo, useState } from 'react';
import { SealedSetup } from './components/SealedSetup';
import { PoolView } from './components/PoolView';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckPreviewModal } from './components/DeckPreviewModal';
import type { Deck } from './domain/deckRules';
import {
  buildPoolFor,
  clearSession,
  createSession,
  loadDeck,
  loadSession,
  saveDeck,
  saveSession,
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

  const deckTotal = [...deck.values()].reduce((sum, n) => sum + n, 0);

  // プールはシードと設定から決まるので、保存せず毎回再生成する
  const poolResult = useMemo(() => (session === null ? null : buildPoolFor(session)), [session]);

  const handleStart = (config: SealedConfig, seed?: number): void => {
    const next = createSession(config, seed);
    saveSession(next);
    setSession(next);
    setClassId(null);
    setDeck(new Map());
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
          {session !== null && <button onClick={handleReset}>開封をやり直す</button>}
        </div>
      </header>

      <main>
        {view === 'setup' && <SealedSetup onStart={handleStart} />}

        {view === 'pool' && poolResult !== null && (
          <PoolView result={poolResult} onBuildDeck={() => setView('deck')} />
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

      <footer className="app-footer">
        <p>
          非公式のファンツールです。Cygames および Shadowverse: Worlds Beyond 運営とは関係ありません。
          カード情報・画像の権利は Cygames, Inc. に帰属します。
        </p>
      </footer>
    </div>
  );
}
