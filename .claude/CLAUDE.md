# sv_packsimu — シャドウバース ワールズビヨンド シールド戦シミュレーター

## Overview

**目的はシールド戦（Sealed）をやること。** パック開封はそのための手段。

公表排出率どおりにパックを開封してカードプールを作り、そのプールだけでデッキを構築する。
Shadowverse: Worlds Beyond に公式のシールド戦フォーマットは存在しないため、本アプリの独自ルールとして定義する（後述）。

GitHub Pages で静的ホスティングする。サーバーサイドは持たない。

## Tech Stack

| Layer      | Technology              | Notes |
|------------|-------------------------|-------|
| Language   | TypeScript              | strict 前提 |
| Build      | Vite                    | 静的ビルド → GitHub Pages |
| UI         | React                   | 姉妹プロジェクト `sv-memo` / `shadowverse-emulator` と同構成 |
| Testing    | Vitest                  | 排出ロジック・デッキ検証はユニットテスト必須 |
| Hosting    | GitHub Pages            | 公開リポジトリ。バックエンド無し（Supabase は使わない） |

> 実装済み。ドメイン層は Vitest でカバー済み。

## 参考実装（`C:\Users\hp\Desktop\folder\programing\app\シャドバ\`）

**このリポジトリのコードは、以下から移植・参考にすること。ゼロから書かない。**

| 参照元 | 使いどころ |
|---|---|
| `shadowverse-scraper/fetch_all_cards.js` | カードDBの**生成・更新**。公式サイトを Puppeteer で叩き `all_cards_master.json` を出力 |
| `shadowverse-scraper/download_images.js` | カード画像の一括ダウンロード |
| `shadowverse-scraper/data/all_cards_master.json` | カードDB本体（トークン込み826枚）。`npm run sync:cards` の入力 |
| `shadowverse-emulator/src/data/CardDatabase.ts` | カード型定義（`SVCardData` / `SVCardEntry`）と lookup。**型はここからそのまま流用する** |
| `shadowverse-emulator/src/components/DeckBuilder.tsx` | **デッキメーカーの土台**（1007行）。クラス選択・フィルタ・枚数管理・保存 |
| `shadowverse-emulator/scripts/syncCardData.ts` | pack JSON → master JSON のマージ処理 |
| `shadowverse-emulator/src/components/CardImage.tsx` | カード画像表示コンポーネント |

`shadowverse-emulator` は Supabase 前提だが、**本プロジェクトは静的サイトなので localStorage のみ**にする。
`deckService.ts` 等の Supabase 呼び出しは移植しない。DeckBuilder からその依存を外して使う。

## カードデータ仕様

### 型（emulator から流用）

```ts
SVCardEntry = { common: SVCardData, evo?: SVEvoData, specific_effects?: SpecificEffect[] }
```

### 重要フィールド

| フィールド | 意味 |
|---|---|
| `rarity` | **1=ブロンズ / 2=シルバー / 3=ゴールド / 4=レジェンド** |
| `class` | 0=ニュートラル, 1=エルフ, 2=ロイヤル, 3=ウィッチ, 4=ドラゴン, 5=ナイトメア, 6=ビショップ, 7=ネメシス |
| `type` | 1=フォロワー, 2=アミュレット, 3=カウントダウンアミュレット, 4=スペル |
| `card_set_id` | 弾ID。`master.card_set_names` で名前解決 |
| `is_token` | **true はトークン。パック排出・デッキ構築の対象外。必ず除外する** |
| `deck_enabled_num` | デッキ投入上限（通常3）。ハードコードせずこの値を使う |
| `card_image_hash` | 画像URL構築用 |

### 収録弾

