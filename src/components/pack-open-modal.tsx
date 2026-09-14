"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X, ChevronRight, Gem, Package, Eye, Cards, Shield } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "@/components/creature-card";
import { SlotReel, type ReelItem } from "@/components/slot-reel";
import { AnimalEmblem } from "@/components/emblems/animal-emblem";
import { PokemonEmblem } from "@/components/emblems/pokemon-emblem";
import { RarityEmblem } from "@/components/emblems/rarity-emblem";
import { HelpCircle } from "@/components/icons";
import { FUSION_NEXT, RARITIES, RARITY_COLORS, RARITY_LABELS, type Rarity } from "@/lib/rarities";
import {
  PACK_DESCRIPTIONS,
  PACK_LABELS,
  PACK_TYPES,
  PACK_TYPE_WEIGHTS,
  PACK_RARITY_WEIGHTS,
  PACK_CATEGORY_PROB_POKEMON,
  type PackType,
} from "@/lib/pack-types";
import { PACK_ART_URLS } from "@/lib/pack-art-urls";
import { useTalents } from "@/components/talents-provider";
import { TalentDescription } from "@/components/talent-description";
import { magnesieOf, powerLabel, powerShorts } from "@/lib/powers";

type Category = "animal" | "pokemon";
type Stage = "skins" | "pack" | "category" | "rarity" | "creature" | "duplicate";
type Phase = "ready" | "spinning" | "result";

// Un des 3 skins du pack : révélé si la carte est possédée, mystère sinon.
export interface PackSkin {
  level: number;
  category: Category;
  cardRarity: Rarity;
  owned: boolean;
  skinName?: string;
  cardName?: string;
  imageUrl?: string | null;
}
// Skin mystère qui visait la carte tirée — révélé avec elle.
export interface AwaitingSkin {
  level: number;
  name: string;
  imageUrl: string | null;
}

interface CreatureBase {
  id: number;
  slug: string;
  name: string;
  rarity: Rarity;
  imageUrl: string | null;
  kind: Category;
}
interface AnimalCreature extends CreatureBase {
  kind: "animal";
  cardNumber: number | null;
  scientificName: string | null;
  description: string | null;
  lineage?: string | null;
}
interface PokemonCreature extends CreatureBase {
  kind: "pokemon";
  pokedexNumber: number | null;
  primaryType: string | null;
  secondaryType: string | null;
}
type Creature = AnimalCreature | PokemonCreature;

