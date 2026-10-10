"use client";

import { useMemo, useState } from "react";
import { ACCENT_PRESETS, ACCENT_KEYS, SEALED_ACCENTS, isCustomAccent, resolveAccent } from "@/lib/colors";
import { useAccent } from "./accent-provider";
import { useTalents } from "./talents-provider";
import { useTrophies } from "./trophies-provider";
import { colorTrophyHint, unlockedTrophyColors } from "@/lib/trophies";
import { Check, Gem, Lock, Palette } from "@/components/icons";

export function ColorPicker() {
  const { color, setColor } = useAccent();
  // Parures scellées débloquées par les Talents — invisibles tant que la
  // carte n'est pas possédée : pas de case grisée, pas d'indice, le secret
  // reste entier. L'Alpha (Arceus) ajoute la roue chromatique libre.
  const { discovered, has } = useTalents();
  const sealedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const t of discovered) {
      if (t.effect?.kind === "accent") keys.push(...(t.effect.accents ?? []));
    }
    return keys.filter((k) => SEALED_ACCENTS[k]);
  }, [discovered]);
  const hasAlpha = has("alpha");
  // Les couleurs de base se méritent : le cabinet des trophées les libère.
  const { earned, loaded: trophiesLoaded } = useTrophies();
  const trophyColors = unlockedTrophyColors(earned);
  const [hue, setHue] = useState(() => {
    const m = color.match(/^custom:(\d{1,3})$/);
    return m ? parseInt(m[1], 10) : 200;
  });

  // Ce qui est gagné d'abord, ce qui reste à gagner ensuite.
  const isLocked = (key: string) => trophiesLoaded && !trophyColors.has(key) && color !== key;
  const openKeys = ACCENT_KEYS.filter((k) => !isLocked(k));
  const lockedKeys = ACCENT_KEYS.filter((k) => isLocked(k));

  // Une pastille gagnée : ronde, comme la goupille — celle qu'on porte est
  // cerclée et cochée.
  const renderSwatch = (key: string, sealed: boolean) => {
    const preset = sealed
      ? resolveAccent(key) ?? SEALED_ACCENTS[key]
      : ACCENT_PRESETS[key];
    const isActive = color === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setColor(key)}
        aria-pressed={isActive}
        className="group flex flex-col items-center gap-1.5 rounded-md pb-1 pt-1.5"
      >
        <span
          className={`relative flex size-12 items-center justify-center rounded-full shadow-[inset_0_1px_0_oklch(1_0_0/0.35),inset_0_-2px_0_oklch(0_0_0/0.22)] transition-transform ${
            isActive
              ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
              : "group-hover:scale-105"
          }`}
          style={{ background: `linear-gradient(135deg, ${preset.gradientStart}, ${preset.gradientEnd})` }}
        >
          {isActive && <Check className="size-5 text-white drop-shadow-md" strokeWidth={3} />}
          {sealed && !isActive && (
            <Gem className="absolute -right-0.5 -top-0.5 size-3.5 text-white drop-shadow" />
          )}
        </span>
        <span
          className={`text-center text-[11px] font-semibold leading-tight ${
            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {preset.label}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-x-2 gap-y-3">
        {openKeys.map((key) => renderSwatch(key, false))}
      </div>

      {/* Les couleurs de base non gagnées : un trou de goupille vide, et le
          trophée qui l'ouvre — l'objectif est public, contrairement aux
          Talents. */}
      {lockedKeys.length > 0 && (
        <div>
          <p className="etched mb-2">À gagner</p>
          <ul className="grid grid-cols-1 gap-x-3 gap-y-2 min-[360px]:grid-cols-2">
            {lockedKeys.map((key) => (
              <li key={key} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gap text-muted-foreground shadow-[inset_0_1px_2px_oklch(0_0_0/0.5)]"
                >
                  <Lock className="size-3.5" />
                </span>
                <span className="text-xs leading-tight text-muted-foreground">
                  <span className="sr-only">Couleur verrouillée : </span>
                  {colorTrophyHint(key) ?? ACCENT_PRESETS[key].label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sealedKeys.length > 0 && (
        <div>
          <p className="etched mb-2 flex items-center gap-1.5">
            <Gem className="size-3" />
            Parures scellées
          </p>
          <div className="grid grid-cols-5 gap-x-2 gap-y-3">
            {sealedKeys.map((key) => renderSwatch(key, true))}
          </div>
        </div>
      )}

      {hasAlpha && (
        <div>
          <p className="etched mb-2 flex items-center gap-1.5">
            <Palette className="size-3" />
            L&apos;Alpha — roue chromatique libre
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={360}
              value={hue}
              aria-label="Teinte libre"
              onChange={(e) => setHue(parseInt(e.target.value, 10))}
              onMouseUp={() => setColor(`custom:${hue}`)}
              onTouchEnd={() => setColor(`custom:${hue}`)}
              className="h-3 flex-1 cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, oklch(0.7 0.19 0), oklch(0.7 0.19 60), oklch(0.7 0.19 120), oklch(0.7 0.19 180), oklch(0.7 0.19 240), oklch(0.7 0.19 300), oklch(0.7 0.19 360))",
              }}
            />
            <button
              type="button"
              onClick={() => setColor(`custom:${hue}`)}
              aria-pressed={isCustomAccent(color)}
              aria-label="Porter cette teinte"
              className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 ${
                isCustomAccent(color) ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
              }`}
              style={{ background: `oklch(0.7 0.19 ${hue})` }}
            >
              {isCustomAccent(color) && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
