/**
 * カード画像の縮小WebP生成スクリプト。
 *
 * shadowverse-scraper が落とした原寸PNG（530x687 / 平均562KB）を、
 * 一覧表示に必要なサイズまで縮小して public/cards/<cardId>.webp に書き出す。
 *
 * 原寸をそのまま同梱すると全1459枚で786MB あり、GitHub Pages の公開サイト
 * 1GB 制限に対して現実的でない。カード詳細の拡大表示だけは公式CDNの原寸を使う
 * （src/components/CardImage.tsx のフォールバック）。
 *
 * 事前に scraper 側で画像を用意しておくこと:
 *   cd <scraper> && node download_images.js
 *
 * Usage:
 *   npm run sync:images
 *   SV_SCRAPER_IMAGES=/path/to/images npm run sync:images
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { LiteCardDb } from '../src/data/cardTypes';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const DEFAULT_SCRAPER_IMAGES = resolve(
  PROJECT_ROOT,
  '..',
  'シャドバ',
  'shadowverse-scraper',
  'images',
);

const SOURCE_DIR = process.env['SV_SCRAPER_IMAGES'] ?? DEFAULT_SCRAPER_IMAGES;
const CARD_DB = join(PROJECT_ROOT, 'src', 'data', 'cards.json');
const OUT_DIR = join(PROJECT_ROOT, 'public', 'cards');

/** 一覧タイルの実表示幅（CSS で最大104px、Retina を考慮して2倍強） */
const TARGET_WIDTH = 300;
const WEBP_QUALITY = 80;

async function convert(sourcePath: string, outPath: string): Promise<number> {
  const buffer = await sharp(sourcePath)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  writeFileSync(outPath, buffer);
  return buffer.byteLength;
}

async function main(): Promise<void> {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`画像ディレクトリが見つかりません: ${SOURCE_DIR}`);
    console.error('scraper 側で `node download_images.js` を実行してください。');
    process.exit(1);
  }

  const db = JSON.parse(readFileSync(CARD_DB, 'utf8')) as LiteCardDb;
  mkdirSync(OUT_DIR, { recursive: true });

  let converted = 0;
  let skipped = 0;
  let missing = 0;
  let totalBytes = 0;
  const missingSets = new Map<number, number>();

  for (const card of db.cards) {
    const sourcePath = join(SOURCE_DIR, 'common', `${card.cardId}.png`);
    const outPath = join(OUT_DIR, `${card.cardId}.webp`);

    if (!existsSync(sourcePath)) {
      missing += 1;
      missingSets.set(card.setId, (missingSets.get(card.setId) ?? 0) + 1);
      continue;
    }

    // 変換済みで元画像より新しければ作り直さない
    if (existsSync(outPath) && statSync(outPath).mtimeMs >= statSync(sourcePath).mtimeMs) {
      skipped += 1;
      totalBytes += statSync(outPath).size;
      continue;
    }

    totalBytes += await convert(sourcePath, outPath);
    converted += 1;
  }

  console.log(`変換 ${converted} 枚 / スキップ ${skipped} 枚 / 元画像なし ${missing} 枚`);
  console.log(`出力先 ${OUT_DIR}`);
  console.log(`合計 ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);

  if (missing > 0) {
    console.log('');
    console.log('元画像が無い弾（scraper で download_images.js を実行してください）:');
    for (const [setId, count] of [...missingSets].sort((a, b) => a[0] - b[0])) {
      console.log(`  ${setId} ${db.setNames[String(setId)] ?? ''}  ${count}枚`);
    }
  }
}

main().catch((error: unknown) => {
  console.error('画像変換に失敗しました:', error);
  process.exit(1);
});