export interface OpenResult {
  packType: PackType;
  category: Category;
  rarity: Rarity;
  creature: Creature;
  isDuplicate: boolean;
  shardsGranted: number;
  // Les odds photographiées au moment du tirage (avant consommation).
  oddsUsed?: LiveOdds;
  // Talent caché découvert à la première obtention de cette carte.
  talent?: {
    id: string;
    family: string;
    name: string;
    description: string;
  } | null;
  // Les 3 skins tirés avant la carte, et ceux qui attendaient la carte.
  skins?: PackSkin[];
  skinOdds?: Partial<Record<Rarity, number>>;
  awaitingSkins?: AwaitingSkin[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  animal: "Animal",
  pokemon: "Pokémon",
};

const TIER_BACK_GRADIENT: Record<Rarity, string> = {
  common:    "from-zinc-700 via-zinc-900 to-zinc-950",
  uncommon:  "from-emerald-700 via-emerald-900 to-emerald-950",
  rare:      "from-sky-700 via-sky-900 to-sky-950",
  epic:      "from-violet-700 via-violet-900 to-violet-950",
  legendary: "from-amber-700 via-amber-900 to-amber-950",
  mythic:    "from-rose-700 via-fuchsia-900 to-rose-950",
};
const TIER_BACK_RING: Record<Rarity, string> = {
  common:    "ring-zinc-500/50",
  uncommon:  "ring-emerald-500/60",
  rare:      "ring-sky-500/70",
  epic:      "ring-violet-500/70",
  legendary: "ring-amber-500/80",
  mythic:    "ring-rose-500",
};

const PACK_HALO: Record<PackType, string> = {
  basic:        "bg-orange-500/30",
  animal_only:  "bg-emerald-500/35",
  pokemon_only: "bg-sky-500/35",
  premium:      "bg-amber-500/45",
  mythic:       "bg-rose-500/55",
};

const TIER_RING_BIG: Record<Rarity, string> = {
  common:    "ring-zinc-400/40",
  uncommon:  "ring-emerald-400/50",
  rare:      "ring-sky-400/60",
  epic:      "ring-violet-400/70",
  legendary: "ring-amber-400/80",
  mythic:    "ring-rose-400",
};
const TIER_BG_BIG: Record<Rarity, string> = {
  common:    "bg-zinc-500/20",
  uncommon:  "bg-emerald-500/20",
  rare:      "bg-sky-500/20",
  epic:      "bg-violet-500/20",
  legendary: "bg-amber-500/20",
  mythic:    "bg-rose-500/25",
};
const TIER_GLOW_BIG: Record<Rarity, string> = {
  common:    "",
  uncommon:  "shadow-[0_0_50px_-10px_rgba(52,211,153,0.5)]",
  rare:      "shadow-[0_0_60px_-8px_rgba(56,189,248,0.7)]",
  epic:      "shadow-[0_0_70px_-6px_rgba(167,139,250,0.8)]",
  legendary: "shadow-[0_0_90px_-4px_rgba(251,191,36,0.85)]",
  mythic:    "shadow-[0_0_110px_-2px_rgba(244,114,182,0.95)]",
};

// ─── Pack tile (full size for the SlotReel) ──────────────────────────────
function PackTile({ packType }: { packType: PackType }) {
  const isHolo = packType === "premium" || packType === "mythic";
  return (
    <div className="relative h-72 w-52">
      <div className={`absolute inset-0 -m-6 rounded-full ${PACK_HALO[packType]} blur-3xl`} />
      <Image
        src={PACK_ART_URLS[packType]}
        alt={PACK_LABELS[packType]}
        fill
        unoptimized
        className="relative object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.7)]"
      />
      {isHolo && (
        <div className="pointer-events-none absolute inset-0 holo-shimmer rounded-2xl" />
      )}
    </div>
  );
}

function CardBack({ rarity }: { rarity: Rarity }) {
  const isHolo = rarity === "legendary" || rarity === "mythic";
  return (
    <div
      className={`relative aspect-[3/4] w-72 overflow-hidden rounded-xl border-2 border-white/5 bg-gradient-to-b shadow-2xl ring-2 ${TIER_BACK_GRADIENT[rarity]} ${TIER_BACK_RING[rarity]} ${TIER_GLOW_BIG[rarity]}`}
    >
      {isHolo && (
        <div className="pointer-events-none absolute inset-0 holo-shimmer" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08)_0%,transparent_60%)]" />
      {/* Center : rarity emblem dimmed + a subtle ? glyph */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="opacity-40">
          <RarityEmblem rarity={rarity} size={180} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <HelpCircle className="size-12 text-white/15" strokeWidth={1.5} />
      </div>
    </div>
  );
}

function PackTileMini({ packType }: { packType: PackType }) {
  return (
    <div className="relative aspect-[2/3] w-full">
      <div className={`absolute inset-0 -m-2 rounded-full ${PACK_HALO[packType]} blur-2xl opacity-80`} />
      <Image
        src={PACK_ART_URLS[packType]}
        alt={PACK_LABELS[packType]}
        fill
        unoptimized
        className="relative object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
      />
    </div>
  );
}

const PACK_SHORT_NAME: Record<PackType, string> = {
  basic:        "Basique",
  animal_only:  "Animal",
  pokemon_only: "Pokémon",
  premium:      "Premium",
  mythic:       "Mythique",
};

const PACK_ITEMS: ReelItem[] = PACK_TYPES.map((t) => ({
  key: t,
  render: () => <PackTile packType={t} />,
}));

const CATEGORY_ITEMS: ReelItem[] = [
  { key: "animal",  render: () => <AnimalEmblem /> },
  { key: "pokemon", render: () => <PokemonEmblem /> },
];

const RARITY_ITEMS: ReelItem[] = RARITIES.map((r) => ({
  key: r,
  render: () => <RarityEmblem rarity={r} />,
}));

// ─── Preview rows ────────────────────────────────────────────────────────
// Les pourcentages VIVANTS : le chapeau chargé par les Gardiens, pas les
// poids de base. Quand l'énergie a bougé une porte, la valeur s'affiche en
// couleur avec sa base barrée — l'impact des cartes se voit, enfin.

export interface LiveOdds {
  hat: Partial<Record<PackType, number>>;
  innerShift?: number;
  // Le dé de rareté déformé par les Skins des gardiens éveillés — en
  // dixièmes de point de % par rareté (ex. { common: -60, legendary: 10 }).
  rarityShift?: Partial<Record<Rarity, number>>;
}

function LivePct({
  live,
  base,
  className = "font-mono text-[11px] font-bold tabular-nums",
}: {
  live: number;
  base: number;
  className?: string;
}) {
  const boosted = live > base;
  const nerfed = live < base;
  if (!boosted && !nerfed) {
    return <span className={`${className} text-muted-foreground`}>{live}%</span>;
  }
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className={`${className} ${boosted ? "text-emerald-300" : "text-red-300"}`}>
        {live}%
      </span>
      <span className="font-mono text-[9px] tabular-nums text-muted-foreground/60 line-through decoration-1">
        {base}%
      </span>
    </span>
  );
}

