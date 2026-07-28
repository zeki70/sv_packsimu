import { useState } from 'react';
import { packSetIds, setName, generatedAt } from '../data/cardDatabase';
import {
  DEFAULT_PACKS_PER_SET,
  MAX_PACKS_PER_SET,
  defaultConfig,
  totalPackCount,
  type SealedConfig,
} from '../session/sealedSession';

interface Props {
  readonly onStart: (config: SealedConfig, seed?: number) => void;
}

export function SealedSetup({ onStart }: Props) {
  const [config, setConfig] = useState<SealedConfig>(defaultConfig);
  const [seedText, setSeedText] = useState('');

  const allSets = packSetIds();
  const selected = new Set(config.setIds);
  const total = totalPackCount(config);

  const toggleSet = (setId: number): void => {
    const next = selected.has(setId)
      ? config.setIds.filter((id) => id !== setId)
      : [...config.setIds, setId].sort((a, b) => a - b);

    setConfig({
      ...config,
      setIds: next,
      packCounts: { ...config.packCounts, [setId]: config.packCounts[setId] ?? DEFAULT_PACKS_PER_SET },
    });
  };

  const setPackCount = (setId: number, raw: string): void => {
    const parsed = Number.parseInt(raw, 10);
    const count = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), MAX_PACKS_PER_SET);
    setConfig({ ...config, packCounts: { ...config.packCounts, [setId]: count } });
  };

  const handleStart = (): void => {
    const parsed = Number.parseInt(seedText, 10);
    onStart(config, Number.isNaN(parsed) ? undefined : parsed >>> 0);
  };

  return (
    <section className="setup">
      <h2>シールド戦の設定</h2>
      <p className="muted">
        選んだ弾のパックを開封してカードプールを作ります。デッキはそのプールにあるカードだけで組みます。
      </p>

      <h3>対象の弾とパック数</h3>
      <ul className="set-list">
        {allSets.map((setId) => {
          const checked = selected.has(setId);
          return (
            <li key={setId} className={checked ? 'set-row set-row--on' : 'set-row'}>
              <label className="set-label">
                <input type="checkbox" checked={checked} onChange={() => toggleSet(setId)} />
                <span className="set-name">{setName(setId)}</span>
              </label>
              <span className="set-count">
                <input
                  type="number"
                  min={0}
                  max={MAX_PACKS_PER_SET}
                  value={config.packCounts[setId] ?? DEFAULT_PACKS_PER_SET}
                  disabled={!checked}
                  onChange={(e) => setPackCount(setId, e.target.value)}
                />
                パック
              </span>
            </li>
          );
        })}
      </ul>

      <label className="basic-toggle">
        <input
          type="checkbox"
          checked={config.includeBasic}
          onChange={(e) => setConfig({ ...config, includeBasic: e.target.checked })}
        />
        <span>
          ベーシックカードを使う
          <small className="muted">
            　ベーシックにパックは無いため、開封ではなく全種3枚をプールに追加します
          </small>
        </span>
      </label>

      <details className="seed-box">
        <summary>シードを指定して同じプールを再現する</summary>
        <input
          type="text"
          inputMode="numeric"
          placeholder="空欄ならランダム"
          value={seedText}
          onChange={(e) => setSeedText(e.target.value)}
        />
      </details>

      <div className="setup-footer">
        <p className="summary">
          {config.setIds.length}弾 / 合計 <strong>{total}</strong> パック ={' '}
          <strong>{total * 8}</strong> 枚
          {total < 20 && <span className="warn">　※40枚デッキを組むには少なすぎます</span>}
        </p>
        <button className="primary" onClick={handleStart} disabled={total === 0}>
          パックを開封する
        </button>
      </div>

      <p className="muted tiny">カードデータ生成日時: {new Date(generatedAt()).toLocaleString('ja-JP')}</p>
    </section>
  );
}
