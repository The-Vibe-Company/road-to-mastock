"use client";

import { useState } from "react";
import { X, Ruler, Weight, MapPin, Shield, Pencil, Check, Gem } from "@/components/icons";
import { useTalents } from "@/components/talents-provider";
import { CreatureCard } from "@/components/creature-card";
import { RARITY_LABELS, type Rarity } from "@/lib/rarities";
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

// La rareté est une donnée de la carte, pas un accent : un point de couleur
// et une teinte d'icône, lisibles dans les deux fontes (la nuit, le papier).
const RARITY_DOT: Record<Rarity, string> = {
  common: "bg-zinc-400",
  uncommon: "bg-emerald-400",
  rare: "bg-sky-400",
  epic: "bg-violet-400",
  legendary: "bg-amber-400",
  mythic: "bg-rose-400",
};
const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-zinc-600 dark:text-zinc-300",
  uncommon: "text-emerald-700 dark:text-emerald-300",
  rare: "text-sky-700 dark:text-sky-300",
  epic: "text-violet-700 dark:text-violet-300",
  legendary: "text-amber-700 dark:text-amber-300",
  mythic: "text-rose-700 dark:text-rose-300",
};

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
    <div className="scrim fixed inset-0 z-[100] flex overflow-y-auto sm:p-6">
      {/* La fiche : posée sur le fond de l'appli, lisible dans les deux fontes. */}
      <div className="relative m-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-5 bg-background px-5 py-14 shadow-[inset_0_1px_0_var(--plate-edge),0_24px_60px_-20px_oklch(0_0_0/0.8)] sm:min-h-0 sm:rounded-xl">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="plate fixed right-4 top-4 sm:absolute sm:right-3 sm:top-3 z-10 flex size-10 items-center justify-center text-muted-foreground transition-colors hover:bg-plate-hover hover:text-foreground"
        >
          <X className="size-5" />
        </button>
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
          <p className="etched inline-flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-full ${RARITY_DOT[creature.rarity]}`} />
            {RARITY_LABELS[creature.rarity]} · {creature.kind === "animal" ? "Animal" : "Pokémon"}
          </p>
          <h2 className="mt-1.5 text-3xl uppercase leading-none">{displayName}</h2>
          {creature.nickname && (
            <p className="mt-1 text-xs italic text-muted-foreground">{creature.name}</p>
          )}
          {canRename && !renaming && (
            <button
              onClick={() => setRenaming(true)}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                aria-label="Surnom"
                maxLength={40}
                autoFocus
                className="h-10 flex-1 rounded-[var(--radius)] bg-secondary/50 px-3 text-sm font-semibold shadow-[inset_0_1px_2px_oklch(0_0_0/0.35)] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              />
              <button
                type="submit"
                disabled={savingNick}
                aria-label="Enregistrer le surnom"
                className="bg-gradient-orange-intense flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-100"
              >
                <Check className="size-4" strokeWidth={3} />
              </button>
            </form>
          )}
          {subtitle && (
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {/* Le vestiaire : le classique + les 5 skins. Un skin possédé se
            porte d'un tap ; les autres restent des silhouettes à gagner
            (un skin par séance clôturée). Celui qu'on porte a la goupille. */}
        {creature.skins && creature.skins.length > 0 && (
          <div className="w-full">
            <div className="mb-2 flex items-center gap-2.5">
              <p className="etched">Vestiaire</p>
              <span className="stamp h-6 min-w-6 px-1.5 text-[14px]">
                {creature.skins.filter((sk) => sk.owned).length}/{creature.skins.length}
              </span>
              <span aria-hidden className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              <button
                onClick={() => equipSkin(null)}
                disabled={equipping !== null}
                title="Le classique"
                aria-label="Le classique"
                aria-pressed={equippedLevel == null}
                className={`relative aspect-square overflow-hidden rounded-[var(--radius)] bg-gap transition-transform active:scale-95 ${
                  equippedLevel == null ? "outline-2 outline-offset-2 outline-primary" : "hover:brightness-110"
                }`}
              >
                {(creature.baseImageUrl ?? creature.imageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creature.baseImageUrl ?? creature.imageUrl ?? ""} alt="" className="size-full object-cover" />
                )}
              </button>
              {creature.skins.map((sk) => {
                const isEquipped = equippedLevel === sk.level;
                const wearable = sk.owned && Boolean(sk.imageUrl);
                return (
                  <button
                    key={sk.level}
                    onClick={() => (wearable ? equipSkin(sk.level) : undefined)}
                    disabled={equipping !== null || !wearable}
                    title={sk.owned ? `${sk.name} (niv. ${sk.level})` : `Niveau ${sk.level} — à gagner en séance`}
                    aria-label={sk.owned ? `${sk.name}, niveau ${sk.level}` : `Niveau ${sk.level}, à gagner en séance`}
                    aria-pressed={isEquipped}
                    className={`relative aspect-square overflow-hidden rounded-[var(--radius)] bg-gap transition-transform active:scale-95 ${
                      isEquipped ? "outline-2 outline-offset-2 outline-primary" : wearable ? "hover:brightness-110" : ""
                    }`}
                  >
                    {wearable ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sk.imageUrl!} alt="" className="size-full object-cover" />
                    ) : (
                      // Non possédé : rien à deviner — un « ? » et c'est tout.
                      <span className="flex size-full items-center justify-center font-heading text-lg font-bold text-muted-foreground">
                        ?
                      </span>
                    )}
                    <span className="stamp absolute bottom-0 right-0 h-4 min-w-4 rounded-none rounded-tl-[2px] px-1 text-[11px]">
                      {sk.level}
                    </span>
                  </button>
                );
              })}
            </div>
            {equippedLevel != null && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold">
                <span aria-hidden className="pin size-2" />
                {creature.skins.find((sk) => sk.level === equippedLevel)?.name}
              </p>
            )}
          </div>
        )}

        {power && (
          <div className="plate w-full px-4 py-3">
            <div className="flex items-center gap-2">
              <Shield className={`size-4 shrink-0 ${RARITY_TEXT[creature.rarity]}`} />
              <p className="font-heading text-[16px] font-bold uppercase leading-none tracking-[0.08em]">
                {breakdown ? breakdown.name : power.name}
              </p>
              {tierBadge && (
                <span className="stamp ml-auto h-6 px-2 text-[13px] uppercase tracking-[0.06em]">
                  {tierBadge}
                </span>
              )}
            </div>
            {breakdown ? (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="stamp h-11 min-w-16 shrink-0 whitespace-nowrap px-2 text-[20px] text-emerald-300">
                    {breakdown.attract.delta}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                      Attractif
                    </p>
                    <p className="text-xs leading-snug text-foreground">{breakdown.attract.text}</p>
                    <p className="mt-0.5 font-heading text-[12px] tabular-nums text-muted-foreground">
                      {breakdown.attract.example}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="stamp h-11 min-w-16 shrink-0 whitespace-nowrap px-2 text-[20px] text-red-300">
                    {breakdown.repel.delta}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
                      Répulsif
                    </p>
                    <p className="text-xs leading-snug text-foreground">{breakdown.repel.text}</p>
                    <p className="mt-0.5 font-heading text-[12px] tabular-nums text-muted-foreground">
                      {breakdown.repel.example}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
                  {power.description}
                </p>
                {power.rules && <PowerRules text={power.rules} reminder className="mt-2" />}
              </>
            )}
          </div>
        )}

        {dust != null && (
          <div className="plate flex w-full items-center gap-3 px-4 py-3">
            <Gem className="size-4 shrink-0 text-sky-700 dark:text-sky-300" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                Porteuse de magnésie
              </p>
              <p className="mt-0.5 text-xs leading-snug text-foreground">
                À chaque éveil, elle dépose <span className="font-bold">+{dust} magnésie</span> —
                la poudre qui délie les Gardiens liés.
              </p>
            </div>
          </div>
        )}

        {(height || weight || creature.habitat) && (
          <div className="plate-stack w-full">
            {(height || weight) && (
              <div className="plate flex items-center justify-around gap-2 px-3 py-3">
                {height && (
                  <div className="flex items-center gap-2.5">
                    <Ruler className={`size-4 ${RARITY_TEXT[creature.rarity]}`} />
                    <div className="text-left">
                      <p className="etched leading-none">Taille</p>
                      <p className="mt-1 font-heading text-[20px] font-bold leading-none tabular-nums">{height}</p>
                    </div>
                  </div>
                )}
                {height && weight && <div aria-hidden className="h-8 w-px bg-border" />}
                {weight && (
                  <div className="flex items-center gap-2.5">
                    <Weight className={`size-4 ${RARITY_TEXT[creature.rarity]}`} />
                    <div className="text-left">
                      <p className="etched leading-none">Poids</p>
                      <p className="mt-1 font-heading text-[20px] font-bold leading-none tabular-nums">{weight}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {creature.habitat && (
              <div className="plate flex items-center gap-3 px-4 py-3">
                <MapPin className={`size-4 shrink-0 ${RARITY_TEXT[creature.rarity]}`} />
                <div className="min-w-0 flex-1">
                  <p className="etched leading-none">Milieu</p>
                  <p className="mt-1 text-sm font-semibold">{creature.habitat}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {flavorText ? (
          <div className="plate w-full px-4 py-3 text-sm leading-relaxed text-foreground">
            {flavorText}
          </div>
        ) : (
          <div className="plate w-full px-4 py-3 text-center text-xs italic text-muted-foreground">
            Aucune description disponible pour le moment.
          </div>
        )}

        {creature.count && creature.count > 1 && (
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            Possédé
            <span className="stamp h-6 min-w-6 px-1.5 text-[14px]">×{creature.count}</span>
          </p>
        )}
      </div>
    </div>
  );
}
