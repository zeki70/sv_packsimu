import { describe, it, expect } from 'vitest';
import { PRESETS, K4SEN_FREE_CHOICE_PACKS } from './presets';
import { MAX_PACKS_PER_SET, totalPackCount, withExtraPacks } from './sealedSession';
import { findSetIdByName, latestPackSetIds, packSetIds } from '../data/cardDatabase';

const preset = (id: string) => {
  const found = PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`プリセット ${id} がありません`);
  return found;
};

describe('プリセット共通', () => {
  it('全プリセットが有効な設定を返す', () => {
    for (const p of PRESETS) {
      const config = p.build();
      expect(config.setIds.length).toBeGreaterThan(0);
      for (const setId of config.setIds) {
        expect(packSetIds()).toContain(setId);
        expect(config.packCounts[setId]).toBeGreaterThan(0);
        expect(config.packCounts[setId]).toBeLessThanOrEqual(MAX_PACKS_PER_SET);
      }
    }
  });
});

describe('The k4sen', () => {
  const config = preset('k4sen').build();

  it('伝説の幕開けが20パック', () => {
    const setId = findSetIdByName('伝説の幕開け');
    expect(setId).toBeDefined();
    expect(config.packCounts[setId!]).toBe(20);
  });

  it('最新弾が20パック', () => {
    const latest = latestPackSetIds(1)[0]!;
    expect(config.packCounts[latest]).toBe(20);
  });

  it('ベーシックカードが使える', () => {
    expect(config.includeBasic).toBe(true);
  });

  it('好きな弾のぶんは空けてある（合計40パック）', () => {
    expect(totalPackCount(config)).toBe(40);
  });

  it('好きな弾を5パック足すと合計45パックになる', () => {
    const other = packSetIds().find((id) => !config.setIds.includes(id));
    expect(other).toBeDefined();

    const withChoice = withExtraPacks(config, new Map([[other!, K4SEN_FREE_CHOICE_PACKS]]));
    expect(totalPackCount(withChoice)).toBe(45);
    expect(withChoice.packCounts[other!]).toBe(K4SEN_FREE_CHOICE_PACKS);
    expect(withChoice.setIds).toContain(other);
  });

  it('やることが残っている旨を持っている', () => {
    expect(preset('k4sen').todo).not.toBeNull();
  });

  it('公認と誤解されないよう、非公式である旨の注記を持つ', () => {
    const attribution = preset('k4sen').attribution;
    expect(attribution).not.toBeNull();
    expect(attribution).toContain('関係ありません');
  });

  it('名前に「形式」を付けて、イベントそのものと区別する', () => {
    expect(preset('k4sen').name).toContain('形式');
  });
});