function PackPreviewRow({ odds }: { odds?: LiveOdds }) {
  return (
    <div className="flex w-full items-end justify-between gap-2">
      {PACK_TYPES.map((t) => (
        <div key={t} className="flex flex-1 flex-col items-center gap-2">
          <PackTileMini packType={t} />
          <p className="text-[10px] font-black uppercase tracking-wider text-foreground/85 text-center leading-tight">
            {PACK_SHORT_NAME[t]}
          </p>
          <LivePct
            live={odds?.hat[t] ?? PACK_TYPE_WEIGHTS[t]}
            base={PACK_TYPE_WEIGHTS[t]}
          />
        </div>
      ))}
    </div>
  );
}

function CategoryPreviewRow({ packType, odds }: { packType: PackType; odds?: LiveOdds }) {
  const base = PACK_CATEGORY_PROB_POKEMON[packType];
  // La Balance ne penche que les packs mixtes — 1 point = 1 %, bornes 5/95.
  const shifted =
    base > 0 && base < 1
      ? Math.min(0.95, Math.max(0.05, base + (odds?.innerShift ?? 0) / 100))
      : base;
  const pPokemon = Math.round(shifted * 100);
  const pAnimal = 100 - pPokemon;
  const basePokemon = Math.round(base * 100);
  return (
    <div className="flex w-full items-end justify-around gap-6">
      <div className="flex flex-1 flex-col items-center gap-3">
        <AnimalEmblem size={168} />
        <p className="text-sm font-black uppercase tracking-wider text-foreground">
          Animal
        </p>
        <LivePct
          live={pAnimal}
          base={100 - basePokemon}
          className="font-mono text-base font-black tabular-nums"
        />
      </div>
      <div className="flex flex-1 flex-col items-center gap-3">
        <PokemonEmblem size={168} />
        <p className="text-sm font-black uppercase tracking-wider text-foreground">
          Pokémon
        </p>
        <LivePct
          live={pPokemon}
          base={basePokemon}
          className="font-mono text-base font-black tabular-nums"
        />
      </div>
    </div>
  );
}

function RarityPreviewRow({ packType, shift }: { packType: PackType; shift?: Partial<Record<Rarity, number>> }) {
  const weights = PACK_RARITY_WEIGHTS[packType];
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <div className="flex w-full items-end justify-between gap-1.5">
      {RARITIES.map((r) => {
        const pct = total > 0 ? Math.round((weights[r] / total) * 100) : 0;
        // Les Skins des gardiens éveillés déforment le dé (dixièmes de %) —
        // la roue montre les VRAIS pourcentages du tirage.
        const delta = (shift?.[r] ?? 0) / 10;
        const live = Math.max(0, Math.round((pct + delta) * 10) / 10);
        const dim = weights[r] === 0 && live === 0;
        return (
          <div
            key={r}
            className={`flex flex-1 flex-col items-center gap-1.5 ${dim ? "opacity-25" : ""}`}
          >
            <div className="aspect-square w-full max-w-[58px]">
              <RarityEmblem rarity={r} size={58} />
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-foreground/80 text-center leading-tight">
              {RARITY_LABELS[r]}
            </p>
            <LivePct live={live} base={pct} className="font-mono text-[10px] font-bold tabular-nums" />
          </div>
        );
      })}
    </div>
  );
}

