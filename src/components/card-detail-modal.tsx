"use client";

import { useState } from "react";
import { X, Ruler, Weight, MapPin, Shield, Pencil, Check, Gem } from "@/components/icons";
import { useTalents } from "@/components/talents-provider";
import { CreatureCard } from "@/components/creature-card";
import { RARITY_COLORS, RARITY_LABELS, type Rarity } from "@/lib/rarities";
import { PowerRules } from "@/components/power-rules";
import { magnesieOf, powerLabel, polarityBreakdown } from "@/lib/powers";

type Category = "animal" | "pokemon";

export interface DetailedCreature {
  kind: Category;
  id: number;
  slug: string;
  name: string;
  nickname?: string | null;
  rarity: Rarity;
  imageUrl: string | null;
  count?: number;
  // shared enrichment
  flavor: string | null;
  heightCm: number | null;
  weightKg: number | null;
  habitat: string | null;
  // animal-specific
  cardNumber?: number | null;
  scientificName?: string | null;
  description?: string | null;
  lineage?: string | null;
  // pokemon-specific
  pokedexNumber?: number | null;
  primaryType?: string | null;
  secondaryType?: string | null;
  // Le vestiaire : les 5 skins de la carte (possédés ou non) + l'équipé.
  skins?: { level: number; name: string; imageUrl: string | null; owned: boolean }[];
  equippedSkinLevel?: number | null;
  baseImageUrl?: string | null;
}

function formatHeight(cm: number | null): string | null {
  if (cm == null) return null;
  if (cm >= 100) return `${(cm / 100).toFixed(1).replace(".0", "")} m`;
  return `${Math.round(cm)} cm`;
}

function formatWeight(kg: number | null): string | null {
  if (kg == null) return null;
  if (kg >= 1) return `${kg.toFixed(1).replace(".0", "")} kg`;
  return `${Math.round(kg * 1000)} g`;
}

