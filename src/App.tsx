import { useMemo, useState } from 'react';
import { SealedSetup } from './components/SealedSetup';
import { PoolView } from './components/PoolView';
import { DeckBuilder } from './components/DeckBuilder';
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
  const [savedAt, setSavedAt] = useState<string | null>(null);

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

  const handleReset = (): void => {
    clearSession();
    setSession(null);
    setClassId(null);
    setDeck(new Map());
    setView('setup');
  };

  const handleSave = (nextClassId: number, nextDeck: Deck): void => {
    setClassId(nextClassId);
    setDeck(nextDeck);
    saveDeck({ classId: nextClassId, cards: Object.fromEntries(nextDeck) });
    setSavedAt(new Date().toLocaleTimeString('ja-JP'));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>シャドバWB シールド戦シミュレーター</h1>
        {session !== null && (
          <span className="seed-chip" title="このシードを控えておくと同じプールを再現できます">
            seed: {session.seed}
          </span>
        )}
      </header>

      <main>
        {view === 'setup' && <SealedSetup onStart={handleStart} />}

        {view === 'pool' && poolResult !== null && (
          <PoolView
            result={poolResult}
            onBuildDeck={() => setView('deck')}
            onReset={handleReset}
          />
        )}

        {view === 'deck' && poolResult !== null && (
          <DeckBuilder
            pool={poolResult.pool}
            classId={classId}
            deck={deck}
            onClassChange={setClassId}
            onDeckChange={setDeck}
            onBack={() => setView('pool')}
            onSave={handleSave}
          />
        )}

        {savedAt !== null && <p className="toast">デッキを保存しました（{savedAt}）</p>}
      </main>

      <footer className="app-footer">
        <p>
          非公式のファンツールです。Cygames および Shadowverse: Worlds Beyond 運営とは関係ありません。
          カード情報・画像の権利は Cygames, Inc. に帰属します。
        </p>
      </footer>
    </div>
  );
}
