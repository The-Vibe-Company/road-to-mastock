"use client";

const COIN_PALETTE = {
  1: { ringStart: "#a1a1aa", ringEnd: "#52525b", field1: "#27272a", field2: "#09090b", text: "#e4e4e7", glow: "" },
  2: { ringStart: "#fbbf24", ringEnd: "#92400e", field1: "#78350f", field2: "#451a03", text: "#fef3c7", glow: "drop-shadow(0 0 18px rgba(251,191,36,0.3))" },
  3: { ringStart: "#e7e5e4", ringEnd: "#78716c", field1: "#1c1917", field2: "#0c0a09", text: "#fafaf9", glow: "drop-shadow(0 0 22px rgba(231,229,228,0.4))" },
  4: { ringStart: "#fef08a", ringEnd: "#a16207", field1: "#451a03", field2: "#1c0d02", text: "#fef9c3", glow: "drop-shadow(0 0 36px rgba(251,191,36,0.85))" },
  // Le ×10 du Pas de la Fortune (Qilin) — la pièce mythique.
  10: { ringStart: "#fda4af", ringEnd: "#9f1239", field1: "#4c0519", field2: "#1c0208", text: "#ffe4e6", glow: "drop-shadow(0 0 48px rgba(244,114,182,0.95))" },
} as const;

export type CoinReward = keyof typeof COIN_PALETTE;

export function JackpotCoin({ reward, size = 144 }: { reward: CoinReward; size?: number }) {
  const p = COIN_PALETTE[reward];
  const isJackpot = reward === 4 || reward === 10;
  const id = `coin-${reward}`;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size + (isJackpot ? 18 : 0) }}
    >
      <svg
        viewBox="0 0 144 144"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: p.glow || undefined }}
      >
        <defs>
          <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.ringStart} />
            <stop offset="50%" stopColor={p.ringEnd} />
            <stop offset="100%" stopColor={p.ringStart} />
          </linearGradient>
          <radialGradient id={`${id}-field`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={p.field1} />
            <stop offset="100%" stopColor={p.field2} />
          </radialGradient>
          <filter id={`${id}-emboss`}>
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.7" />
          </filter>
        </defs>

        {/* Outer cardinal notches */}
        <g stroke={`url(#${id}-ring)`} strokeWidth="2" strokeLinecap="round">
          <line x1="72" y1="2" x2="72" y2="10" />
          <line x1="142" y1="72" x2="134" y2="72" />
          <line x1="72" y1="142" x2="72" y2="134" />
          <line x1="2" y1="72" x2="10" y2="72" />
        </g>

        <circle cx="72" cy="72" r="66" fill={`url(#${id}-field)`} stroke={`url(#${id}-ring)`} strokeWidth="4" />
        <circle cx="72" cy="72" r="56" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />

        {reward === 3 && (
          <path
            d="M 72 38 l 3 7 7.5 1 -5.5 5.5 1.5 7.5 -6.5 -3.5 -6.5 3.5 1.5 -7.5 -5.5 -5.5 7.5 -1 z"
            fill={`url(#${id}-ring)`}
            opacity="0.9"
          />
        )}

        <text
          x="72"
          y={reward === 3 ? "100" : "94"}
          textAnchor="middle"
          fontSize={isJackpot ? 64 : 56}
          fontWeight="900"
          fill={p.text}
          style={{ fontFamily: "var(--font-geist-mono, ui-monospace), monospace" }}
          filter={`url(#${id}-emboss)`}
        >
          ×{reward}
        </text>
      </svg>

      {isJackpot && (
        <div
          className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-[2px] bg-amber-400 px-2 py-0.5 font-heading font-bold uppercase leading-none tracking-[0.14em] text-black shadow-lg"
          style={{ fontSize: 12 }}
        >
          Jackpot
        </div>
      )}

      {isJackpot && (
        <div className="pointer-events-none absolute inset-0 rounded-full holo-shimmer" />
      )}
    </div>
  );
}
