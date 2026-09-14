"use client";

import Image from "next/image";
import type { Rarity } from "@/lib/rarities";

// L'opacité monte avec la rareté : un commun reste discret, un mythique
// s'assume. Le texte du bloc est en blanc gras sur fond près du noir, il
// garde son contraste même par-dessus l'artwork.
const MASCOT_OPACITY: Record<Rarity, string> = {
  common: "opacity-[0.15]",
  uncommon: "opacity-[0.17]",
  rare: "opacity-[0.20]",
  epic: "opacity-[0.24]",
  legendary: "opacity-[0.27]",
  mythic: "opacity-[0.30]",
};

// Lavis coloré réservé aux hautes raretés : en dessous le fond reste neutre,
// sinon chaque bloc de séance devient une tache de couleur.
const MASCOT_WASH: Record<Rarity, string | null> = {
  common: null,
  uncommon: null,
  rare: null,
  epic: "from-violet-500/[0.09]",
  legendary: "from-amber-400/[0.11]",
  mythic: "from-rose-400/[0.13]",
};

// Fondu radial : la bête est pleine au centre du bloc et se dissout avant
// les bords, pour ne pas donner l'impression d'une photo recadrée au couteau.
const FADE =
  "radial-gradient(ellipse 72% 78% at 50% 50%, #000 35%, rgba(0,0,0,0.55) 70%, transparent 100%)";

// L'art remplit tout le bloc (object-cover) : en `contain`, l'image carrée
// laissait deux bandes vides sur les côtés et ses bords francs se voyaient
// à travers le fondu. Le cadrage remonte un peu (42 %) pour garder la tête
// de la créature plutôt que son socle quand le bloc est large et bas.
const FILL = "object-cover object-[center_42%]";

export function MascotBackdrop({
  imageUrl,
  rarity,
  evolved = false,
}: {
  imageUrl: string;
  rarity: Rarity;
  // La Légende de la Carpe : la forme évoluée passe au rouge.
  evolved?: boolean;
}) {
  const wash = MASCOT_WASH[rarity];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      {wash && (
        <div className={`absolute inset-0 bg-gradient-to-l ${wash} to-transparent`} />
      )}
      <div
        className="absolute inset-0"
        style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          sizes="480px"
          className={`${FILL} ${MASCOT_OPACITY[rarity]} ${evolved ? "gyarados-red" : ""}`}
        />
      </div>
    </div>
  );
}
