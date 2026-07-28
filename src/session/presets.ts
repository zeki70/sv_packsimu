import { findSetIdByName, latestPackSetIds, packSetIds } from '../data/cardDatabase';
import { defaultConfig, DEFAULT_PACKS_PER_SET, type SealedConfig } from './sealedSession';

export interface SealedPreset {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  /** 適用しただけでは決まらない部分の案内。null なら追加操作は不要 */
  readonly todo: string | null;
  readonly build: () => SealedConfig;
}

/** 第1弾。弾IDのハードコードを避けるため名前から引く */
const FIRST_EXPANSION_NAME = '伝説の幕開け';

function firstExpansionId(): number | undefined {
  const id = findSetIdByName(FIRST_EXPANSION_NAME);
  if (id !== undefined) return id;
  // 名前が変わった場合の保険。パック弾のうち最も古いものを使う
  return packSetIds()[0];
}

function latestSetId(): number | undefined {
  return latestPackSetIds(1)[0];
}

/**
 * The k4sen のシールド戦レギュレーション。
 *
 *   伝説の幕開け 20パック / 最新パック 20パック / 好きなパック 5パック
 *   ベーシックカード使用可
 *
 * 「好きなパック」はユーザーが選ぶものなので、ここでは 0 のままにして
 * 設定画面で5パックを足してもらう。
 */
function buildK4sen(): SealedConfig {
  const packCounts: Record<number, number> = {};
  const setIds: number[] = [];

  const first = firstExpansionId();
  const latest = latestSetId();

  for (const setId of [first, latest]) {
    if (setId === undefined) continue;
    // 第1弾が最新弾でもある場合に 20 を二重に足さない
    packCounts[setId] = 20;
    if (!setIds.includes(setId)) setIds.push(setId);
  }

  return {
    setIds: setIds.sort((a, b) => a - b),
    packCounts,
    includeBasic: true,
  };
}

export const K4SEN_ID = 'k4sen';

/** The k4sen で自分で決める「好きなパック」の枚数 */
export const K4SEN_FREE_CHOICE_PACKS = 5;

/** The k4sen の固定ぶん（伝説の幕開け20 + 最新弾20） */
const K4SEN_FIXED_PACKS = 40;

export const PRESETS: readonly SealedPreset[] = [
  {
    id: 'default',
    name: '標準',
    summary: `最新6弾を各${DEFAULT_PACKS_PER_SET}パック / ベーシックなし`,
    todo: null,
    build: defaultConfig,
  },
  {
    id: K4SEN_ID,
    name: 'The k4sen',
    summary: `伝説の幕開け20 + 最新弾20 + 好きな弾${K4SEN_FREE_CHOICE_PACKS} / ベーシックあり`,
    todo:
      `まず ${K4SEN_FIXED_PACKS} パックを開封し、その結果を見てから` +
      `好きな弾を ${K4SEN_FREE_CHOICE_PACKS} パック追加します。` +
      '追加はヘッダーの「追加で開ける」から行えます。',
    build: buildK4sen,
  },
];

/**
 * The k4sen で「好きな弾5パック」がまだ選ばれていないか。
 * 固定ぶんだけの状態なら、開封後に追加を促す。
 */
export function needsFreeChoice(presetId: string | undefined, totalPacks: number): boolean {
  return presetId === K4SEN_ID && totalPacks <= K4SEN_FIXED_PACKS;
}
