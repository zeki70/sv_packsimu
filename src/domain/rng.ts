/**
 * 乱数はすべて引数で受け取る。ドメイン関数が直接 Math.random() を呼ばないことで、
 * テストでシードを固定して排出結果を再現できるようにする。
 */
export type Rng = () => number;

/**
 * mulberry32 — 32bit シード可能な PRNG。
 * リプレイ用にシードを保存すれば同じ開封結果を再現できる。
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 本番用。テストからは使わない。 */
export const systemRng: Rng = () => Math.random();

/**
 * 1つのシードから、用途ごとに独立した副シードを作る。
 *
 * 単純な `seed ^ salt` だと salt が近いとき系列が似てしまうため、
 * murmur3 の finalizer で混ぜてから返す。
 */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (salt >>> 0), 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * 重み付き抽選。weights の合計が 1 未満でも、浮動小数の誤差で
 * どれも選ばれないことがないよう最後の要素にフォールバックする。
 */
export function pickWeighted<T extends { readonly weight: number }>(
  rng: Rng,
  entries: readonly T[],
): T {
  const last = entries[entries.length - 1];
  if (last === undefined) {
    throw new Error('pickWeighted: entries が空です');
  }

  let roll = rng();
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return last;
}

/** 一様抽選。 */
export function pickUniform<T>(rng: Rng, items: readonly T[]): T {
  const index = Math.floor(rng() * items.length);
  const picked = items[index] ?? items[items.length - 1];
  if (picked === undefined) {
    throw new Error('pickUniform: items が空です');
  }
  return picked;
}
