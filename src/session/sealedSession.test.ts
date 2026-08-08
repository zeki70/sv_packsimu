import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_PACKS_PER_SET,
  DEFAULT_SET_COUNT,
  MAX_PACKS_PER_SET,
  buildPoolFor,
  clearSession,
  createSession,
  defaultConfig,
  addedOpenedCards,
  loadSetup,
  saveSetup,
  totalPackCount,
  withExtraPacks,
  type SealedConfig,
  type SavedSetup,
} from './sealedSession';
import { DECK_SIZE, maxCopiesOf, validateDeck, type Deck } from '../domain/deckRules';
import { poolCardsForClass } from '../domain/pool';
import { CARDS_PER_PACK } from '../domain/rates';
import { latestPackSetIds, packSetIds } from '../data/cardDatabase';
import { CLASSES } from '../ui/labels';

describe('既定設定', () => {
  it('最新6弾 × 10パック = 60パック', () => {
    const config = defaultConfig();
    expect(config.setIds).toHaveLength(DEFAULT_SET_COUNT);
    expect(totalPackCount(config)).toBe(DEFAULT_SET_COUNT * DEFAULT_PACKS_PER_SET);
    expect(config.includeBasic).toBe(false);
  });

  it('対象弾は弾IDのハードコードではなく最新弾から決まる', () => {
    expect(defaultConfig().setIds).toEqual(latestPackSetIds(DEFAULT_SET_COUNT));
  });
});