// La roue des skins annonce ses VRAIS pourcentages : calculés serveur sur
// le pool réel des skins générés non possédés. Une rareté encore absente
// du pool (l'usine fait les faciles d'abord) s'affiche estompée à 0 % —
// les légendaires et mythiques grossissent au fil de la génération.
function SkinOddsRow({ odds }: { odds?: Partial<Record<Rarity, number>> }) {
  if (!odds) return null;
  return (
    <div className="flex w-full items-end justify-between gap-1.5">
      {RARITIES.map((r) => {
        const pct = odds[r] ?? 0;
        const dim = pct === 0;
        return (
          <div
            key={r}
            className={`flex flex-1 flex-col items-center gap-1.5 ${dim ? "opacity-25" : ""}`}
          >
            <div className="aspect-square w-full max-w-[58px]">
              <RarityEmblem rarity={r} size={58} />
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-foreground/80 text-center leading-tight">
              {RARITY_LABELS[r]}
            </p>
            <span className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────
export function PackOpenModal({
  result,
  onClose,
  odds,
}: {
  result: OpenResult;
  onClose: () => void;
  // Le chapeau au moment de l'ouverture : les impacts des Gardiens, visibles.
  odds?: LiveOdds;
}) {
  // Priorité aux odds du tirage lui-même (photographiées côté serveur) —
  // le fallback est l'état courant du chapeau.
  const liveOdds = result.oddsUsed ?? odds;
  // Décors d'ouverture débloqués par les Talents.
  const { has } = useTalents();
  const hasAnneaux = has("anneaux");
  const hasZiz = has("vol-de-ziz");
  const skipCategory = result.packType === "animal_only" || result.packType === "pokemon_only";

  const skins = result.skins ?? [];
  const hasSkins = skins.length > 0;

  const stageOrder = useMemo<Stage[]>(() => {
    const base: Stage[] = skipCategory
      ? ["pack", "rarity", "creature"]
      : ["pack", "category", "rarity", "creature"];
    return hasSkins ? ["skins", ...base] : base;
  }, [skipCategory, hasSkins]);

  const [stage, setStage] = useState<Stage>(hasSkins ? "skins" : "pack");
  const [phase, setPhase] = useState<Phase>("ready");
  // Sous-étape des skins : lequel des 3 est en cours.
  const [skinIdx, setSkinIdx] = useState(0);

  // Reset phase when stage changes (so creature also starts in 'ready' = card-back)
  useEffect(() => {
    if (stage === "skins" || stage === "pack" || stage === "category" || stage === "rarity" || stage === "creature") {
      setPhase("ready");
    }
  }, [stage]);

  const colors = RARITY_COLORS[result.rarity];
  const categoryLabel = CATEGORY_LABELS[result.category];
  const isHolo = result.rarity === "legendary" || result.rarity === "mythic";
  const nextRarity = FUSION_NEXT[result.rarity];

  const advanceStage = () => {
    const idx = stageOrder.indexOf(stage);
    const next = stageOrder[idx + 1];
    if (next) setStage(next);
  };

  // Passer au skin suivant, ou quitter l'étape après le 3e.
  const advanceSkin = () => {
    if (skinIdx + 1 < skins.length) {
      setSkinIdx((i) => i + 1);
      setPhase("ready");
    } else {
      advanceStage();
    }
  };

  const handleBackdropClick = () => {
    if (stage === "creature" || stage === "duplicate") return;
    if (phase !== "result") return;
    if (stage === "skins") advanceSkin();
    else advanceStage();
  };

  const triggerSpin = () => {
    if (phase === "ready") setPhase("spinning");
  };

  // Action button label per stage
  const stageActionLabel: Record<Exclude<Stage, "creature" | "duplicate">, string> = {
    skins: "Tirer le skin",
    pack: "Ouvrir le pack",
    category: "Révéler la catégorie",
    rarity: "Tirer la rareté",
  };
  const currentSkin = skins[skinIdx];

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex select-none items-center justify-center overflow-y-auto bg-black/85 backdrop-blur-sm"
    >
      {/* Le Vol de Ziz : des plumes-cartes tombent du ciel pendant l'ouverture */}
      {hasZiz && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="ziz-feather absolute top-0 rounded-[2px] bg-gradient-to-b from-amber-200/50 to-amber-500/30"
              style={{
                left: `${(i * 71) % 100}%`,
                width: 5 + (i % 3) * 2,
                height: 14 + (i % 4) * 4,
                animationDuration: `${4 + (i % 5)}s`,
                animationDelay: `${(i % 7) * 0.7}s`,
              }}
            />
          ))}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
      >
        <X className="size-5" />
      </button>

      <div className="flex w-full max-w-xl flex-col items-center gap-6 px-6 py-12">
        {/* STAGE SKINS — 3 skins avant la carte */}
        {stage === "skins" && currentSkin && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Skin {skinIdx + 1} / {skins.length}
            </p>

            {phase === "ready" && (
              <>
                {skinIdx === 0 && (
                  <p className="text-center text-xs leading-relaxed text-muted-foreground">
                    3 skins tombent avant ta carte.
                    <br />
                    Carte possédée : le skin se révèle. Sinon, il reste <span className="font-black text-primary">mystère</span>.
                  </p>
                )}
                <SkinOddsRow odds={result.skinOdds} />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSpin();
                  }}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  <Eye className="size-4" />
                  {stageActionLabel.skins}
                </Button>
              </>
            )}

            {phase === "spinning" && (
              <SlotReel
                items={RARITY_ITEMS}
                targetKey={currentSkin.cardRarity}
                itemWidth={232}
                duration={2800}
                loops={5}
                onSettle={() => setPhase("result")}
              />
            )}

            {phase === "result" && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex w-full flex-col items-center gap-4 animate-card-reveal"
              >
                {currentSkin.owned ? (
                  <>
                    <div className="w-64 overflow-hidden rounded-xl border-2 border-white/5 bg-card ring-2 ring-emerald-500/60 shadow-[0_0_36px_-6px_rgba(16,185,129,0.5)]">
                      <div className="relative aspect-square w-full bg-black/40">
                        {currentSkin.imageUrl ? (
                          <Image src={currentSkin.imageUrl} alt="" fill unoptimized className="object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            L&apos;image se révèle bientôt…
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-sm font-black tracking-tight">« {currentSkin.skinName} »</p>
                        <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                          {currentSkin.cardName} · {RARITY_LABELS[currentSkin.cardRarity]} · Niveau {currentSkin.level}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-500/30">
                      Nouveau skin — équipable dans sa garde-robe
                    </span>
                  </>
                ) : (
                  <>
                    <CardBack rarity={currentSkin.cardRarity} />
                    <div className="text-center">
                      <p className={`text-xl font-black tracking-tight ${RARITY_COLORS[currentSkin.cardRarity].text}`}>
                        {CATEGORY_LABELS[currentSkin.category]} {RARITY_LABELS[currentSkin.cardRarity].toLowerCase()}
                      </p>
                      <span className="mt-1.5 inline-block rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ring-1 ring-white/15">
                        Niveau {currentSkin.level}
                      </span>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Skin mystère — il se révélera le jour où tu tireras sa carte.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-1.5">
                  {skins.map((_, i) => (
                    <span
                      key={i}
                      className={`size-1.5 rounded-full ${i <= skinIdx ? "bg-primary" : "bg-white/15"}`}
                    />
                  ))}
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    advanceSkin();
                  }}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  {skinIdx + 1 < skins.length ? "Skin suivant" : "Et maintenant… ta carte"}
                </Button>
              </div>
            )}
          </>
        )}

        {/* STAGE 0 — Pack */}
        {stage === "pack" && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Pack
            </p>

            {phase === "ready" && (
              <>
                <PackPreviewRow odds={liveOdds} />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSpin();
                  }}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  <Package className="size-4" />
                  {stageActionLabel.pack}
                </Button>
              </>
            )}

            {phase === "spinning" && (
              <SlotReel
                items={PACK_ITEMS}
                targetKey={result.packType}
                itemWidth={232}
                duration={3400}
                loops={4}
                onSettle={() => setPhase("result")}
              />
            )}

            {phase === "result" && (
              <div className="flex flex-col items-center gap-4 animate-card-reveal">
                <PackTile packType={result.packType} />
                <div className="text-center">
                  <p className="text-3xl font-black tracking-tighter">
                    {PACK_LABELS[result.packType]}
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {PACK_DESCRIPTIONS[result.packType]}
                  </p>
                </div>
                <TapHint />
              </div>
            )}
          </>
        )}

        {/* STAGE 1 — Category */}
        {stage === "category" && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Catégorie
            </p>

            {phase === "ready" && (
              <>
                <CategoryPreviewRow packType={result.packType} odds={liveOdds} />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSpin();
                  }}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  <Eye className="size-4" />
                  {stageActionLabel.category}
                </Button>
              </>
            )}

            {phase === "spinning" && (
              <SlotReel
                items={CATEGORY_ITEMS}
                targetKey={result.category}
                itemWidth={232}
                duration={3000}
                loops={6}
                onSettle={() => setPhase("result")}
              />
            )}

            {phase === "result" && (
              <div className="flex flex-col items-center gap-4 animate-card-reveal">
                {result.category === "animal" ? <AnimalEmblem /> : <PokemonEmblem />}
                <p className="text-5xl font-black tracking-tighter text-primary">
                  {categoryLabel}
                </p>
                <TapHint />
              </div>
            )}
          </>
        )}

        {/* STAGE 2 — Rarity */}
        {stage === "rarity" && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Rareté
            </p>

            {phase === "ready" && (
              <>
                <RarityPreviewRow packType={result.packType} shift={liveOdds?.rarityShift} />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSpin();
                  }}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  <Eye className="size-4" />
                  {stageActionLabel.rarity}
                </Button>
              </>
            )}

            {phase === "spinning" && (
              <SlotReel
                items={RARITY_ITEMS}
                targetKey={result.rarity}
                itemWidth={232}
                duration={3400}
                loops={5}
                onSettle={() => setPhase("result")}
              />
            )}

            {phase === "result" && (
              <div className="flex flex-col items-center gap-4 animate-card-reveal">
                <RarityEmblem rarity={result.rarity} />
                <p className={`text-5xl font-black tracking-tighter ${colors.text}`}>
                  {RARITY_LABELS[result.rarity]}
                </p>
                <TapHint />
              </div>
            )}
          </>
        )}

        {/* STAGE 3 — Creature */}
        {stage === "creature" && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full flex-col items-center gap-5"
          >
            {phase === "ready" ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                  Ta carte
                </p>
                <CardBack rarity={result.rarity} />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhase("result");
                  }}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  <Cards className="size-3.5" />
                  Révéler la carte
                </Button>
              </>
            ) : (
              <>
                <div className="relative w-72 animate-creature-reveal">
                  {/* Les Anneaux de Hoopa : la carte sort d'un anneau doré */}
                  {hasAnneaux && (
                    <>
                      <div className="hoopa-ring pointer-events-none absolute inset-[-12%] rounded-full" />
                      <div className="hoopa-ring hoopa-ring-2 pointer-events-none absolute inset-[-12%] rounded-full" />
                      <div className="hoopa-ring hoopa-ring-3 pointer-events-none absolute inset-[-12%] rounded-full" />
                    </>
                  )}
                  <CreatureCard
                    name={result.creature.name}
                    rarity={result.rarity}
                    imageUrl={result.creature.imageUrl}
                    number={
                      result.creature.kind === "animal"
                        ? result.creature.cardNumber
                        : result.creature.pokedexNumber
                    }
                    category={result.category}
                    primaryType={result.creature.kind === "pokemon" ? result.creature.primaryType : undefined}
                    secondaryType={result.creature.kind === "pokemon" ? result.creature.secondaryType : undefined}
                    size="lg"
                  />
                </div>

                <div className="text-center">
                  <p className={`text-xs font-black uppercase tracking-widest ${colors.text}`}>
                    {RARITY_LABELS[result.rarity]} · {categoryLabel}
                  </p>
                  {result.isDuplicate && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tu possèdes déjà cette carte
                    </p>
                  )}
                </div>

                {/* Ce que la carte APPORTE : son pouvoir de Gardien, sa
                    magnésie éventuelle — l'impact se lit dès le tirage. */}
                {(() => {
                  const subtype =
                    result.creature.kind === "pokemon"
                      ? result.creature.primaryType ?? null
                      : result.creature.lineage ?? null;
                  const big = result.rarity === "legendary" || result.rarity === "mythic";
                  const hint = big
                    ? powerLabel(result.creature.kind, result.rarity, subtype, result.creature.slug).name
                    : powerShorts(result.creature.kind, subtype, result.rarity).tiny;
                  const dust = magnesieOf(result.creature.kind, result.creature.slug, result.rarity);
                  return (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-black text-primary ring-1 ring-primary/30">
                        <Shield className="size-3" />
                        Gardien : {hint}
                      </span>
                      {dust != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2 py-1 text-[10px] font-black text-sky-300 ring-1 ring-sky-500/30">
                          <Gem className="size-3" />
                          +{dust} magnésie / éveil
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Les skins mystère qui visaient cette carte, révélés avec elle */}
                {!result.isDuplicate && (result.awaitingSkins?.length ?? 0) > 0 && (
                  <div className="w-full max-w-sm rounded-2xl bg-amber-400/5 px-4 py-3 ring-1 ring-amber-400/40 animate-card-reveal">
                    <p className="text-center text-xs font-black">
                      ✨ <span className="text-amber-300">{result.awaitingSkins!.length === 1 ? "1 skin t'attendait" : `${result.awaitingSkins!.length} skins t'attendaient`}</span> pour cette carte
                    </p>
                    <div className="mt-2.5 flex flex-wrap justify-center gap-2.5">
                      {result.awaitingSkins!.map((s, i) => (
                        <div key={i} className="w-28 overflow-hidden rounded-xl bg-card ring-1 ring-amber-400/50">
                          <div className="relative aspect-square w-full bg-black/40">
                            {s.imageUrl ? (
                              <Image src={s.imageUrl} alt="" fill unoptimized className="object-contain" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground">Bientôt…</div>
                            )}
                            <span className="absolute right-1 top-1 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 px-1.5 py-0.5 text-[8px] font-black text-black">
                              N{s.level}
                            </span>
                          </div>
                          <p className="px-1.5 py-1.5 text-center text-[9px] font-bold leading-tight">« {s.name} »</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[10px] text-muted-foreground">
                      Révélés — ils rejoignent sa garde-robe
                    </p>
                  </div>
                )}

                {/* Le jackpot dans le jackpot : un Talent caché découvert */}
                {result.talent && (
                  <div className="w-full max-w-xs rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-400/60 shadow-[0_0_44px_-8px_rgba(251,191,36,0.8)] animate-card-reveal">
                    <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
                      Talent caché découvert
                    </p>
                    <p className="mt-1.5 text-center text-base font-black tracking-tight text-amber-200">
                      {result.talent.name}
                    </p>
                    <TalentDescription
                      text={result.talent.description}
                      className="mt-1 text-left text-xs leading-relaxed text-amber-100/80"
                    />
                    <p className="mt-2 text-center text-[10px] font-bold text-amber-200/60">
                      Inscrit dans ton Grimoire — certains talents ouvrent l&apos;Oracle
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => (result.isDuplicate ? setStage("duplicate") : onClose())}
                  className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  {result.isDuplicate ? "Voir ma récompense" : "Continuer"}
                </Button>
              </>
            )}
          </div>
        )}

        {/* STAGE 4 — Duplicate */}
        {stage === "duplicate" && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full flex-col items-center gap-6 animate-card-reveal"
          >
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                Doublon
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight">
                Cette carte se transforme
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-24 opacity-50 grayscale">
                <CreatureCard
                  name={result.creature.name}
                  rarity={result.rarity}
                  imageUrl={result.creature.imageUrl}
                  number={
                    result.creature.kind === "animal"
                      ? result.creature.cardNumber
                      : result.creature.pokedexNumber
                  }
                  category={result.category}
                  size="sm"
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <ChevronRight className={`size-6 ${colors.text}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  devient
                </span>
              </div>
              <div
                className={`relative flex size-24 items-center justify-center rounded-2xl ring-2 ${TIER_RING_BIG[result.rarity]} ${TIER_BG_BIG[result.rarity]} ${TIER_GLOW_BIG[result.rarity]}`}
              >
                {isHolo && (
                  <div className="pointer-events-none absolute inset-0 rounded-2xl holo-shimmer" />
                )}
                <Gem className={`size-12 ${colors.text}`} strokeWidth={1.5} />
              </div>
            </div>

            <div className="text-center">
              <p className={`text-3xl font-black tracking-tighter ${colors.text}`}>
                +1 fragment
              </p>
              <p className={`mt-1 text-xs font-black uppercase tracking-widest ${colors.text}`}>
                {RARITY_LABELS[result.rarity]} · {categoryLabel}
              </p>
              {nextRarity && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Combine <span className="font-mono tabular-nums">3</span> fragments {RARITY_LABELS[result.rarity].toLowerCase()}{" "}
                  pour fusionner en une carte{" "}
                  <span className={`font-bold ${RARITY_COLORS[nextRarity].text}`}>
                    {RARITY_LABELS[nextRarity].toLowerCase()}
                  </span>
                </p>
              )}
            </div>

            <Button
              onClick={onClose}
              className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
            >
              Continuer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TapHint() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/80 animate-pulse">
      <span>Tape pour continuer</span>
      <ChevronRight className="size-3" />
    </div>
  );
}
