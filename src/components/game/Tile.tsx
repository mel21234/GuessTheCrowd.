'use client';

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, DoubleDownIcon, DoubleUpIcon } from '../icons';
import type { Direction, TileColor } from '@/lib/scoring';

const BG: Record<TileColor, string> = {
  correct: 'bg-correct',
  close: 'bg-close',
  miss: 'bg-miss',
};

/** The state icon. Shape alone tells the states apart: check / single arrow / double arrow. */
export function TileGlyph({ color, direction, size = 20 }: { color: TileColor; direction: Direction; size?: number }) {
  if (color === 'correct' || direction === 'none') return <CheckIcon size={size} />;
  if (color === 'close') return direction === 'up' ? <ArrowUpIcon size={size} /> : <ArrowDownIcon size={size} />;
  return direction === 'up' ? <DoubleUpIcon size={size} /> : <DoubleDownIcon size={size} />;
}

export function Tile({
  value,
  color,
  direction,
  label,
  animate = false,
  delay = 0,
  size = 'md',
}: {
  value: number | string;
  color: TileColor;
  direction: Direction;
  label?: string;
  animate?: boolean;
  delay?: number;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      className={[
        'flex items-center justify-center gap-1 rounded-xl font-extrabold text-tile-ink tnum',
        sm ? 'h-11 min-w-[72px] px-2 text-lg' : 'h-[60px] w-full text-2xl',
        BG[color],
        animate ? 'anim-flip' : '',
      ].join(' ')}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span>{value}</span>
      <TileGlyph color={color} direction={direction} size={sm ? 18 : 22} />
    </div>
  );
}

export function EmptyTile({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="h-[60px] w-full rounded-xl border-2 border-dashed border-line"
    />
  );
}