describe('シールド戦の通し検証（実カードデータ）', () => {
  it('同じシードなら同じカードプールが再現される', () => {
    const config = defaultConfig();
    const a = buildPoolFor(createSession(config, 12345));
    const b = buildPoolFor(createSession(config, 12345));

    expect(a.openedCards).toEqual(b.openedCards);
    expect([...a.pool.keys()]).toEqual([...b.pool.keys()]);
  });

  it('シードが違えば別のプールになる', () => {
    const config = defaultConfig();
    const a = buildPoolFor(createSession(config, 1));
    const b = buildPoolFor(createSession(config, 2));
    expect(a.openedCards).not.toEqual(b.openedCards);
  });

  it('既定設定で 60パック × 8枚 = 480枚 開封される', () => {
    const result = buildPoolFor(createSession(defaultConfig(), 777));
    expect(result.openedCards).toHaveLength(
      DEFAULT_SET_COUNT * DEFAULT_PACKS_PER_SET * CARDS_PER_PACK,
    );
  });

  it('既定設定なら、どのクラスでも40枚デッキを実際に組める', () => {
    // シードを変えても成立することを確かめる
    for (const seed of [1, 99, 20260728, 555_555]) {
      const result = buildPoolFor(createSession(defaultConfig(), seed));

      for (const cls of CLASSES) {
        const entries = [...poolCardsForClass(result.pool, cls.id)].sort(
          (a, b) => a.card.cardId - b.card.cardId,
        );

        // 上限まで詰めて40枚ちょうどのデッキを作る
        const built = new Map<number, number>();
        let total = 0;
        for (const entry of entries) {
          if (total >= DECK_SIZE) break;
          const limit = maxCopiesOf(result.pool, entry.card.cardId);
          const take = Math.min(limit, DECK_SIZE - total);
          if (take <= 0) continue;
          built.set(entry.card.cardId, take);
          total += take;
        }
        const deck: Deck = built;

        const validation = validateDeck(deck, result.pool, cls.id);
        expect(
          validation.valid,
          `seed=${seed} class=${cls.name} errors=${validation.errors.join(' / ')}`,
        ).toBe(true);
      }
    }
  });

  it('ベーシックを有効にするとプールの種類が増える', () => {
    const base = defaultConfig();
    const without = buildPoolFor(createSession(base, 42));
    const withBasic = buildPoolFor(createSession({ ...base, includeBasic: true }, 42));

    expect(withBasic.pool.size).toBeGreaterThan(without.pool.size);
    // 開封結果そのものは変わらない
    expect(withBasic.openedCards).toEqual(without.openedCards);
  });

  it('パック数を増やしても、既に開封したカードは1枚も変わらない', () => {
    const base = defaultConfig();
    const before = buildPoolFor(createSession(base, 4649));

    const extra = new Map(base.setIds.map((id) => [id, 5]));
    const after = buildPoolFor(createSession(withExtraPacks(base, extra), 4649));

    // 弾ごとに、先頭の開封結果がそのまま残っている
    for (const setId of base.setIds) {
      const beforeCards = before.openedCards.filter((c) => c.setId === setId);
      const afterCards = after.openedCards.filter((c) => c.setId === setId);
      expect(afterCards.slice(0, beforeCards.length)).toEqual(beforeCards);
    }

    // 増えたぶんだけ枚数が増えている
    expect(after.openedCards).toHaveLength(
      before.openedCards.length + base.setIds.length * 5 * CARDS_PER_PACK,
    );
  });

  it('1つの弾だけ増やしても、他の弾の中身は変わらない', () => {
    const base = defaultConfig();
    const target = base.setIds[0]!;
    const before = buildPoolFor(createSession(base, 31337));
    const after = buildPoolFor(
      createSession(withExtraPacks(base, new Map([[target, 3]])), 31337),
    );

    for (const setId of base.setIds) {
      if (setId === target) continue;
      expect(after.openedCards.filter((c) => c.setId === setId)).toEqual(
        before.openedCards.filter((c) => c.setId === setId),
      );
    }
  });

  it('追加開封しても所持枚数は減らない', () => {
    const base = defaultConfig();
    const before = buildPoolFor(createSession(base, 777));
    const after = buildPoolFor(
      createSession(withExtraPacks(base, new Map(base.setIds.map((id) => [id, 2]))), 777),
    );

    for (const [cardId, entry] of before.pool) {
      expect(after.pool.get(cardId)?.count ?? 0).toBeGreaterThanOrEqual(entry.count);
    }
  });

  it('withExtraPacks は元の設定を書き換えない', () => {
    const base = defaultConfig();
    const snapshot = JSON.stringify(base);
    withExtraPacks(base, new Map([[base.setIds[0]!, 5]]));
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('追加は1弾あたりの上限を超えない', () => {
    const base = defaultConfig();
    const huge = withExtraPacks(base, new Map(base.setIds.map((id) => [id, 999])));
    for (const setId of huge.setIds) {
      expect(huge.packCounts[setId]).toBeLessThanOrEqual(MAX_PACKS_PER_SET);
    }
  });

  it('追加開封で増えたぶんだけを取り出せる', () => {
    const base = defaultConfig();
    const before = buildPoolFor(createSession(base, 20260728));

    const target = base.setIds[2]!;
    const after = buildPoolFor(
      createSession(withExtraPacks(base, new Map([[target, 4]])), 20260728),
    );

    const added = addedOpenedCards(before.openedCards, after.openedCards);

    // 追加したパック数ぶんだけ
    expect(added).toHaveLength(4 * CARDS_PER_PACK);
    // 追加した弾のカードだけ
    expect(added.every((c) => c.setId === target)).toBe(true);
    // 追加分は after の末尾（その弾の続き）と一致する
    const targetAfter = after.openedCards.filter((c) => c.setId === target);
    expect(added).toEqual(targetAfter.slice(-4 * CARDS_PER_PACK));
  });

  it('複数の弾を同時に追加しても、それぞれの増分を取り出せる', () => {
    const base = defaultConfig();
    const before = buildPoolFor(createSession(base, 555));
    const extra = new Map([
      [base.setIds[0]!, 2],
      [base.setIds[3]!, 3],
    ]);
    const after = buildPoolFor(createSession(withExtraPacks(base, extra), 555));

    const added = addedOpenedCards(before.openedCards, after.openedCards);
    expect(added).toHaveLength(5 * CARDS_PER_PACK);

    for (const [setId, packs] of extra) {
      expect(added.filter((c) => c.setId === setId)).toHaveLength(packs * CARDS_PER_PACK);
    }
  });

  it('何も追加していなければ増分は空', () => {
    const base = defaultConfig();
    const pool = buildPoolFor(createSession(base, 99));
    expect(addedOpenedCards(pool.openedCards, pool.openedCards)).toEqual([]);
  });

  it('パック数を減らすと40枚組めなくなるクラスが出る', () => {
    const config = defaultConfig();
    const tiny = {
      ...config,
      packCounts: Object.fromEntries(config.setIds.map((id) => [id, 1])),
    };
    const result = buildPoolFor(createSession(tiny, 3));

    const usable = CLASSES.map((cls) =>
      poolCardsForClass(result.pool, cls.id).reduce(
        (sum, e) => sum + Math.min(e.count, e.card.deckEnabledNum),
        0,
      ),
    );
    expect(Math.max(...usable)).toBeLessThan(DECK_SIZE);
  });
});

describe('設定画面の保存（sv_packsimu_setup）', () => {
  // vitest は environment: 'node' なので localStorage を自前で用意する
  const install = (): Map<string, string> => {
    const store = new Map<string, string>();
    const stub: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    };
    (globalThis as { localStorage?: unknown }).localStorage = stub;
    return store;
  };

  beforeEach(() => {
    install();
  });

  it('保存していなければ null（呼び出し側が既定に戻す）', () => {
    expect(loadSetup()).toBeNull();
  });

  it('保存した弾とパック数がそのまま戻る', () => {
    const config: SealedConfig = {
      setIds: [packSetIds()[0]!],
      packCounts: { [packSetIds()[0]!]: 30 },
      includeBasic: true,
    };
    saveSetup(config, 'custom');

    const saved = loadSetup();
    expect(saved?.config).toEqual(config);
    expect(saved?.presetId).toBe('custom');
  });

  it('新しい弾が追加されたら破棄する（最新弾が外れたまま開封しないため）', () => {
    saveSetup(defaultConfig(), 'default');

    // カードDBに無い弾しか知らなかった＝あとから今の弾が増えた、という状況を作る
    const stale: SavedSetup = {
      config: defaultConfig(),
      presetId: 'default',
      knownSetIds: packSetIds().slice(0, -1),
    };
    localStorage.setItem('sv_packsimu_setup', JSON.stringify(stale));

    expect(loadSetup()).toBeNull();
    expect(localStorage.getItem('sv_packsimu_setup')).toBeNull();
  });

  it('保存形式が壊れていたら破棄する', () => {
    localStorage.setItem('sv_packsimu_setup', '{"config":{"setIds":"nope"}}');
    expect(loadSetup()).toBeNull();
    expect(localStorage.getItem('sv_packsimu_setup')).toBeNull();
  });

  it('開封のやり直し（clearSession）では消えない', () => {
    saveSetup(defaultConfig(), 'default');
    clearSession();
    expect(loadSetup()).not.toBeNull();
  });
});
