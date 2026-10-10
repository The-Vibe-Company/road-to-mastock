"use client";

import Image from "next/image";
import { useTalents } from "./talents-provider";

// Icône de chargement de l'appli. Le Sourire (Axolotl) la remplace par
// l'axolotl qui rebondit — pour toujours, dès que la carte est possédée.
export function Spinner({ label }: { label?: string }) {
  const { has, assets } = useTalents();
  const axolotl = has("sourire") ? assets["sourire"] : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {axolotl ? (
        <Image
          src={axolotl}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="axolotl-spin size-14 object-contain"
        />
      ) : (
        // Quatre plaques qui montent l'une après l'autre, la goupille en tête.
        <div className="plate-loader flex flex-col gap-[3px]" role="status" aria-label={label ?? "Chargement"}>
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      {label && <p className="etched">{label}</p>}
    </div>
  );
}
