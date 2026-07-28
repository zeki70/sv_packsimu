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
  related_card_ids?: number[];
}

interface RawSpecificEffect {
  type_name?: string;
  cost?: number;
  skill_text?: string;
}

interface RawEntry {
  common?: RawCommon;
  evo?: { skill_text?: string; card_image_hash?: string };
  specific_effects?: RawSpecificEffect[];
}

interface RawPayload {
  ja: Record<string, RawEntry>;
  master?: { card_set_names?: Record<string, string> };
}

/** スキルテキストのHTMLタグを落とす（scraper の CLAUDE.md に従う） */
function stripHtml(text: string | undefined): string {
  return (text ?? '').replace(/<[^>]+>/g, '');
}

/**
 * トークンも DB に含める（詳細画面で「このカードが生成するトークン」を見せるため）。
 * ただし isToken を立てて、パック排出とデッキ構築からは必ず除外できるようにする。
 */
function toLiteCard(entry: RawEntry): LiteCard | null {
  const c = entry.common;
  if (!c) return null;
  if (c.card_set_id === undefined) return null;
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
    isToken: c.is_token === true || c.card_set_id === TOKEN_SET_ID,
  };

  const evoSkill = stripHtml(entry.evo?.skill_text);
  if (evoSkill !== '') lite.evoSkillText = evoSkill;
  if (entry.evo?.card_image_hash) lite.evoImageHash = entry.evo.card_image_hash;

  // クレスト・結晶・信仰・アクセラレート
  const effects = (entry.specific_effects ?? [])
    .filter((e) => e.type_name !== undefined && e.skill_text !== undefined)
    .map((e) => {
      const effect: { typeName: string; cost?: number; skillText: string } = {
        typeName: e.type_name!,
        skillText: stripHtml(e.skill_text),
      };
      if (e.cost !== undefined) effect.cost = e.cost;
      return effect;
    });
  if (effects.length > 0) lite.specificEffects = effects;

  if (c.related_card_ids !== undefined && c.related_card_ids.length > 0) {
    lite.relatedCardIds = c.related_card_ids;
  }

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
  const tokens = cards.filter((c) => c.isToken).length;
  const withEffects = cards.filter((c) => c.specificEffects !== undefined).length;
  const withRelated = cards.filter((c) => c.relatedCardIds !== undefined).length;

  console.log(`出力: ${OUT_FILE}`);
  console.log(`カード ${cards.length} 枚（うちトークン ${tokens} 枚）/ ${sizeKb.toFixed(0)}KB`);
  console.log(`追加効果あり ${withEffects} 枚 / 関連カードあり ${withRelated} 枚`);

  const effectTypes = new Map<string, number>();
  for (const card of cards) {
    for (const e of card.specificEffects ?? []) {
      effectTypes.set(e.typeName, (effectTypes.get(e.typeName) ?? 0) + 1);
    }
  }
  if (effectTypes.size > 0) {
    console.log(`  内訳: ${[...effectTypes].map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  }

  console.log('');
  console.log('弾別:');
  for (const [setId, count] of [...bySet].sort((a, b) => a[0] - b[0])) {
    const name = db.setNames[String(setId)] ?? '(名称不明)';
    const note =
      setId === BASIC_SET_ID
        ? '  ← ベーシック（初期所持扱い）'
        : setId === TOKEN_SET_ID
          ? '  ← トークン（閲覧のみ）'
          : '';
    console.log(`  ${setId}  ${name.padEnd(24)} ${String(count).padStart(4)}枚${note}`);
  }
}

main();
