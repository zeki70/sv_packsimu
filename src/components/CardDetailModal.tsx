import { useEffect, useMemo } from 'react';
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rarity = card.rarity as Rarity;
  const tokens = useMemo(() => relatedCards(card), [card]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
      >
        <header className="modal-header">
          <h3>{card.name}</h3>
          <button onClick={onClose}>閉じる</button>
        </header>

        <div className="detail-body">
          <div className="detail-art">
            <CardImage cardId={card.cardId} imageHash={card.imageHash} name={card.name} />
          </div>

          <div className="detail-info">
            <div className="detail-stats">
              <span className="detail-cost">{card.cost}</span>
              {card.type === FOLLOWER_TYPE && (
                <span className="detail-battle">
                  {card.atk} / {card.life}
                </span>
              )}
              <span className={`detail-rarity ${RARITY_CLASS[rarity]}`}>
                {RARITY_NAME[rarity]}
              </span>
            </div>

            <dl className="detail-meta">
              <dt>クラス</dt>
              <dd>{className(card.classId)}</dd>
              <dt>タイプ</dt>
              <dd>{typeLabel(card.type)}</dd>
              <dt>カードパック</dt>
              <dd>{setName(card.setId)}</dd>
              {card.tribeNames.length > 0 && (
                <>
                  <dt>種族</dt>
                  <dd>{card.tribeNames.join('・')}</dd>
                </>
              )}
              <dt>デッキ投入上限</dt>
              <dd>{card.deckEnabledNum} 枚</dd>
              {owned !== undefined && (
                <>
                  <dt>所持</dt>
                  <dd>{owned} 枚</dd>
                </>
              )}
            </dl>

            <section className="detail-skill">
              <h4>効果</h4>
              <p>{card.skillText !== '' ? card.skillText : '（効果テキストなし）'}</p>
            </section>

            {card.evoSkillText !== undefined && card.evoSkillText !== card.skillText && (
              <section className="detail-skill">
                <h4>進化後</h4>
                <p>{card.evoSkillText}</p>
              </section>
            )}

            {/* クレスト・結晶・信仰・アクセラレート */}
            {(card.specificEffects ?? []).map((effect) => (
              <section className="detail-skill" key={`${effect.typeName}-${effect.skillText}`}>
                <h4>
                  <span className="detail-effect-label">{effect.typeName}</span>
                  {effect.cost !== undefined && `コスト ${effect.cost}`}
                </h4>
                <p>{effect.skillText}</p>
              </section>
            ))}

            {tokens.length > 0 && (
              <section className="detail-skill">
                <h4>生成されるカード</h4>
                <ul className="token-grid">
                  {tokens.map((token) => (
                    <li
                      key={token.cardId}
                      className="card-tile"
                      title={`${token.name}（${token.cost}コスト${
                        token.type === FOLLOWER_TYPE ? ` / ${token.atk}・${token.life}` : ''
                      }）\n${token.skillText}`}
                    >
                      <CardImage
                        cardId={token.cardId}
                        imageHash={token.imageHash}
                        name={token.name}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
