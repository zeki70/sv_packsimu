import { useState } from 'react';
import { cardImageUrl } from '../data/cardDatabase';

interface Props {
  readonly cardId: number;
  readonly imageHash: string;
  readonly name: string;
  /**
   * full — カード画像をそのまま表示する
   * band — 枠を除いたイラスト部分を縦5分割し、その1本だけを帯として表示する（デッキ一覧用）
   */
  readonly variant?: 'full' | 'band';
  readonly className?: string;
}

/**
 * カード画像。
 *
 * 同梱した縮小WebP（`public/cards/<cardId>.webp`、`npm run sync:images` で生成）を優先し、
 * 無ければ公式CDNの原寸PNGにフォールバックする。
 * 原寸は1枚あたり平均562KB あるため、一覧表示で多用しないこと。
 */
export function CardImage({ cardId, imageHash, name, variant = 'full', className }: Props) {
  /*
   * src を state に持つと、同じ要素のまま cardId だけ差し替わったとき
   * （カード詳細でトークンに切り替えたときなど）に前のカードの画像が残る。
   * 「どの cardId でローカル画像が無かったか」を持てば、cardId が変われば自然に戻る。
   */
  const [missingLocalFor, setMissingLocalFor] = useState<number | null>(null);

  const localSrc = `${import.meta.env.BASE_URL}cards/${cardId}.webp`;
  const useCdn = missingLocalFor === cardId;
  const src = useCdn ? cardImageUrl(imageHash) : localSrc;

  if (imageHash === '') {
    const missingClass = variant === 'band' ? 'art-band art-band--missing' : 'card-image card-image--missing';
    return <div className={`${missingClass} ${className ?? ''}`} aria-label={name} />;
  }

  const img = (
    <img
      className={variant === 'band' ? 'card-image' : `card-image ${className ?? ''}`}
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => {
        // 同梱画像が無い場合だけ公式CDNへ切り替える（無限ループ防止のため1回だけ）
        if (useCdn) return;
        setMissingLocalFor(cardId);
      }}
    />
  );

  if (variant === 'band') {
    return <span className={`art-band ${className ?? ''}`}>{img}</span>;
  }
  return img;
}
