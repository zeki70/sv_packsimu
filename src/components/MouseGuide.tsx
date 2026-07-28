interface Props {
  readonly mode: 'pool' | 'builder';
}

interface Row {
  readonly key: string;
  readonly action: string;
}

const POOL_ROWS: readonly Row[] = [{ key: '右クリック', action: 'カードの詳細（スタッツ・効果）' }];

const BUILDER_ROWS: readonly Row[] = [
  { key: '左クリック', action: 'デッキに1枚追加' },
  { key: '右クリック', action: 'カードの詳細（スタッツ・効果）' },
  { key: '右側の − ＋', action: 'デッキの枚数を増減' },
];

/** マウス操作の説明。操作が画面から読み取れないので明示する。 */
export function MouseGuide({ mode }: Props) {
  const rows = mode === 'pool' ? POOL_ROWS : BUILDER_ROWS;

  return (
    <p className="mouse-guide">
      <span className="mouse-guide-title">操作</span>
      {rows.map((row) => (
        <span key={row.key} className="mouse-guide-item">
          <kbd>{row.key}</kbd>
          {row.action}
        </span>
      ))}
    </p>
  );
}
