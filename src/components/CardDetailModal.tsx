import { useEffect, useMemo, useState } from 'react';
import type { LiteCard } from '../data/cardTypes';
import { relatedCards, setName } from '../data/cardDatabase';
import { RARITY_NAME, RARITY_CLASS, className, typeLabel } from '../ui/labels';
import type { Rarity } from '../domain/types';
import { CardImage } from './CardImage';

interface Props {
  readonly card: LiteCard;
  /** カードプールでの所持枚数。分からない場合は省略 */
  readonly owned?: number;
  readonly onClose: () => void;
}

const FOLLOWER_TYPE = 1;

/** 右クリックで開くカード詳細。スタッツと効果テキストを表示する。 */
export function CardDetailModal({ card, owned, onClose }: Props) {
  // 生成されるトークンをクリックしたら、そのカードの詳細に切り替える
  const [viewing, setViewing] = useState<LiteCard>(card);
  useEffect(() => setViewing(card), [card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tokens = useMemo(() => relatedCards(viewing), [viewing]);
  const rarity = viewing.rarity as Rarity;
  const isRoot = viewing.cardId === card.cardId;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={viewing.name}
      >
        <header className="modal-header">
          <h3>
            {viewing.isToken && <span className="detail-effect-label">トークン</span>}
            {viewing.name}
          </h3>
          <span className="modal-header-actions">
            {!isRoot && <button onClick={() => setViewing(card)}>← {card.name}</button>}
            <button onClick={onClose}>閉じる</button>
          </span>
        </header>

        <div className="detail-body">
          <div className="detail-art">
            <CardImage
              cardId={viewing.cardId}
              imageHash={viewing.imageHash}
              name={viewing.name}
            />
          </div>

          <div className="detail-info">
            <div className="detail-stats">
              <span className="detail-cost">{viewing.cost}</span>
              {viewing.type === FOLLOWER_TYPE && (
                <span className="detail-battle">
                  {viewing.atk} / {viewing.life}
                </span>
              )}
              <span className={`detail-rarity ${RARITY_CLASS[rarity]}`}>{RARITY_NAME[rarity]}</span>
            </div>

            <dl className="detail-meta">
              <dt>クラス</dt>
              <dd>{className(viewing.classId)}</dd>
              <dt>タイプ</dt>
              <dd>{typeLabel(viewing.type)}</dd>
              {!viewing.isToken && (
                <>
                  <dt>カードパック</dt>
                  <dd>{setName(viewing.setId)}</dd>
                </>
              )}
              {viewing.tribeNames.length > 0 && (
                <>
                  <dt>種族</dt>
                  <dd>{viewing.tribeNames.join('・')}</dd>
                </>
              )}
              {!viewing.isToken && (
                <>
                  <dt>デッキ投入上限</dt>
                  <dd>{viewing.deckEnabledNum} 枚</dd>
                </>
              )}
              {owned !== undefined && isRoot && !viewing.isToken && (
                <>
                  <dt>所持</dt>
                  <dd>{owned} 枚</dd>
                </>
              )}
            </dl>

            <section className="detail-skill">
              <h4>効果</h4>
              <p>{viewing.skillText !== '' ? viewing.skillText : '（効果テキストなし）'}</p>
            </section>

            {viewing.evoSkillText !== undefined && viewing.evoSkillText !== viewing.skillText && (
              <section className="detail-skill">
                <h4>進化後</h4>
                <p>{viewing.evoSkillText}</p>
              </section>
            )}

            {/* クレスト・結晶・信仰・アクセラレート。クレストと信仰はコストを持たない */}
            {(viewing.specificEffects ?? []).map((effect) => (
              <section className="detail-skill" key={`${effect.typeName}-${effect.skillText}`}>
                <h4>
                  <span className="detail-effect-label">{effect.typeName}</span>
                  {effect.cost !== undefined && effect.cost > 0 && `コスト ${effect.cost}`}
                </h4>
                <p>{effect.skillText}</p>
              </section>
            ))}

            {tokens.length > 0 && (
              <section className="detail-skill">
                <h4>生成されるカード</h4>
                <ul className="token-grid">
                  {tokens.map((token) => (
                    <li key={token.cardId} className="card-tile">
                      <button
                        className="card-hit"
                        onClick={() => setViewing(token)}
                        title={`${token.name} の効果を見る`}
                      >
                        <CardImage
                          cardId={token.cardId}
                          imageHash={token.imageHash}
                          name={token.name}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="muted tiny">カードをクリックすると効果を読めます</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