| ID | 名称 | 非トークン枚数 |
|---|---|---|
| 10000 | ベーシック | 56 |
| 10001 | 伝説の幕開け | 142 |
| 10002 | インフィニティ・エボルヴ | 77 |
| 10003 | 絶傑の継承者 | 77 |
| 10004 | 蒼空の六竜 | 76 |
| 10005 | 花酔遊戯 | 76 |
| 10006 | アポカリプス・パクト | 76 |
| 10007 | 神殺し・アナテマ | 77 |
| 10008 | クロニクル・オブ・デスティニー | 78 |
| 90000 | （トークン91枚） | 対象外 |

軽量DB `src/data/cards.json` は **735枚 / 417KB**（トークン除外・フレーバーテキスト除去済み）。

> 「最新6弾」を弾IDのハードコードで書かないこと。`card_set_id` の降順から動的に決める
> （`latestPackSetIds()`）。実際、10008 を追加したときコード変更ゼロで追随できた。

## シールド戦ルール（本アプリの独自定義）

### カードプール生成

- **既定: 最新6弾 × 各10パック = 60パック**（= 480枚）
  - 10 にしているのは天井（10パック目で確定）と揃えるため。どの弾からも最低1枚レジェンドが手に入る
- 対象弾・パック数は**ユーザーが変更できる**
- **ベーシック（10000）の利用可否をユーザーが選べる**。有効時はベーシック56枚を**プールに常時追加**する
  （ベーシックはパック排出ではなく全プレイヤーが初期所持しているため、開封ではなく無償追加として扱う）
- トークン（`is_token: true` / 弾90000）は排出しない

### デッキ構築

- **40枚ちょうど**
- **1クラス + ニュートラル**のみ（構築戦と同じ）
- 同名カードは `deck_enabled_num`（通常3）まで
- **開封して実際に手に入れた枚数が上限**。4枚開封しても投入は3枚まで、1枚しか出なければ1枚まで
- **プレミアム版は扱わない**。見た目だけの違いでデッキ構築に影響しないため、ドメインから除外している
- クラスを変更するとデッキは破棄する（確認ダイアログあり）。持ち越すと不正なデッキが残るため

> 実測（20回平均）: 60パック＝480枚を開くと、1クラス+ニュートラルで**投入可能 約92枚**（最少71枚）。
> 40枚デッキに十分な余裕がある。単純なクラス比（約22%）から計算すると106枚だが、
> 同名4枚目以降が3枚上限で切り捨てられるぶん実際はこれより少なくなる。

## 排出率（`排出率画像/` から転記）

**排出率は全パック共通**。弾ごとにテーブルを分けない。

### 1パック = 8枚

**通常枠（7枚）** — 1枚ごとに独立抽選

| レアリティ | 確率 |
|---|---|
| エクスチェンジチケット（4種）→ **レジェンドとして扱う** | 0.060% |
| レジェンド | 1.500% |
| ゴールドレア | 6.000% |
| シルバーレア | 25.000% |
| ブロンズレア | 67.440% |

> `rates.ts` ではチケット枠をレジェンドの重みに合算し、`LEGEND_WEIGHT = 1.560%` として持つ。

**シルバーレア以上確定枠（1枚）**

| レアリティ | 確率 |
|---|---|
| エクスチェンジチケット（4種）→ **レジェンドとして扱う** | 0.060% |
| レジェンド | 1.500% |
| ゴールドレア | 6.000% |
| シルバーレア | 92.440% |

- **プレミアムは実装しない**。公式では各カード 8.0% でプレミアム版が出るが、デッキ構築に影響しないため扱わない
- **エクスチェンジチケット枠の扱い**: 本アプリではチケットに意味がないため、この 0.060% 枠は通常のレジェンドを排出する

### レジェンド確定保証（天井）

- **9パック連続**でレジェンドが排出されなかった場合、**10パック目**の8枚のうち1枚が必ずレジェンドになる
- 確定枠は10パック目の**8枚の中からランダムに選ばれる**。「8枚目が確定枠」という固定ではない
- レジェンドを獲得した時点でカウントは**即リセット**。まとめ買いの途中でも同様
  （例: 10パックまとめ買いで5パック目にレジェンド → 5パック目でリセット。残りは「最大あと5パック」）
