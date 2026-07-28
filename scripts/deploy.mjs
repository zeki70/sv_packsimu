/**
 * gh-pages ブランチへの配信スクリプト。
 *
 * GitHub Actions を使わずに済ませているのは、認証トークンに `workflow` スコープが
 * 無いとワークフローファイルを push できないため。
 * Actions に移行する場合は `gh auth refresh -s workflow` を実行してから
 * .github/workflows/ を追加すること。
 *
 * Usage: npm run deploy
 */

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(PROJECT_ROOT, 'dist');
const BRANCH = 'gh-pages';

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function capture(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();
}

if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const remote = capture('git', ['remote', 'get-url', 'origin'], PROJECT_ROOT);
console.log(`配信先: ${remote} (${BRANCH})`);

// GitHub Pages が _ 始まりのパスを Jekyll として無視しないようにする
writeFileSync(join(DIST, '.nojekyll'), '');

// dist を使い捨てのリポジトリにして gh-pages へ強制 push する。
// 履歴を持たせないので、画像を含んでもリポジトリが肥大しない。
rmSync(join(DIST, '.git'), { recursive: true, force: true });
run('git', ['init', '-b', BRANCH], DIST);
run('git', ['add', '-A'], DIST);
run('git', ['commit', '-m', `deploy: ${new Date().toISOString()}`], DIST);
run('git', ['push', '-f', remote, BRANCH], DIST);
rmSync(join(DIST, '.git'), { recursive: true, force: true });

console.log('');
console.log(`${BRANCH} ブランチへ配信しました。`);
