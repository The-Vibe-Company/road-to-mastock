"use client";

import Image from "next/image";
import { Zap, PawPrint } from "@/components/icons";
import { type Rarity } from "@/lib/rarities";

type Category = "animal" | "pokemon";

const TIER_GRADIENT: Record<Rarity, string> = {
  common:    "from-zinc-800 via-zinc-900 to-black",
  uncommon:  "from-emerald-900 via-emerald-950 to-black",
  rare:      "from-sky-900 via-sky-950 to-black",
  epic:      "from-violet-900 via-violet-950 to-black",
  legendary: "from-amber-900 via-amber-950 to-black",
  mythic:    "from-rose-900 via-fuchsia-950 to-black",
};

const TIER_BORDER: Record<Rarity, string> = {
  common:    "border-zinc-500/40",
  uncommon:  "border-emerald-500/50",
  rare:      "border-sky-500/60",
  epic:      "border-violet-500/70",
  legendary: "border-amber-400/80",
  mythic:    "border-rose-400",
};

const TIER_GLOW: Record<Rarity, string> = {
  common:    "",
  uncommon:  "",
  rare:      "shadow-[0_0_24px_-6px_rgba(56,189,248,0.5)]",
  epic:      "shadow-[0_0_28px_-4px_rgba(167,139,250,0.6)]",
  legendary: "shadow-[0_0_36px_-4px_rgba(251,191,36,0.7)]",
  mythic:    "shadow-[0_0_44px_-2px_rgba(244,114,182,0.85)]",
};

const TIER_LETTER: Record<Rarity, string> = {
  common: "C",
  uncommon: "U",
  rare: "R",
  epic: "E",
  legendary: "L",
  mythic: "M",
};

const TIER_ACCENT: Record<Rarity, string> = {
  common: "text-zinc-300",
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  epic: "text-violet-300",
  legendary: "text-amber-300",
  mythic: "text-rose-300",
};

interface CreatureCardProps {
  name: string;
  rarity: Rarity;
  imageUrl: string | null;
  number: number | null; // animals: cardNumber, pokemon: pokedexNumber
  category: Category;
  primaryType?: string | null;
  secondaryType?: string | null;
  count?: number;
  size?: "sm" | "lg";
  className?: string;
  // Le Sertissage (Diancie) : cadre serti sur les cartes de la collection.
  serti?: boolean;
}

export function CreatureCard({
  name,
  rarity,
  imageUrl,
  number,
  category,
  primaryType,
  secondaryType,
  count,
  size = "sm",
  className = "",
  serti = false,
}: CreatureCardProps) {
  const isPolished = rarity === "rare" || rarity === "epic" || rarity === "legendary" || rarity === "mythic";
  const isHolo = rarity === "legendary" || rarity === "mythic";

  const numberPad = category === "animal" ? 4 : 4;
  const formattedNumber = number != null ? number.toString().padStart(numberPad, "0") : "----";

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-[10px] border-2 ${TIER_BORDER[rarity]} ${TIER_GLOW[rarity]} bg-gradient-to-b ${TIER_GRADIENT[rarity]} ${serti ? "card-serti" : ""} ${className}`}
    >
      {/* Holo shimmer for legendary+ */}
      {isHolo && (
        <div className="pointer-events-none absolute inset-0 holo-shimmer" />
      )}

      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.06)_0%,transparent_60%)]" />

      {/* Top bar: number + tier letter */}
      <div className={`absolute inset-x-0 top-0 flex items-center justify-between px-2 ${size === "lg" ? "py-1.5" : "py-1"} bg-black/40 backdrop-blur-[2px]`}>
        <span className={`font-mono font-black tracking-tight text-white/90 ${size === "lg" ? "text-xs" : "text-[9px]"}`}>
          N°{formattedNumber}
        </span>
        <span className={`flex size-4 items-center justify-center rounded-md bg-white/10 font-black ${TIER_ACCENT[rarity]} ${size === "lg" ? "text-[10px]" : "text-[8px]"} ${size === "lg" ? "size-5" : ""}`}>
          {TIER_LETTER[rarity]}
        </span>
      </div>

      {/* Image — carré plein cadre : dans une carte 3/4, un carré pleine
          largeur ancré en haut fait EXACTEMENT 75 % de la hauteur. Rien
          n'est rogné, rien ne flotte ; la bannière occupe le quart restant. */}
      <div className="absolute inset-x-0 top-0 flex aspect-square items-center justify-center overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={size === "lg" ? 320 : 110}
            height={size === "lg" ? 320 : 110}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          category === "pokemon" ? (
            <Zap className={`${TIER_ACCENT[rarity]} ${size === "lg" ? "size-32" : "size-12"}`} />
          ) : (
            <PawPrint className={`${TIER_ACCENT[rarity]} ${size === "lg" ? "size-32" : "size-12"}`} />
          )
        )}
      </div>

      {/* Bottom: name banner — remplit le quart restant sous l'image */}
      <div className={`absolute inset-x-0 bottom-0 top-[75%] flex flex-col justify-center ${size === "lg" ? "px-3" : "px-2"} bg-gradient-to-t from-black/95 via-black/85 to-black/40`}>
        <p className={`line-clamp-2 text-center font-black uppercase tracking-tight text-white ${size === "lg" ? "text-sm" : "text-[10px] leading-tight"}`}>
          {name}
        </p>
        {size === "lg" && category === "pokemon" && (primaryType || secondaryType) && (
          <p className="mt-0.5 text-center text-[10px] font-bold uppercase tracking-widest text-white/60">
            {primaryType}{secondaryType ? ` · ${secondaryType}` : ""}
          </p>
        )}
      </div>

      {/* count is now tracked silently (used for stats) but not displayed —
         a duplicate pull grants a fragment instead, so "×N" was misleading. */}

      {/* Premium foil corner for epic+ */}
      {isPolished && (
        <div className="pointer-events-none absolute right-0 top-0 size-12 bg-gradient-to-bl from-white/20 via-transparent to-transparent" />
      )}
    </div>
  );
}
