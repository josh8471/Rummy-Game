import type { GameAccent, GameId } from '@casino/shared';
import { ROULETTE_WHEEL, rouletteColor } from '@casino/shared';
import { cn, useSvgId } from '../lib/format';

const ACCENT: Record<GameAccent, [string, string]> = {
  gold: ['#3b2a06', '#120c02'],
  ruby: ['#4a0d18', '#16050a'],
  emerald: ['#0b4a33', '#03170f'],
  violet: ['#2e1655', '#0e0620'],
  amber: ['#4a2a07', '#170d02'],
  sky: ['#0b3350', '#030f19'],
  rose: ['#4a1030', '#16040d'],
};

function SvgCard({ x, y, rank, suit, rotate = 0, scale = 1 }: { x: number; y: number; rank: string; suit: string; rotate?: number; scale?: number }) {
  const red = suit === '♥' || suit === '♦';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <rect x={-26} y={-37} width={52} height={74} rx={6} fill="#fbfbfd" stroke="#00000022" />
      <text x={-20} y={-20} fontSize={14} fontWeight={700} fill={red ? '#c81e3a' : '#111827'} fontFamily="Outfit Variable, sans-serif">
        {rank}
      </text>
      <text x={0} y={12} fontSize={26} textAnchor="middle" fill={red ? '#c81e3a' : '#111827'}>
        {suit}
      </text>
    </g>
  );
}

function Die({ x, y, pips, size = 54, rotate = 0 }: { x: number; y: number; pips: number; size?: number; rotate?: number }) {
  const p = size / 4;
  const spots: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-p, -p], [p, p]],
    3: [[-p, -p], [0, 0], [p, p]],
    4: [[-p, -p], [p, -p], [-p, p], [p, p]],
    5: [[-p, -p], [p, -p], [0, 0], [-p, p], [p, p]],
    6: [[-p, -p], [p, -p], [-p, 0], [p, 0], [-p, p], [p, p]],
  };
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size / 5} fill="#f8fafc" stroke="#0000001f" />
      {spots[pips]!.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r={size / 11} fill={pips === 1 ? '#d12e3f' : '#0f172a'} />
      ))}
    </g>
  );
}

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const n = ROULETTE_WHEEL.length;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r + 8} fill="#b98510" />
      <circle r={r + 5} fill="#2a1a05" />
      {ROULETTE_WHEEL.map((num, i) => {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
        const color = rouletteColor(num);
        const fill = color === 'GREEN' ? '#14935a' : color === 'RED' ? '#d12e3f' : '#1b2130';
        return (
          <path
            key={num}
            d={`M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`}
            fill={fill}
          />
        );
      })}
      <circle r={r * 0.55} fill="#3a2608" stroke="#e5a91a" strokeWidth={3} />
      <circle r={r * 0.18} fill="#f7c948" />
      <circle cx={r * 0.72} cy={-r * 0.35} r={5} fill="#fff" />
    </g>
  );
}

function Art({ gameId }: { gameId: GameId }) {
  switch (gameId) {
    case 'slots':
      return (
        <g>
          <rect x={70} y={34} width={180} height={112} rx={18} fill="#1a1204" stroke="#e5a91a" strokeWidth={3} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={84 + i * 56} y={48} width={48} height={84} rx={8} fill="#fdf7e3" />
              <text x={108 + i * 56} y={103} fontSize={40} fontWeight={800} textAnchor="middle" fill="#d12e3f" stroke="#b98510" strokeWidth={1.2} fontFamily="Outfit Variable, sans-serif">
                7
              </text>
            </g>
          ))}
          <rect x={78} y={88} width={164} height={3} fill="#f7c948" opacity={0.8} />
          <rect x={256} y={56} width={8} height={56} rx={4} fill="#b98510" />
          <circle cx={260} cy={52} r={9} fill="#d12e3f" />
        </g>
      );
    case 'roulette':
      return <Wheel cx={160} cy={92} r={62} />;
    case 'blackjack':
      return (
        <g>
          <ellipse cx={160} cy={150} rx={150} ry={60} fill="#0c5a3d" opacity={0.7} />
          <SvgCard x={138} y={92} rank="A" suit="♠" rotate={-10} scale={1.25} />
          <SvgCard x={184} y={90} rank="K" suit="♥" rotate={8} scale={1.25} />
          <circle cx={92} cy={138} r={16} fill="#f7c948" stroke="#fff8" strokeDasharray="4 3" strokeWidth={2} />
        </g>
      );
    case 'teen-patti':
      return (
        <g>
          <SvgCard x={122} y={96} rank="A" suit="♥" rotate={-16} scale={1.2} />
          <SvgCard x={160} y={88} rank="A" suit="♠" rotate={0} scale={1.2} />
          <SvgCard x={198} y={96} rank="A" suit="♦" rotate={16} scale={1.2} />
        </g>
      );
    case 'andar-bahar':
      return (
        <g>
          <SvgCard x={160} y={90} rank="J" suit="♣" scale={1.25} />
          <g opacity={0.9}>
            <SvgCard x={82} y={98} rank="4" suit="♦" rotate={-8} scale={0.9} />
            <SvgCard x={238} y={98} rank="J" suit="♥" rotate={8} scale={0.9} />
          </g>
          <text x={82} y={160} fontSize={12} fontWeight={700} textAnchor="middle" fill="#fcd97a" letterSpacing={2}>
            ANDAR
          </text>
          <text x={238} y={160} fontSize={12} fontWeight={700} textAnchor="middle" fill="#fcd97a" letterSpacing={2}>
            BAHAR
          </text>
        </g>
      );
    case 'dice':
      return (
        <g>
          <Die x={128} y={92} pips={5} size={62} rotate={-12} />
          <Die x={196} y={98} pips={2} size={62} rotate={10} />
        </g>
      );
    case 'poker':
      return (
        <g>
          {['10', 'J', 'Q', 'K', 'A'].map((rank, i) => (
            <SvgCard key={rank} x={96 + i * 32} y={96 + Math.abs(i - 2) * 5} rank={rank} suit="♠" rotate={(i - 2) * 9} scale={1.05} />
          ))}
        </g>
      );
  }
}

/** Lightweight inline-SVG artwork for each game (no image downloads). */
export function GameArt({ gameId, accent, className }: { gameId: GameId; accent: GameAccent; className?: string }) {
  const id = useSvgId('art');
  const [from, to] = ACCENT[accent];
  return (
    <svg viewBox="0 0 320 180" className={cn('block h-full w-full', className)} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="45%">
          <stop offset="0%" stopColor="#f7c948" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#f7c948" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={320} height={180} fill={`url(#${id}-bg)`} />
      <rect width={320} height={180} fill={`url(#${id}-glow)`} />
      <Art gameId={gameId} />
    </svg>
  );
}
