import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PACKS_PER_SET,
  DEFAULT_SET_COUNT,
  buildPoolFor,
  createSession,
  defaultConfig,
  totalPackCount,
} from './sealedSession';
import { DECK_SIZE, maxCopiesOf, validateDeck, type Deck } from '../domain/deckRules';
import { poolCardsForClass } from '../domain/pool';
import { CARDS_PER_PACK } from '../domain/rates';
import { latestPackSetIds } from '../data/cardDatabase';
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
