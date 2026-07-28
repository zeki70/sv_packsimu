/**
 * カードDB同期スクリプト。
 *
 * shadowverse-scraper が出力した all_cards_master.json（1.7MB）から、
 * シールド戦シミュレーターに必要なフィールドだけを抜き出して
 * src/data/cards.json に書き出す。
 *
 * 元データの更新は scraper 側で行う:
 *   cd <scraper> && node fetch_all_cards.js
 *
 * Usage:
 *   npm run sync:cards
 *   SV_SCRAPER_DATA=/path/to/data npm run sync:cards
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LiteCard, LiteCardDb } from '../src/data/cardTypes';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const DEFAULT_SCRAPER_DATA = resolve(
  PROJECT_ROOT,
  '..',
  'シャドバ',
  'shadowverse-scraper',
  'data',
);

const SCRAPER_DATA_DIR = process.env['SV_SCRAPER_DATA'] ?? DEFAULT_SCRAPER_DATA;
const SOURCE_FILE = join(SCRAPER_DATA_DIR, 'all_cards_master.json');
const OUT_DIR = join(PROJECT_ROOT, 'src', 'data');
const OUT_FILE = join(OUT_DIR, 'cards.json');

/** ベーシック弾。パック排出ではなく初期所持として扱う */
const BASIC_SET_ID = 10000;
/** トークン置き場の擬似弾ID */
const TOKEN_SET_ID = 90000;
/** deck_enabled_num が欠けているカードの既定値 */
const DEFAULT_DECK_ENABLED_NUM = 3;

interface RawCommon {
  card_id: number;
  name: string;
  skill_text?: string;
  cost?: number;
  atk?: number;
  life?: number;
  type?: number;
  class?: number;
  rarity?: number;
  card_set_id?: number;
  is_token?: boolean;
  deck_enabled_num?: number;
  card_image_hash?: string;
  tribe_names?: string[];
}

interface RawEntry {
  common?: RawCommon;
  evo?: { skill_text?: string; card_image_hash?: string };
}

interface RawPayload {
  ja: Record<string, RawEntry>;
  master?: { card_set_names?: Record<string, string> };
}

/** スキルテキストのHTMLタグを落とす（scraper の CLAUDE.md に従う） */
function stripHtml(text: string | undefined): string {
  return (text ?? '').replace(/<[^>]+>/g, '');
}

function toLiteCard(entry: RawEntry): LiteCard | null {
  const c = entry.common;
  if (!c) return null;
  if (c.is_token === true) return null;
  if (c.card_set_id === undefined || c.card_set_id === TOKEN_SET_ID) return null;
  if (c.rarity === undefined || c.class === undefined) return null;

  const lite: LiteCard = {
    cardId: c.card_id,
    name: c.name,
    setId: c.card_set_id,
    rarity: c.rarity,
    classId: c.class,
    type: c.type ?? 1,
    cost: c.cost ?? 0,
    atk: c.atk ?? 0,
    life: c.life ?? 0,
    deckEnabledNum: c.deck_enabled_num ?? DEFAULT_DECK_ENABLED_NUM,
    skillText: stripHtml(c.skill_text),
    imageHash: c.card_image_hash ?? '',
    tribeNames: c.tribe_names ?? [],
  };

  const evoSkill = stripHtml(entry.evo?.skill_text);
  if (evoSkill !== '') lite.evoSkillText = evoSkill;
  if (entry.evo?.card_image_hash) lite.evoImageHash = entry.evo.card_image_hash;

  return lite;
}

function main(): void {
  let raw: string;
  try {
    raw = readFileSync(SOURCE_FILE, 'utf8');
  } catch {
    console.error(`カードDBが読めません: ${SOURCE_FILE}`);
    console.error('scraper 側で `node fetch_all_cards.js` を実行するか、');
    console.error('環境変数 SV_SCRAPER_DATA でデータディレクトリを指定してください。');
    process.exit(1);
    return;
  }

  const payload = JSON.parse(raw) as RawPayload;
  const cards: LiteCard[] = [];

  for (const entry of Object.values(payload.ja)) {
    const lite = toLiteCard(entry);
    if (lite !== null) cards.push(lite);
  }

  cards.sort((a, b) => a.cardId - b.cardId);

  const db: LiteCardDb = {
    generatedAt: new Date().toISOString(),
    setNames: payload.master?.card_set_names ?? {},
    cards,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(db), 'utf8');

  // レポート
  const bySet = new Map<number, number>();
  for (const card of cards) bySet.set(card.setId, (bySet.get(card.setId) ?? 0) + 1);

  const sizeKb = Buffer.byteLength(JSON.stringify(db)) / 1024;
  console.log(`出力: ${OUT_FILE}`);
  console.log(`カード ${cards.length} 枚 / ${sizeKb.toFixed(0)}KB`);
  console.log('');
  console.log('弾別:');
  for (const [setId, count] of [...bySet].sort((a, b) => a[0] - b[0])) {
    const name = db.setNames[String(setId)] ?? '(名称不明)';
    const note = setId === BASIC_SET_ID ? '  ← ベーシック（初期所持扱い）' : '';
    console.log(`  ${setId}  ${name.padEnd(24)} ${String(count).padStart(4)}枚${note}`);
  }
}

main();
