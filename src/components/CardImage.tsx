import { useState } from 'react';
import { cardImageUrl } from '../data/cardDatabase';

interface Props {
  readonly cardId: number;
  readonly imageHash: string;
  readonly name: string;
  readonly className?: string;
}

/**
 * カード画像。
 *
 * 同梱した縮小WebP（`public/cards/<cardId>.webp`、`npm run sync:images` で生成）を優先し、
 * 無ければ公式CDNの原寸PNGにフォールバックする。
 * 原寸は1枚あたり平均562KB あるため、一覧表示で多用しないこと。
 */
export function CardImage({ cardId, imageHash, name, className }: Props) {
  const localSrc = `${import.meta.env.BASE_URL}cards/${cardId}.webp`;
  const [src, setSrc] = useState(localSrc);

  if (imageHash === '') {
    return (
      <div className={`card-image card-image--missing ${className ?? ''}`} aria-label={name} />
    );
  }

  return (
    <img
      className={`card-image ${className ?? ''}`}
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => {
        // 同梱画像が無い場合だけ公式CDNへ切り替える（無限ループ防止のため1回だけ）
        if (src !== localSrc) return;
        setSrc(cardImageUrl(imageHash));
      }}
    />
  );
}