- 天井カウンタは**パック単位**であり、カード単位ではない

### 実装上の注意

- カードは1枚ごとに独立抽選。「提供割合1%のカードが100枚中1枚必ず出る」仕組みではない
- 同一レアリティ内の個別カードは**等確率**とみなす（公式の個別表示率は四捨五入されており、合計が100%にならない場合がある）
- 弾をまたぐ場合、天井カウンタは**弾ごとに独立**して管理する

## カード画像

**縮小WebPを同梱 + 詳細のみ公式CDN参照**（ハイブリッド）。

実測: 公式原寸は 530×687 PNG・平均562KB。全1459枚で786MB あり、**原寸同梱は GitHub Pages の1GB上限に対して不可**。

- 一覧・デッキ構築・開封演出 → `public/cards/<cardId>.webp`（300px幅・q80）。**実測 735枚で20.6MB**
- カード詳細の拡大表示のみ → `https://shadowverse-wb.com/uploads/card_image/jpn/card/<hash>.png`
- **ファイル名は `imageHash` ではなく `cardId`**。scraper の `images/common/<cardId>.png` に合わせている
- 生成は `npm run sync:images`（sharp を使用）。元画像が無い弾はスキップして弾別に報告する
- `CardImage.tsx` はローカルWebPを先に読み、404 のときだけ1回だけCDNへフォールバックする
- **base64でJSONに埋め込まないこと**（33%肥大・ブラウザキャッシュが効かない・パースが重い）

## Project Structure

```
sv_packsimu/
├── 排出率画像/            ← 公式「カードパック詳細」画面のスクショ（排出率の一次ソース）
├── scripts/
│   ├── syncCardData.ts   ← scraper の master JSON → 軽量版に間引いて src/data/cards.json へ
│   └── buildImages.ts    ← 原寸PNG → 300px WebP 変換（sharp）
├── public/cards/         ← 縮小WebP（<cardId>.webp、735枚 20.6MB）
├── src/
│   ├── domain/           ← 純粋ロジック。React非依存・全てテスト済み
│   │   ├── types.ts      ← Rarity / PoolCard / OpenedCard / SetCardIndex
│   │   ├── rates.ts      ← 排出率・天井の定数
│   │   ├── rng.ts        ← mulberry32（シード固定可能）・重み付き抽選
│   │   ├── openPack.ts   ← パック開封（天井含む）
│   │   ├── pool.ts       ← カードプール生成（弾ごとに天井独立）
│   │   └── deckRules.ts  ← デッキ検証（40枚・クラス・所持枚数）
│   ├── data/
│   │   ├── cards.json    ← 軽量カードDB（生成物）
│   │   ├── cardTypes.ts  ← cards.json の型
│   │   └── cardDatabase.ts ← lookup / SetCardIndex 構築 / 最新弾の解決
│   ├── session/
│   │   └── sealedSession.ts ← シード＋設定の保存。プールは毎回再生成する
│   ├── components/       ← SealedSetup / PoolView / DeckBuilder / DeckPreviewModal / CardImage
│   ├── ui/               ← labels.ts（表示名）/ poolSort.ts（並び替え・絞り込み）
│   ├── App.tsx           ← setup → pool → deck のビュー遷移
│   └── styles.css
└── .claude/
```

## Dev Commands

```bash
npm install
npm run dev          # Vite dev server
npm run build        # tsc --noEmit && vite build
npm run preview
npm run typecheck
npm test             # Vitest（66テスト）

npm run sync:cards   # scraper の all_cards_master.json → src/data/cards.json
npm run sync:images  # scraper の原寸PNG → public/cards/*.webp
```

カードデータを最新にする手順:

```bash
cd ../シャドバ/shadowverse-scraper
node fetch_all_cards.js     # 公式から再取得（2-5分）
node download_images.js     # 未取得の画像だけDL
cd -
npm run sync:cards && npm run sync:images
```

