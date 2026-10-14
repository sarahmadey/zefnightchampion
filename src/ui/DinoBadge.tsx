// A small side-view picture of a child's dino in its colors, for the title
// screen buttons, so a child who can't read yet can still find their own.

import type { DinoColor, Species } from '../game/rewards';

const OUTLINE = 'rgba(30, 40, 20, 0.55)';

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={2.6} fill="#fff" stroke={OUTLINE} strokeWidth={0.8} />
      <circle cx={x + 0.7} cy={y + 0.2} r={1.3} fill="#1d1d1d" />
    </>
  );
}

function Legs({ xs, y, h, w, fill }: { xs: number[]; y: number; h: number; w: number; fill: string }) {
  return (
    <>
      {xs.map((x) => (
        <rect key={x} x={x} y={y} width={w} height={h} rx={w / 2.4} fill={fill} />
      ))}
    </>
  );
}

export function DinoBadge({ species, color, size = 52 }: { species: Species; color: DinoColor; size?: number }) {
  const { body, belly, accent } = color;
  return (
    <svg className="dino-badge" width={size} height={(size * 48) / 64} viewBox="0 0 64 48" aria-hidden focusable="false">
      <g stroke={OUTLINE} strokeWidth={1.2} strokeLinejoin="round">
        {species === 'trex' && (
          <>
            <path d="M3 33 Q14 25 22 24 L24 34 Q12 35 3 33 Z" fill={body} />
            <Legs xs={[20, 29]} y={33} h={12} w={6.5} fill={body} />
            <ellipse cx={27} cy={28} rx={13} ry={10} fill={body} />
            <ellipse cx={30} cy={31} rx={8} ry={5.5} fill={belly} />
            <path d="M33 25 L36 13 L42 13 L40 27 Z" fill={body} />
            <rect x={33} y={5} width={25} height={15} rx={7.5} fill={body} />
            <path d="M44 16.5 Q51 18.5 57 16.5" fill="none" />
            <path d="M38 27 l6 2 l-1.5 2.5 l-5.5 -2 Z" fill={body} />
            <Eye x={47} y={10.5} />
          </>
        )}
        {species === 'trike' && (
          <>
            <path d="M2 29 Q10 23 16 23 L16 33 Q8 33 2 29 Z" fill={body} />
            <Legs xs={[13, 20, 32, 39]} y={31} h={13} w={6} fill={body} />
            <ellipse cx={27} cy={27} rx={17} ry={11} fill={body} />
            <ellipse cx={27} cy={31} rx={11} ry={5.5} fill={belly} />
            <ellipse cx={43} cy={20} rx={8} ry={11} fill={accent} />
            <ellipse cx={49} cy={28} rx={9} ry={7} fill={body} />
            <path d="M47 19 L58 11 L51 22 Z" fill={belly} />
            <path d="M56 27 L63 24 L57 31 Z" fill={belly} />
            <Eye x={51} y={25.5} />
          </>
        )}
        {species === 'stego' && (
          <>
            <path d="M15 21 L19 9 L24 21 Z" fill={accent} />
            <path d="M23 19 L29 6 L34 19 Z" fill={accent} />
            <path d="M32 20 L38 9 L42 21 Z" fill={accent} />
            <path d="M2 30 Q10 25 16 25 L16 34 Q8 34 2 30 Z" fill={body} />
            <path d="M3 28 L5 22 L8 28 Z" fill={accent} />
            <Legs xs={[14, 21, 33, 40]} y={32} h={12} w={6} fill={body} />
            <ellipse cx={28} cy={29} rx={17} ry={10} fill={body} />
            <ellipse cx={28} cy={33} rx={11} ry={5} fill={belly} />
            <ellipse cx={50} cy={32} rx={8} ry={5.5} fill={body} />
            <Eye x={52} y={30} />
          </>
        )}
        {species === 'longneck' && (
          <>
            <path d="M2 35 Q9 29 14 29 L14 38 Q7 38 2 35 Z" fill={body} />
            <Legs xs={[12, 19, 29, 36]} y={34} h={11} w={6} fill={body} />
            <ellipse cx={25} cy={32} rx={15} ry={9} fill={body} />
            <ellipse cx={25} cy={36} rx={9} ry={4.5} fill={belly} />
            <path d="M33 29 C39 22 41 13 43 6 L50 7 C48 15 45 25 39 34 Z" fill={body} />
            <ellipse cx={50} cy={7} rx={8} ry={5} fill={body} />
            <Eye x={52} y={5.5} />
          </>
        )}
      </g>
    </svg>
  );
}
