import { useEffect, useState } from 'react';
import { packSetIds, setName } from '../data/cardDatabase';
import { CARDS_PER_PACK } from '../domain/rates';
import { MAX_PACKS_PER_SET, type SealedConfig } from '../session/sealedSession';

interface Props {
  readonly config: SealedConfig;
  readonly onApply: (extra: ReadonlyMap<number, number>) => void;
  readonly onClose: () => void;
}

/**
 * 追加でパックを開ける。
 *
 * 既に開封したカードはシードとパック数から決まるため、パック数を増やしても
 * 先頭の結果は変わらない。引き直しではなく純粋な追加になる。
 */
export function AddPacksModal({ config, onApply, onClose }: Props) {
  const [extra, setExtra] = useState<Record<number, number>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = (setId: number, raw: string): void => {
    const parsed = Number.parseInt(raw, 10);
    const current = config.packCounts[setId] ?? 0;
    const room = Math.max(0, MAX_PACKS_PER_SET - current);
    const value = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), room);
    setExtra({ ...extra, [setId]: value });
  };

  const addedPacks = Object.values(extra).reduce((sum, n) => sum + n, 0);

  const apply = (): void => {
    const map = new Map<number, number>();
    for (const [setId, count] of Object.entries(extra)) {
      if (count > 0) map.set(Number(setId), count);
    }
    onApply(map);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="追加でパックを開ける"
      >
        <header className="modal-header">
          <h3>追加でパックを開ける</h3>
          <span className="modal-header-actions">
            <button onClick={onClose}>閉じる</button>
          </span>
        </header>

        <p className="muted tiny">
          いま持っているカードはそのまま残り、増やしたぶんだけ新しく開封されます。
          組みかけのデッキも消えません。
        </p>

        <ul className="set-list">
          {packSetIds().map((setId) => {
            const current = config.packCounts[setId] ?? 0;
            const add = extra[setId] ?? 0;
            const room = Math.max(0, MAX_PACKS_PER_SET - current);
            return (
              <li key={setId} className={add > 0 ? 'set-row set-row--on' : 'set-row'}>
                <span className="set-label">
                  <span className="set-name">{setName(setId)}</span>
                  <span className="tiny">現在 {current} パック</span>
                </span>
                <span className="set-count">
                  ＋
                  <input
                    type="number"
                    min={0}
                    max={room}
                    value={add}
                    disabled={room === 0}
                    onChange={(e) => change(setId, e.target.value)}
                  />
                  パック
                </span>
              </li>
            );
          })}
        </ul>

        <div className="setup-footer">
          <p className="summary">
            追加 <strong>{addedPacks}</strong> パック = <strong>{addedPacks * CARDS_PER_PACK}</strong> 枚
          </p>
          <button className="primary" onClick={apply} disabled={addedPacks === 0}>
            開封する
          </button>
        </div>
      </div>
    </div>
  );
}