## 状態管理

カードプールは**保存しない**。`{ seed, config }` だけを localStorage に持ち、
`buildPoolFor()` で毎回決定論的に再生成する。開封した全カードを保存する必要がなく、
シードを共有すれば同じプールを他人と再現できる。

- `sv_packsimu_session` — シードと開封設定
- `sv_packsimu_deck` — classId と cardId→枚数

## UI の約束事

- **コストとカード名はカード画像に描かれている**ので、タイルに重ねて表示しない。
  画像から読み取れない「枚数」だけをバッジで出す。名前は `title` 属性で補う
- **左クリックで追加、右クリックでカード詳細**（`CardDetailModal`）。
  デッキから減らすのは右ペインの `−` ボタン。操作は `MouseGuide` で画面に明示する
- 並び替えは同じボタンを再度押すと昇順・降順が入れ替わる。方向は先頭キーにだけ効かせ、
  副キーは常に昇順にして並びを安定させる
- **同コスト内の並びは「ニュートラル → 当該クラス」→「フォロワー → スペル → アミュレット」→ カードID昇順**。
  `sortPoolEntries` に実装してあり、カードプール画面とデッキ構築画面で共有する
  （デッキ構築側は検索やコスト帯の絞り込みを自前で行ってから `sortPoolEntries` に渡す）
- カードタイプの判定は `poolSort.typeKeyOf` に集約する（`labels.typeLabel` もこれを使う）
- デッキ構築中は検索・絞り込みを `position: sticky` で画面に残す（`.pool-filters`）
- 進化後のスタッツはスクレイプ元に存在しない。詳細画面に出せるのは進化時テキストまで

## テスト方針

`src/domain/` は純関数なので、乱数をシード固定して**排出率が公表値に収束すること**まで検証している。
特に守るべき不変条件:

- 1パックちょうど8枚、8枚目はシルバー以上（ブロンズが出たらバグ）
- 天井カウントが弾ごとに独立（`pityBySet` が弾ごとにエントリを持つ）
- 10パック以内に必ずレジェンドが出る
- 既定設定（60パック）で全7クラスが実際に40枚デッキを組める

> **排出率を測るテストでは天井を発動させないこと**（常に `pity=0` で開ける）。
> 天井パックは「レジェンドが出なかったパック」だけなので、それを標本から除外すると
> レジェンド率が上振れする。実際にこの偏りで 1.56% が 1.65% に見えた。

## Conventions

- **イミュータブル**: 開封結果・プール・デッキは新しいオブジェクトを返して更新する。`push` で破壊しない
- **乱数の注入**: 抽選関数は RNG を引数で受け取る（`(rng: () => number) => Card`）。関数内で直接 `Math.random()` を呼ばない。テストでシード固定するため
- **ドメインとUIの分離**: 排出・プール・デッキ検証は `src/domain/` の純関数。React に依存させない
- **トークン除外**: カードを列挙する箇所では必ず `!is_token` でフィルタする（emulator も同じ実装）
- **弾IDのハードコード禁止**: `card_set_id` の降順から動的に決める
- 日本語コメントは可（ゲーム用語のため）
- ファイルは 200–400 行を目安に分割

## GitHub Pages / SEO

- Vite の `base` はリポジトリ名に合わせる（`base: '/sv_packsimu/'`）。独自ドメイン使用時のみ `'/'`
- SPA なので **`index.html` に title / meta description / 説明文を静的に埋め込む**こと
- 公開後は Google Search Console に登録し `sitemap.xml` を置く
- 公開サイト1GB・帯域100GB/月がソフト上限。画像を増やすときは必ずこれを意識する

## Notes

- 非公式ファンツール。Cygames の公式サイトではない旨を UI に明記する
- 排出率が改定されたら `排出率画像/` にスクショを追加し、`src/domain/rates.ts` を更新する