export function CardDetailModal({
  creature,
  onClose,
  onNicknameChange,
  onSkinChange,
}: {
  creature: DetailedCreature;
  onClose: () => void;
  onNicknameChange?: () => void;
  onSkinChange?: () => void;
}) {
  const colors = RARITY_COLORS[creature.rarity];
  // Le Vœu (Jirachi) : renommer une carte possédée.
  const { has } = useTalents();
  const canRename = has("voeu") && onNicknameChange !== undefined;
  const [equipping, setEquipping] = useState<number | null>(null);
  const [equippedLevel, setEquippedLevel] = useState<number | null>(creature.equippedSkinLevel ?? null);

  const equipSkin = async (level: number | null) => {
    if (equipping !== null) return;
    setEquipping(level ?? 0);
    try {
      const r = await fetch("/api/cards/skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: creature.kind, cardId: creature.id, level }),
      });
      if (r.ok) {
        setEquippedLevel(level);
        onSkinChange?.();
      }
    } finally {
      setEquipping(null);
    }
  };
  const [renaming, setRenaming] = useState(false);
  const [nick, setNick] = useState(creature.nickname ?? "");
  const [savingNick, setSavingNick] = useState(false);
  const displayName = creature.nickname || creature.name;

  const saveNickname = async () => {
    if (savingNick) return;
    setSavingNick(true);
    try {
      const r = await fetch("/api/cards/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: creature.kind, cardId: creature.id, nickname: nick }),
      });
      if (r.ok) {
        setRenaming(false);
        onNicknameChange?.();
      }
    } finally {
      setSavingNick(false);
    }
  };
  const number =
    creature.kind === "animal" ? creature.cardNumber ?? null : creature.pokedexNumber ?? null;
  // Show pokémon types as subtitle; no scientific name for animals.
  const subtitle =
    creature.kind === "pokemon"
      ? [creature.primaryType, creature.secondaryType].filter(Boolean).join(" · ")
      : null;
  const flavorText = creature.flavor ?? creature.description ?? null;
  const height = formatHeight(creature.heightCm);
  const weight = formatWeight(creature.weightKg);
  // Pouvoir de Gardien : polarité pour le commun→épique, Prodige pour le
  // légendaire, Miracle pour le mythique.
  const subtype = creature.kind === "pokemon" ? creature.primaryType ?? null : creature.lineage ?? null;
  const power = powerLabel(creature.kind, creature.rarity, subtype, creature.slug);
  // Bas de pyramide : le métier se lit en deux lignes, un sens par ligne.
  const breakdown = polarityBreakdown(creature.kind, creature.rarity, subtype);
  const tierBadge =
    creature.rarity === "mythic" ? "Miracle" : creature.rarity === "legendary" ? "Prodige" : null;
  // La Magnésie : ~10 % des cartes la portent, en plus de leur pouvoir.
  const dust = magnesieOf(creature.kind, creature.slug, creature.rarity);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="fixed right-4 top-4 z-10 flex size-10 items-center justify-center rounded-xl bg-secondary/80 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
      >
        <X className="size-5" />
      </button>

      <div className="flex w-full max-w-md flex-col items-center gap-5 px-5 py-10">
        <div className="w-[18rem] sm:w-80">
          <CreatureCard
            name={displayName}
            rarity={creature.rarity}
            imageUrl={creature.imageUrl}
            number={number}
            category={creature.kind}
            primaryType={creature.primaryType}
            secondaryType={creature.secondaryType}
            count={creature.count}
            size="lg"
          />
        </div>

        <div className="text-center">
          <p className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>
            {RARITY_LABELS[creature.rarity]} · {creature.kind === "animal" ? "Animal" : "Pokémon"}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{displayName}</h2>
          {creature.nickname && (
            <p className="mt-0.5 text-xs italic text-muted-foreground">{creature.name}</p>
          )}
          {canRename && !renaming && (
            <button
              onClick={() => setRenaming(true)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-primary"
            >
              <Pencil className="size-3" />
              {creature.nickname ? "Changer le surnom" : "Donner un surnom"}
            </button>
          )}
          {renaming && (
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveNickname();
              }}
            >
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder={creature.name}
                maxLength={40}
                autoFocus
                className="h-9 flex-1 rounded-lg bg-secondary/50 px-3 text-sm font-bold outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={savingNick}
                className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary disabled:opacity-50"
              >
                <Check className="size-4" strokeWidth={3} />
              </button>
            </form>
          )}
          {subtitle && (
            <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {/* Le vestiaire : le classique + les 5 skins. Un skin possédé se
            porte d'un tap ; les autres restent des silhouettes à gagner
            (un skin par séance clôturée). */}
        {creature.skins && creature.skins.length > 0 && (
          <div className="w-full">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
              Vestiaire · {creature.skins.filter((sk) => sk.owned).length}/{creature.skins.length} skins
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              <button
                onClick={() => equipSkin(null)}
                disabled={equipping !== null}
                title="Le classique"
                className={`relative aspect-square overflow-hidden rounded-[3px] ring-1 transition-all active:scale-95 ${
                  equippedLevel == null ? "ring-2 ring-primary" : "ring-border"
                }`}
              >
                {(creature.baseImageUrl ?? creature.imageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creature.baseImageUrl ?? creature.imageUrl ?? ""} alt="" className="size-full object-cover" />
                )}
              </button>
              {creature.skins.map((sk) => {
                const isEquipped = equippedLevel === sk.level;
                return (
                  <button
                    key={sk.level}
                    onClick={() => (sk.owned && sk.imageUrl ? equipSkin(sk.level) : undefined)}
                    disabled={equipping !== null || !sk.owned || !sk.imageUrl}
                    title={sk.owned ? `${sk.name} (niv. ${sk.level})` : `Niveau ${sk.level} — à gagner en séance`}
                    className={`relative aspect-square overflow-hidden rounded-[3px] ring-1 transition-all active:scale-95 ${
                      isEquipped ? "ring-2 ring-primary" : "ring-border"
                    } ${!sk.owned ? "opacity-60" : ""}`}
                  >
                    {sk.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sk.imageUrl}
                        alt=""
                        className={`size-full object-cover ${!sk.owned ? "brightness-[0.25] saturate-0" : ""}`}
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center bg-secondary/40 font-mono text-[10px] text-muted-foreground">
                        ?
                      </span>
                    )}
                    <span className={`absolute bottom-0 right-0 rounded-tl px-1 font-mono text-[8px] font-black ${sk.owned ? "bg-primary text-black" : "bg-black/70 text-muted-foreground"}`}>
                      {sk.level}
                    </span>
                  </button>
                );
              })}
            </div>
            {equippedLevel != null && (
              <p className="mt-1.5 text-center text-[11px] font-bold text-primary">
                {creature.skins.find((sk) => sk.level === equippedLevel)?.name}
              </p>
            )}
          </div>
        )}

        {power && (
          <div className={`w-full rounded-xl ${colors.bg} ring-1 ${colors.ring} px-4 py-3`}>
            <div className="flex items-center gap-2">
              <Shield className={`size-4 shrink-0 ${colors.text}`} />
              <p className={`text-xs font-black uppercase tracking-widest ${colors.text}`}>
                {breakdown ? breakdown.name : power.name}
              </p>
              {tierBadge && (
                <span className="ml-auto rounded-md bg-black/20 px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums text-foreground/70">
                  {tierBadge}
                </span>
              )}
            </div>
            {breakdown ? (
              <div className="mt-2.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 min-w-16 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-500/15 px-2 font-mono text-lg font-black tabular-nums text-emerald-300 ring-1 ring-emerald-500/40">
                    {breakdown.attract.delta}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      Attractif
                    </p>
                    <p className="text-xs leading-snug text-foreground/80">{breakdown.attract.text}</p>
                    <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {breakdown.attract.example}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 min-w-16 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-red-500/15 px-2 font-mono text-lg font-black tabular-nums text-red-300 ring-1 ring-red-500/40">
                    {breakdown.repel.delta}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-300">
                      Répulsif
                    </p>
                    <p className="text-xs leading-snug text-foreground/80">{breakdown.repel.text}</p>
                    <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {breakdown.repel.example}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1.5 text-xs italic leading-relaxed text-foreground/70">
                  {power.description}
                </p>
                {power.rules && <PowerRules text={power.rules} reminder className="mt-2" />}
              </>
            )}
          </div>
        )}

        {dust != null && (
          <div className="flex w-full items-center gap-2.5 rounded-xl bg-sky-500/10 px-4 py-2.5 ring-1 ring-sky-500/30">
            <Gem className="size-4 shrink-0 text-sky-300" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-300">
                Porteuse de magnésie
              </p>
              <p className="text-xs leading-snug text-foreground/80">
                À chaque éveil, elle dépose <span className="font-black text-sky-200">+{dust} magnésie</span> —
                la poudre qui délie les Gardiens liés.
              </p>
            </div>
          </div>
        )}

        {(height || weight || creature.habitat) && (
          <div className="w-full space-y-2">
            {(height || weight) && (
              <div className={`flex items-center justify-around gap-2 rounded-xl ${colors.bg} ring-1 ${colors.ring} px-3 py-3`}>
                {height && (
                  <div className="flex items-center gap-2">
                    <Ruler className={`size-4 ${colors.text}`} />
                    <div className="text-left">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                        Taille
                      </p>
                      <p className={`mt-0.5 text-sm font-black ${colors.text} leading-none`}>{height}</p>
                    </div>
                  </div>
                )}
                {height && weight && <div className="h-7 w-px bg-border/60" />}
                {weight && (
                  <div className="flex items-center gap-2">
                    <Weight className={`size-4 ${colors.text}`} />
                    <div className="text-left">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                        Poids
                      </p>
                      <p className={`mt-0.5 text-sm font-black ${colors.text} leading-none`}>{weight}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {creature.habitat && (
              <div className={`flex items-center gap-3 rounded-xl ${colors.bg} ring-1 ${colors.ring} px-4 py-3`}>
                <MapPin className={`size-4 shrink-0 ${colors.text}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                    Milieu
                  </p>
                  <p className={`mt-1 text-sm font-black ${colors.text}`}>{creature.habitat}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {flavorText ? (
          <div className="w-full rounded-2xl bg-secondary/30 px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {flavorText}
          </div>
        ) : (
          <div className="w-full rounded-2xl bg-secondary/30 px-4 py-3 text-center text-xs italic text-muted-foreground">
            Aucune description disponible pour le moment.
          </div>
        )}

        {creature.count && creature.count > 1 && (
          <p className="text-xs font-bold text-muted-foreground">
            Possédé ×{creature.count}
          </p>
        )}
      </div>
    </div>
  );
}
