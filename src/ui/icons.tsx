// Inline SVG icons for the HTML overlay (no image files, no emoji).

const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;

export function MoonLockIcon() {
  return (
    <svg {...common}>
      <path d="M15.5 3.5a7.5 7.5 0 1 0 5 13.1A8.5 8.5 0 0 1 15.5 3.5Z" fill="currentColor" opacity="0.9" />
      <rect x="13.2" y="13" width="8" height="6.5" rx="1.6" fill="currentColor" />
      <path d="M15 13v-1.6a2.2 2.2 0 0 1 4.4 0V13" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function SoundOnIcon() {
  return (
    <svg {...common}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SoundOffIcon() {
  return (
    <svg {...common}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** A big smiling sun: "I stayed dry!" */
export function BigSunIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <path
            key={i}
            d={`M${50 + Math.cos(a - 0.12) * 33} ${50 + Math.sin(a - 0.12) * 33} L${50 + Math.cos(a) * 47} ${50 + Math.sin(a) * 47} L${50 + Math.cos(a + 0.12) * 33} ${50 + Math.sin(a + 0.12) * 33}Z`}
            fill="#ff9f1c"
          />
        );
      })}
      <circle cx="50" cy="50" r="31" fill="#ffd23f" stroke="#ff9f1c" strokeWidth="3" />
      <circle cx="40" cy="45" r="4" fill="#5a3200" />
      <circle cx="60" cy="45" r="4" fill="#5a3200" />
      <circle cx="41.3" cy="43.6" r="1.3" fill="#fff" />
      <circle cx="61.3" cy="43.6" r="1.3" fill="#fff" />
      <path d="M37 56 Q50 69 63 56" stroke="#5a3200" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="55" r="4.5" fill="#ff7f9e" opacity="0.55" />
      <circle cx="67" cy="55" r="4.5" fill="#ff7f9e" opacity="0.55" />
    </svg>
  );
}

/** A big soft heart with hugging arms: "Not dry — hug time." */
export function BigHeartIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <path d="M50 84 C20 64 12 46 18 33 C25 18 44 19 50 32 C56 19 75 18 82 33 C88 46 80 64 50 84Z" fill="#ff7eb6" stroke="#e8458a" strokeWidth="3" />
      <circle cx="40" cy="44" r="3.6" fill="#6a1240" />
      <circle cx="60" cy="44" r="3.6" fill="#6a1240" />
      <path d="M41 54 Q50 62 59 54" stroke="#6a1240" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M30 30 Q36 26 42 30" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function StarIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"
        fill="#ffd23f"
        stroke="#f08c00"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UnderpantsIcon({ size = 40, gold = false }: { size?: number; gold?: boolean }) {
  const base = gold ? '#ffd23f' : '#5cc461';
  const dark = gold ? '#e8a300' : '#2f8a3a';
  return (
    <svg viewBox="0 0 48 40" width={size} height={(size * 40) / 48} aria-hidden="true">
      <path d="M4 6h40l-1 11c-1 9-6 14-11 14-3 0-5-3-6-7h-4c-1 4-3 7-6 7-5 0-10-5-11-14Z" fill={base} stroke={dark} strokeWidth="2" strokeLinejoin="round" />
      <rect x="3" y="3" width="42" height="6" rx="3" fill="#fff" stroke={dark} strokeWidth="1.6" />
      <circle cx="15" cy="17" r="3" fill={dark} />
      <circle cx="33" cy="16" r="2.4" fill={dark} />
      <circle cx="24" cy="21" r="2" fill={dark} />
    </svg>
  );
}

export function ChestIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 28" width={size} height={(size * 28) / 32} aria-hidden="true">
      <path d="M3 12h26v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="#b06d32" stroke="#6b3d16" strokeWidth="1.6" />
      <path d="M3 12V9a7 7 0 0 1 7-7h12a7 7 0 0 1 7 7v3Z" fill="#8a4f20" stroke="#6b3d16" strokeWidth="1.6" />
      <rect x="13" y="10" width="6" height="7" rx="1.5" fill="#ffd23f" stroke="#c98d00" strokeWidth="1.2" />
      <path d="M8 2.5v23.5M24 2.5v23.5" stroke="#ffd23f" strokeWidth="2" opacity="0.9" />
    </svg>
  );
}

export function ReplayIcon() {
  return (
    <svg {...common} width={30} height={30}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 3.5v5h5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 9v6l5-3z" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...common}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg {...common}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 9.5} y2={12 + Math.sin(a) * 9.5} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg {...common}>
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...common} width={34} height={34}>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HangerIcon() {
  return (
    <svg {...common} width={28} height={28}>
      <path d="M12 7.5a2.2 2.2 0 1 1 2.2-2.2c0 1.2-2.2 1.6-2.2 3.2l8.6 6a1.6 1.6 0 0 1-.9 2.9H4.3a1.6 1.6 0 0 1-.9-2.9L12 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg {...common}>
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
