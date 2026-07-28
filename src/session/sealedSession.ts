import { buildPool, type BuildPoolResult } from '../domain/pool';
import { deriveSeed, mulberry32 } from '../domain/rng';
import {
  basicPoolCards,
  buildSetIndex,
  latestPackSetIds,
} from '../data/cardDatabase';

/** 既定で対象にする弾数 */
export const DEFAULT_SET_COUNT = 6;
/**
 * 既定の1弾あたりパック数。
 *
 * 10 にしてあるのは天井（9パック連続でレジェンド無し → 10パック目で確定）と
 * 揃えるため。どの弾からも最低1枚はレジェンドが手に入る。
 */
export const DEFAULT_PACKS_PER_SET = 10;
/** 1弾あたりに指定できるパック数の上限（開封演出とメモリの現実的な上限） */
export const MAX_PACKS_PER_SET = 100;

const SESSION_KEY = 'sv_packsimu_session';
const DECK_KEY = 'sv_packsimu_deck';

export interface SealedConfig {
  readonly setIds: readonly number[];
  /** setId → パック数 */
  readonly packCounts: Readonly<Record<number, number>>;
  readonly includeBasic: boolean;
}

export interface SealedSession {
  /** 同じシードなら同じカードプールが再現される */
  readonly seed: number;
  readonly config: SealedConfig;
  readonly createdAt: string;
  /** 適用したレギュレーション。開封後の案内を出し分けるために持つ */
  readonly presetId?: string;
}

export interface SavedDeck {
  /** クラス未選択の状態も保存する（デッキを破棄した直後など） */
  readonly classId: number | null;
  /** cardId → 投入枚数 */
  readonly cards: Readonly<Record<number, number>>;
}

export function defaultConfig(): SealedConfig {
  const setIds = latestPackSetIds(DEFAULT_SET_COUNT);
  return {
    setIds,
    packCounts: Object.fromEntries(setIds.map((id) => [id, DEFAULT_PACKS_PER_SET])),
    includeBasic: false,
  };
}

export function createSession(
  config: SealedConfig,
  seed?: number,
  presetId?: string,
): SealedSession {
  const session: SealedSession = {
    seed: seed ?? Math.floor(Math.random() * 0xffffffff),
    config,
    createdAt: new Date().toISOString(),
  };
  return presetId === undefined ? session : { ...session, presetId };
}

/**
 * セッションからカードプールを再生成する。
 * シードと設定さえ保存しておけば、開封した全カードを保存しなくても完全に再現できる。
 */
export function buildPoolFor(session: SealedSession): BuildPoolResult {
  const { setIds, packCounts, includeBasic } = session.config;
  return buildPool({
    indexes: setIds.map(buildSetIndex),
    packCounts: new Map(setIds.map((id) => [id, packCounts[id] ?? 0])),
    includeBasic,
    basicCards: basicPoolCards(),
    // 弾ごとに副シードを作る。あとからパック数を増やしても既存分は変わらない
    rngFor: (setId) => mulberry32(deriveSeed(session.seed, setId)),
  });
}

/**
 * 追加開封。指定した弾のパック数を増やした設定を返す。
 *
 * 既に開封したカードはシードとパック数から決まるので、増やしても先頭は同じ結果になる。
 * つまり「引き直し」ではなく純粋な追加になる。
 */
export function withExtraPacks(
  config: SealedConfig,
  extra: ReadonlyMap<number, number>,
): SealedConfig {
  const packCounts = { ...config.packCounts };
  const setIds = [...config.setIds];

  for (const [setId, count] of extra) {
    if (count <= 0) continue;
    const next = Math.min((packCounts[setId] ?? 0) + count, MAX_PACKS_PER_SET);
    packCounts[setId] = next;
    if (!setIds.includes(setId)) setIds.push(setId);
  }

  return { ...config, setIds: setIds.sort((a, b) => a - b), packCounts };
}

export function totalPackCount(config: SealedConfig): number {
  return config.setIds.reduce((sum, id) => sum + (config.packCounts[id] ?? 0), 0);
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`${key} の読み込みに失敗しました。保存データを破棄します。`, error);
    localStorage.removeItem(key);
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 容量超過やプライベートモードでも操作自体は続行できるようにする
    console.warn(`${key} の保存に失敗しました。`, error);
  }
}

export function loadSession(): SealedSession | null {
  const session = readJson<SealedSession>(SESSION_KEY);
  if (session === null) return null;
  if (typeof session.seed !== 'number' || !Array.isArray(session.config?.setIds)) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export const saveSession = (session: SealedSession): void => writeJson(SESSION_KEY, session);
export const loadDeck = (): SavedDeck | null => readJson<SavedDeck>(DECK_KEY);
export const saveDeck = (deck: SavedDeck): void => writeJson(DECK_KEY, deck);

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DECK_KEY);
}
