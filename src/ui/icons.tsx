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

export function HouseIcon() {
  return (
    <svg {...common} width={30} height={30}>
      <path d="M3.5 11.2 12 4l8.5 7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9.5h4.5v-5h3v5H18V10" fill="currentColor" opacity="0.9" />
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
          <line
            key={i}
            x1={12 + Math.cos(a) * 7}
            y1={12 + Math.sin(a) * 7}
            x2={12 + Math.cos(a) * 9.5}
            y2={12 + Math.sin(a) * 9.5}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function CloudHeartIcon() {
  return (
    <svg {...common}>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.4A3.8 3.8 0 0 1 17.5 18.5Z" fill="currentColor" opacity="0.85" />
      <path d="M12 16.2s-2.6-1.6-2.6-3.3a1.4 1.4 0 0 1 2.6-.8 1.4 1.4 0 0 1 2.6.8c0 1.7-2.6 3.3-2.6 3.3Z" fill="#fff" />
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
