/**
 * カード画像の取得と縮小WebP生成。
 *
 * 公式のカード画像は URL にハッシュ（card_image_hash）を含む。
 * バランス調整でスタッツや効果テキストが変わると画像が差し替わり、ハッシュも変わる。
 *
 * scraper 側の download_images.js は `<cardId>.png` というファイル名で保存し、
 * 「ファイルが存在すればスキップ」という判定なので、**画像が差し替わっても
 * 古いものが残り続ける**。実際に調整前の画像が混ざっていた。
 *
 * そこで生成済みWebPのハッシュを manifest に記録し、
 * ハッシュが変わったカードだけ公式から取り直す。
 *
 * Usage:
 *   npm run sync:images            # 差分だけ取得
 *   npm run sync:images -- --all   # manifest を無視して全件取り直す
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { LiteCard, LiteCardDb } from '../src/data/cardTypes';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const CARD_DB = join(PROJECT_ROOT, 'src', 'data', 'cards.json');
const OUT_DIR = join(PROJECT_ROOT, 'public', 'cards');
/** cardId → 生成時の imageHash。これで差し替えを検知する */
const MANIFEST = join(OUT_DIR, 'manifest.json');

/** 一覧タイルの実表示幅（CSS で最大104px、Retina を考慮して2倍強） */
const TARGET_WIDTH = 300;
const WEBP_QUALITY = 80;

/** 公式サーバーへの負荷を抑える。scraper と同じ水準に合わせている */
const CONCURRENCY = 5;
const DELAY_MS = 200;
const MAX_RETRY = 3;

const cardImageUrl = (hash: string): string =>
  `https://shadowverse-wb.com/uploads/card_image/jpn/card/${hash}.png`;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function readManifest(useAll: boolean): Record<string, string> {
  if (useAll || !existsSync(MANIFEST)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, string>;
  } catch {
    console.warn('manifest.json を読めませんでした。全件取り直します。');
    return {};
  }
}

async function fetchImage(hash: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(cardImageUrl(hash));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
      await sleep(DELAY_MS * attempt);
    }
  }
  throw new Error(`取得に失敗: ${cardImageUrl(hash)} (${String(lastError)})`);
}

async function buildOne(card: LiteCard): Promise<number> {
  const source = await fetchImage(card.imageHash);
  const webp = await sharp(source)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  writeFileSync(join(OUT_DIR, `${card.cardId}.webp`), webp);
  return webp.byteLength;
}

async function main(): Promise<void> {
  const useAll = process.argv.includes('--all');
  const db = JSON.parse(readFileSync(CARD_DB, 'utf8')) as LiteCardDb;
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = readManifest(useAll);

  const targets = db.cards.filter((card) => {
    if (card.imageHash === '') return false;
    const built = manifest[String(card.cardId)];
    // ハッシュが一致していて実ファイルもあるなら、取り直す必要はない
    return built !== card.imageHash || !existsSync(join(OUT_DIR, `${card.cardId}.webp`));
  });

  const refreshed = targets.filter((c) => manifest[String(c.cardId)] !== undefined).length;
  console.log(`対象 ${db.cards.length} 枚 / 取得 ${targets.length} 枚（うち差し替え ${refreshed} 枚）`);
  if (targets.length === 0) {
    console.log('すべて最新です。');
    return;
  }

  let done = 0;
  let bytes = 0;
  const failures: string[] = [];

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    // 並行実行なので、共有変数を直接加算せず戻り値で受け取る（加算が失われる）
    const results = await Promise.all(
      chunk.map(async (card) => {
        try {
          const size = await buildOne(card);
          manifest[String(card.cardId)] = card.imageHash;
          return size;
        } catch (error) {
          failures.push(`${card.cardId} ${card.name}: ${String(error)}`);
          return 0;
        }
      }),
    );
    bytes += results.reduce((sum, n) => sum + n, 0);
    done += chunk.length;

    if (i % (CONCURRENCY * 20) === 0 || i + CONCURRENCY >= targets.length) {
      const pct = Math.round((done / targets.length) * 100);
      console.log(`  ${done}/${targets.length} (${pct}%)`);
    }
    await sleep(DELAY_MS);
  }

  // 途中で失敗しても、成功したぶんは記録しておく
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 0)}\n`, 'utf8');

  console.log('');
  console.log(`生成 ${done - failures.length} 枚 / ${(bytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`出力先 ${OUT_DIR}`);

  if (failures.length > 0) {
    console.log('');
    console.error(`取得できなかったカード ${failures.length} 件:`);
    for (const f of failures.slice(0, 20)) console.error(`  ${f}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('画像生成に失敗しました:', error);
  process.exit(1);
});
