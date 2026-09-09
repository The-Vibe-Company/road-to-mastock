"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flame, PawPrint, Zap, Vault, Star, Package, Sparkles, Shield, BookOpen, ChevronDown, ChevronUp, Funnel } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BackButton } from "@/components/back-button";
import { PackOpenModal, type OpenResult } from "@/components/pack-open-modal";
import { CreatureCard } from "@/components/creature-card";
import { CardDetailModal, type DetailedCreature } from "@/components/card-detail-modal";
import { SpinWheelModal } from "@/components/spin-wheel-modal";
import {
  RARITIES,
  RARITY_LABELS,
  FUSION_COST,
  FUSION_NEXT,
  CONVERSION_BATCH,
  CONVERSION_RATE,
  type Rarity,
} from "@/lib/rarities";
import { PACK_TYPE_WEIGHTS, type PackType } from "@/lib/pack-types";
import { useTalents } from "@/components/talents-provider";
import { ThroneBackdrop } from "@/components/throne-backdrop";
import { Spinner } from "@/components/spinner";

type Category = "animal" | "pokemon";
// La vue catégorie : « Tous » mélange les deux classeurs.
type CatView = "all" | Category;
type Filter = "all" | Rarity;
// Les critères du tiroir : cumulables, chaque carte doit tous les cocher.
type Crit = "magnesie" | "talent" | "forge" | "guardian" | "skin";

const CRIT_DEFS: { key: Crit; label: string; hint: string; Icon: typeof Flame; tint: string; ring: string }[] = [
  { key: "magnesie", label: "Magnésie", hint: "la carte rapporte de la magnésie à l'éveil", Icon: Sparkles, tint: "text-sky-300", ring: "ring-sky-400/40 bg-sky-500/10" },
  { key: "talent", label: "Grimoire", hint: "la carte porte un talent caché", Icon: BookOpen, tint: "text-violet-300", ring: "ring-violet-400/40 bg-violet-500/10" },
  { key: "forge", label: "Forge", hint: "son pouvoir nourrit la jauge de Forge", Icon: Flame, tint: "text-primary", ring: "ring-primary/40 bg-primary/10" },
  { key: "guardian", label: "Gardiens", hint: "actuellement postée sur une machine", Icon: Shield, tint: "text-amber-300", ring: "ring-amber-400/40 bg-amber-500/10" },
  { key: "skin", label: "Skins", hint: "possède au moins un skin dans sa garde-robe", Icon: Star, tint: "text-emerald-300", ring: "ring-emerald-400/40 bg-emerald-500/10" },
];

const TIER_DOT: Record<Rarity, string> = {
  common:    "bg-zinc-400",
  uncommon:  "bg-emerald-400",
  rare:      "bg-sky-400",
  epic:      "bg-violet-400",
  legendary: "bg-amber-400",
  mythic:    "bg-rose-400",
};

const TIER_TEXT: Record<Rarity, string> = {
  common:    "text-zinc-300",
  uncommon:  "text-emerald-300",
  rare:      "text-sky-300",
  epic:      "text-violet-300",
  legendary: "text-amber-300",
  mythic:    "text-rose-300",
};

const TIER_FILL: Record<Rarity, string> = {
  common:    "bg-zinc-500/15 ring-zinc-500/40",
  uncommon:  "bg-emerald-500/15 ring-emerald-500/40",
  rare:      "bg-sky-500/15 ring-sky-500/40",
  epic:      "bg-violet-500/15 ring-violet-500/50",
  legendary: "bg-amber-500/15 ring-amber-500/60",
  mythic:    "bg-rose-500/15 ring-rose-500/70",
};

interface CardSkin {
  level: number;
  name: string;
  imageUrl: string | null;
  owned: boolean;
}

interface CardTraits {
  magnesie: boolean;
  talent: boolean;
  forge: boolean;
  guardian: boolean;
}

interface AnimalCard {
  id: number;
  traits?: CardTraits;
  skins?: CardSkin[];
  equippedSkinLevel?: number | null;
  baseImageUrl?: string | null;
  count: number;
  firstObtainedAt: string;
  slug: string;
  name: string;
  nickname: string | null;
  rarity: Rarity;
  lineage: string | null;
  cardNumber: number | null;
  scientificName: string | null;
  imageUrl: string | null;
  description: string | null;
  flavor: string | null;
  heightCm: number | null;
  weightKg: number | null;
  habitat: string | null;
}

interface PokemonCard {
  id: number;
  traits?: CardTraits;
  skins?: CardSkin[];
  equippedSkinLevel?: number | null;
  baseImageUrl?: string | null;
  count: number;
  firstObtainedAt: string;
  slug: string;
  name: string;
  nickname: string | null;
  rarity: Rarity;
  pokedexNumber: number | null;
  primaryType: string | null;
  secondaryType: string | null;
  imageUrl: string | null;
  flavor: string | null;
  heightCm: number | null;
  weightKg: number | null;
  habitat: string | null;
}

interface CollectionData {
  animals: { cards: AnimalCard[]; totalsByRarity: Record<Rarity, number>; shards: Record<Rarity, number> };
  pokemon: { cards: PokemonCard[]; totalsByRarity: Record<Rarity, number>; shards: Record<Rarity, number> };
  tokens: number;
  specialTokens: number;
  charges?: Record<string, number>;
  odds?: {
    hat: Record<PackType, number>;
    innerPokemon: number;
    innerShift?: number;
    wheel: Record<string, number>;
  };
  // Les skins mystère : gagnés aux packs pour des cartes pas encore
  // possédées — comptés sans révéler la carte.
  skinReserve?: { category: "animal" | "pokemon"; rarity: Rarity; level: number; count: number }[];
  mysterySkins?: { category: "animal" | "pokemon"; rarity: Rarity; level: number }[];
}

// La vue « Tous mes skins » : anneaux et badges par niveau.
const LEVEL_RING: Record<number, string> = {
  1: "ring-zinc-500/50", 2: "ring-emerald-500/60", 3: "ring-sky-500/60",
  4: "ring-violet-500/70", 5: "ring-amber-500/90",
};
const LEVEL_BADGE: Record<number, string> = {
  1: "bg-zinc-600 text-zinc-100", 2: "bg-emerald-600 text-emerald-50", 3: "bg-sky-600 text-sky-50",
  4: "bg-violet-600 text-violet-50", 5: "bg-gradient-to-br from-amber-300 to-amber-600 text-black",
};
const MYST_BG: Record<Rarity, string> = {
  common: "from-zinc-700 via-zinc-900 to-zinc-950",
  uncommon: "from-emerald-700 via-emerald-900 to-emerald-950",
  rare: "from-sky-700 via-sky-900 to-sky-950",
  epic: "from-violet-700 via-violet-900 to-violet-950",
  legendary: "from-amber-700 via-amber-900 to-amber-950",
  mythic: "from-rose-700 via-fuchsia-900 to-rose-950",
};

const RESERVE_TEXT: Record<Rarity, string> = {
  common: "text-zinc-300",
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  epic: "text-violet-300",
  legendary: "text-amber-300",
  mythic: "text-rose-300",
};

function StableCount({ owned, total }: { owned: number; total: number }) {
  return (
    <span className="font-mono text-[10px] tabular-nums">
      <span className="inline-block w-6 text-right">{owned}</span>
      <span className="opacity-50">/</span>
      <span className="inline-block w-6 text-left">{total}</span>
    </span>
  );
}

export default function CollectionPage() {
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CatView>("all");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  // Le panneau ▾ : jetons spéciaux, énergie, progression, Forge.
  const [detailOpen, setDetailOpen] = useState(false);
  // La vue « Tous mes skins » : remplace la grille des cartes.
  const [showSkins, setShowSkins] = useState(false);
  // Le tiroir des critères, et les critères cochés.
  const [showCrits, setShowCrits] = useState(false);
  const [crits, setCrits] = useState<Crit[]>([]);
  const [opening, setOpening] = useState(false);
  const [fusing, setFusing] = useState<Rarity | null>(null);
  const [converting, setConverting] = useState<Rarity | null>(null);
  // La Roue de la Forge : tirage en cours, puis le fragment gagné.
  const [forging, setForging] = useState(false);
  const [forgeWin, setForgeWin] = useState<{ rarity: Rarity; category: Category } | null>(null);
  const [modalResult, setModalResult] = useState<OpenResult | null>(null);
  const [detailCreature, setDetailCreature] = useState<DetailedCreature | null>(null);
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const { has } = useTalents();
  // L'Inclassable (Ornithorynque) : des tris merveilleux et inutiles.
  const [sortMode, setSortMode] = useState<"rarity" | "name" | "height" | "weight" | "habitat">("rarity");

  const refresh = async () => {
    try {
      // Timeout de 8 s : une requête gelée pendant une transition iOS ne
      // doit jamais verrouiller la page sur son spinner.
      const r = await fetch("/api/cards", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) setData(await r.json());
    } catch {
      // réseau : on retentera au prochain passage
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Retour depuis une autre page : les effets ne se relancent pas sur une
    // restauration bfcache (persisted), et un history load complet peut
    // resservir le HTML-spinner — on recharge dans les deux cas.
    const onShow = () => refresh();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenPack = async () => {
    if (opening || !data || data.tokens < 1) return;
    setOpening(true);
    try {
      const r = await fetch("/api/cards/open", { method: "POST" });
      if (!r.ok) return;
      setModalResult(await r.json());
      await refresh();
    } finally {
      setOpening(false);
    }
  };

  const handleForgeWheel = async () => {
    if (forging) return;
    setForging(true);
    try {
      const r = await fetch("/api/cards/forge", { method: "POST" });
      if (!r.ok) return;
      const win = await r.json();
      setForgeWin({ rarity: win.rarity, category: win.category });
      await refresh();
    } finally {
      setForging(false);
    }
  };

  const handleFuse = async (rarity: Rarity) => {
    if (fusing) return;
    setFusing(rarity);
    try {
      const r = await fetch("/api/cards/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromRarity: rarity, category: activeCategory === "all" ? "animal" : activeCategory }),
      });
      if (!r.ok) return;
      setModalResult(await r.json());
      await refresh();
    } finally {
      setFusing(null);
    }
  };

  const handleConvert = async (rarity: Rarity) => {
    if (converting) return;
    setConverting(rarity);
    try {
      const r = await fetch("/api/cards/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rarity, category: activeCategory === "all" ? "animal" : activeCategory }),
      });
      if (!r.ok) return;
      await refresh();
    } finally {
      setConverting(null);
    }
  };

  const openDetail = (c: Tagged) => {
    if (c.cat === "pokemon") {
      const p = c as PokemonCard;
      setDetailCreature({
        kind: "pokemon", id: p.id, slug: p.slug, name: p.name, nickname: p.nickname, rarity: p.rarity,
        imageUrl: p.imageUrl, count: p.count, flavor: p.flavor,
        skins: p.skins, equippedSkinLevel: p.equippedSkinLevel, baseImageUrl: p.baseImageUrl,
        heightCm: p.heightCm, weightKg: p.weightKg, habitat: p.habitat,
        pokedexNumber: p.pokedexNumber, primaryType: p.primaryType, secondaryType: p.secondaryType,
      });
    } else {
      const a = c as AnimalCard;
      setDetailCreature({
        kind: "animal", id: a.id, slug: a.slug, name: a.name, nickname: a.nickname, rarity: a.rarity,
        imageUrl: a.imageUrl, count: a.count, flavor: a.flavor,
        skins: a.skins, equippedSkinLevel: a.equippedSkinLevel, baseImageUrl: a.baseImageUrl,
        heightCm: a.heightCm, weightKg: a.weightKg, habitat: a.habitat,
        cardNumber: a.cardNumber, scientificName: a.scientificName, description: a.description,
        lineage: a.lineage,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          La Collection ne répond pas. Vérifie ta connexion, puis réessaie.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
          className="rounded-xl bg-secondary/60 px-4 py-2.5 text-sm font-bold text-primary ring-1 ring-border"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // Chaque carte porte sa catégorie : la vue « Tous » mélange les classeurs.
  type Tagged = (AnimalCard | PokemonCard) & { cat: Category };
  const animalsTagged: Tagged[] = data.animals.cards.map((c) => ({ ...c, cat: "animal" as const }));
  const pokemonTagged: Tagged[] = data.pokemon.cards.map((c) => ({ ...c, cat: "pokemon" as const }));
  const viewCards: Tagged[] =
    activeCategory === "all"
      ? [...animalsTagged, ...pokemonTagged]
      : activeCategory === "animal"
        ? animalsTagged
        : pokemonTagged;
  // Les critères cochés : la carte doit tous les cocher.
  // Le critère « skin » se lit sur la garde-robe, les autres sur les traits.
  const hasCrit = (c: Tagged, k: Crit) =>
    k === "skin" ? (c.skins?.some((s) => s.owned) ?? false) : Boolean(c.traits?.[k]);
  const passCrits = (c: Tagged) => crits.every((k) => hasCrit(c, k));
  const shownCards = crits.length > 0 ? viewCards.filter(passCrits) : viewCards;
  const critCount = (k: Crit) => viewCards.filter((c) => hasCrit(c, k)).length;

  const cardsByRarity: Record<Rarity, Tagged[]> = {
    common: [], uncommon: [], rare: [], epic: [], legendary: [], mythic: [],
  };
  for (const c of shownCards) cardsByRarity[c.rarity].push(c);

  // Totaux du catalogue pour la vue : somme des deux classeurs en « Tous ».
  const totalsView: Record<Rarity, number> = { ...data.animals.totalsByRarity };
  for (const r of RARITIES) {
    totalsView[r] =
      activeCategory === "all"
        ? (data.animals.totalsByRarity[r] || 0) + (data.pokemon.totalsByRarity[r] || 0)
        : activeCategory === "animal"
          ? data.animals.totalsByRarity[r] || 0
          : data.pokemon.totalsByRarity[r] || 0;
  }
  const totalUnique = viewCards.length;
  const totalAll = Object.values(totalsView).reduce((a, b) => a + b, 0);
  // Fragments et fusion : par classeur — masqués dans la vue « Tous ».
  const section = activeCategory === "pokemon" ? data.pokemon : data.animals;
  const fusionRarity = activeCategory !== "all" && activeFilter !== "all" ? activeFilter : null;
  const fusionShards = fusionRarity ? (section.shards[fusionRarity] || 0) : 0;
  const canFuse = fusionRarity ? FUSION_NEXT[fusionRarity] !== null && fusionShards >= FUSION_COST : false;
  const forgePoints = data.charges?.forge ?? 0;

  // Tri par défaut : le numéro de carte, comme un vrai classeur.
  // L'Inclassable (talent) ajoute ses tris absurdes par-dessus.
  const numberOf = (c: Tagged) =>
    c.cat === "pokemon"
      ? (c as PokemonCard).pokedexNumber ?? Number.MAX_SAFE_INTEGER
      : (c as AnimalCard).cardNumber ?? Number.MAX_SAFE_INTEGER;
  const sortCards = (cards: Tagged[]) => {
    const sorted = [...cards];
    if (sortMode === "rarity") sorted.sort((a, b) => numberOf(a) - numberOf(b));
    if (sortMode === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === "height") sorted.sort((a, b) => (b.heightCm ?? 0) - (a.heightCm ?? 0));
    if (sortMode === "weight") sorted.sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0));
    if (sortMode === "habitat")
      sorted.sort((a, b) => (a.habitat ?? "zzz").localeCompare(b.habitat ?? "zzz"));
    return sorted;
  };

  const renderGrid = (cards: Tagged[]) => (
    <div className="grid grid-cols-3 gap-2.5">
      {sortCards(cards).map((c) => {
        const isPokemon = c.cat === "pokemon";
        const number = isPokemon
          ? (c as PokemonCard).pokedexNumber
          : (c as AnimalCard).cardNumber;
        return (
          <button
            key={c.id}
            onClick={() => openDetail(c)}
            className="group block w-full transition-all duration-150 hover:-translate-y-1 active:scale-95"
          >
            <CreatureCard
              name={c.nickname || c.name}
              rarity={c.rarity}
              imageUrl={c.imageUrl}
              number={number}
              category={c.cat}
              primaryType={isPokemon ? (c as PokemonCard).primaryType : undefined}
              secondaryType={isPokemon ? (c as PokemonCard).secondaryType : undefined}
              count={c.count}
              size="sm"
              serti={has("sertissage")}
              className="group-hover:shadow-2xl"
            />
          </button>
        );
      })}
    </div>
  );

  const tabCards = activeFilter === "all" ? shownCards : cardsByRarity[activeFilter];

  return (
    <div className="relative min-h-dvh px-4 pb-12 pt-6">
      <ThroneBackdrop page="collection" />
      <BackButton />

      <header className="mb-6 mt-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
            Vault
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tighter">Collection</h1>
        </div>
        <div className="mb-1 flex gap-1.5">
          <Link
            href="/oracle"
            className="inline-flex items-center rounded-xl bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
          >
            Oracle
          </Link>
          {has("genome") && (
            <Link
              href="/genome"
              className="inline-flex items-center rounded-xl bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
            >
              Génome
            </Link>
          )}
          <Link
            href="/grimoire"
            className="inline-flex items-center rounded-xl bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
          >
            Grimoire
          </Link>
          <Link
            href="/manuel"
            className="inline-flex items-center rounded-xl bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
          >
            ?
          </Link>
        </div>
      </header>

      {/* La barre d'action : tout le rituel du pack sur UNE ligne. */}
      <div className="mb-2 flex items-stretch gap-2">
        <div className="flex min-w-[52px] flex-col items-center justify-center rounded-[3px] bg-secondary/30 ring-1 ring-border">
          <span className="font-mono text-lg font-black leading-none tabular-nums text-primary">
            {data.tokens}
          </span>
          <span className="mt-0.5 text-[7px] font-black tracking-[0.16em] text-muted-foreground">
            JETONS
          </span>
        </div>
        <Button
          onClick={handleOpenPack}
          disabled={data.tokens < 1 || opening}
          className="h-auto flex-1 rounded-[3px] bg-gradient-orange-intense text-xs font-black uppercase tracking-wider text-black disabled:opacity-50"
        >
          <Package className="size-3.5" />
          {opening ? "Ouverture..." : "Ouvrir un pack"}
        </Button>
        {data.specialTokens > 0 && (
          <button
            onClick={() => setShowSpinWheel(true)}
            title="Jeton spécial — tourne la roue pour des jetons normaux"
            className="flex min-w-[44px] items-center justify-center gap-1 rounded-[3px] bg-amber-500/10 text-xs font-black text-amber-300 ring-1 ring-amber-500/50 transition-all active:scale-95"
          >
            <Star className="size-3.5" strokeWidth={2.5} />
            {data.specialTokens}
          </button>
        )}
        <button
          onClick={() => (forgePoints >= 20 ? handleForgeWheel() : setDetailOpen((v) => !v))}
          title={
            forgePoints >= 20
              ? "Roue de la Forge — un fragment garanti : 42 % commun, 30 % peu commun, 18 % rare, 10 % épique"
              : "La Forge — les Gardiens forgerons la remplissent à chaque éveil"
          }
          className={`flex min-w-[52px] flex-col items-center justify-center rounded-[3px] ring-1 transition-all active:scale-95 ${
            forgePoints >= 20
              ? "animate-pulse bg-primary/20 text-primary ring-primary/50"
              : "bg-secondary/30 text-muted-foreground ring-border"
          }`}
        >
          <span className="font-mono text-[10px] font-black tabular-nums">
            {forging ? "..." : `${forgePoints}/20`}
          </span>
          <span className="text-[7px] font-black tracking-[0.14em]">
            {forgePoints >= 20 ? "ROUE !" : "FORGE"}
          </span>
        </button>
        <button
          onClick={() => setShowSkins((v) => !v)}
          aria-label="Tous mes skins"
          className={`flex items-center gap-1 rounded-[3px] px-2 text-[9px] font-black uppercase tracking-widest ring-1 transition-all active:scale-95 ${
            showSkins
              ? "bg-primary/15 text-primary ring-primary/40"
              : "bg-secondary/30 text-muted-foreground ring-border"
          }`}
        >
          Skins
          <span className="font-mono tabular-nums">
            {(data.animals.cards.reduce((a, c) => a + (c.skins?.filter((s) => s.owned).length ?? 0), 0) +
              data.pokemon.cards.reduce((a, c) => a + (c.skins?.filter((s) => s.owned).length ?? 0), 0) +
              (data.mysterySkins?.length ?? 0))}
          </span>
        </button>
        <button
          onClick={() => setDetailOpen((v) => !v)}
          aria-label="Détail des tirages"
          className="flex w-8 items-center justify-center rounded-[3px] bg-secondary/30 text-muted-foreground ring-1 ring-border transition-all active:scale-95"
        >
          {detailOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {/* Le panneau détail : l'explication des prochains tirages — AU-DESSUS
          des filtres, qui restent collés aux cartes. */}
      {detailOpen && (
        <div className="mb-2 space-y-4 rounded-[3px] bg-secondary/20 p-3.5 ring-1 ring-border">
          {(data.skinReserve?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
                Skins en réserve — {data.skinReserve!.reduce((a, r) => a + r.count, 0)} mystère{data.skinReserve!.reduce((a, r) => a + r.count, 0) > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.skinReserve!.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ring-1 ring-border"
                  >
                    <span className="text-muted-foreground">?</span>
                    <span className={RESERVE_TEXT[r.rarity]}>
                      {r.category === "animal" ? "Animal" : "Pokémon"} {RARITY_LABELS[r.rarity].toLowerCase()}
                    </span>
                    <span className="text-muted-foreground">· N{r.level}</span>
                    {r.count > 1 && <span className="text-primary">×{r.count}</span>}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Un skin mystère se révèle le jour où tu tires sa carte.
              </p>
            </div>
          )}
          {data.odds && data.charges && Object.values(data.charges).some((n) => n > 0) && (
            <div>
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
                Énergie des gardiens — tes prochains packs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["basic", "Basique", PACK_TYPE_WEIGHTS.basic],
                    ["animal_only", "Animal", PACK_TYPE_WEIGHTS.animal_only],
                    ["pokemon_only", "Pokémon", PACK_TYPE_WEIGHTS.pokemon_only],
                    ["premium", "Premium", PACK_TYPE_WEIGHTS.premium],
                    ["mythic", "Mythique", PACK_TYPE_WEIGHTS.mythic],
                  ] as [PackType, string, number][]
                ).map(([key, label, base]) => {
                  const pct = data.odds!.hat[key];
                  const boosted = pct > base;
                  const nerfed = pct < base;
                  return (
                    <span
                      key={key}
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ring-1 ${
                        boosted
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                          : nerfed
                            ? "bg-red-500/10 text-red-300 ring-red-500/30"
                            : "bg-secondary/50 text-muted-foreground ring-transparent"
                      }`}
                    >
                      {label}{" "}
                      {boosted || nerfed ? (
                        <>
                          <span className="text-muted-foreground/50 line-through decoration-1">{base}%</span>
                          {"\u2009→\u2009"}
                          {pct}%
                        </>
                      ) : (
                        <>{pct}%</>
                      )}
                    </span>
                  );
                })}
                {(data.odds.wheel["4"] ?? 1) > 1 && (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-300">
                    Roue ×4 : {data.odds.wheel["4"]}%
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                Valable pour TOUS tes packs — la prochaine clôture de séance remplace
                cette énergie par celle de tes nouveaux éveils.
              </p>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tabular-nums tracking-widest text-muted-foreground">
              <span>Progression</span>
              <span>
                <span className="text-foreground/80">{totalUnique}</span> / {totalAll}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary/40">
              <div
                className="h-full bg-gradient-orange-intense transition-all duration-500"
                style={{ width: `${Math.round((totalUnique / Math.max(totalAll, 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Flame className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                La Forge
              </p>
              <div className="mt-1 flex h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-secondary/60">
                <div
                  className="rounded-full bg-gradient-orange"
                  style={{ width: `${Math.min(100, (forgePoints / 20) * 100)}%` }}
                />
              </div>
            </div>
            {forgePoints >= 20 ? (
              <button
                onClick={handleForgeWheel}
                disabled={forging}
                className="animate-pulse rounded-lg bg-primary/20 px-2.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-primary ring-1 ring-primary/50 transition-all active:scale-95"
              >
                {forging ? "Elle tourne..." : "Lancer la Roue"}
              </button>
            ) : (
              <span
                className="font-mono text-[10px] font-black tabular-nums text-muted-foreground"
                title="Les Gardiens forgerons la remplissent à chaque éveil — pleine, un fragment t'attend au tirage"
              >
                {forgePoints}/20
              </span>
            )}
          </div>
        </div>
      )}

      {/* La vue « Tous mes skins » : révélés puis mystères, à la place de la grille. */}
      {showSkins ? (
        (() => {
          const revealed = [
            ...data.animals.cards.flatMap((c) =>
              (c.skins ?? []).filter((s) => s.owned).map((s) => ({
                ...s, cardName: c.name, equipped: c.equippedSkinLevel === s.level,
              })),
            ),
            ...data.pokemon.cards.flatMap((c) =>
              (c.skins ?? []).filter((s) => s.owned).map((s) => ({
                ...s, cardName: c.name, equipped: c.equippedSkinLevel === s.level,
              })),
            ),
          ].sort((a, b) => b.level - a.level || a.cardName.localeCompare(b.cardName));
          const mysteries = data.mysterySkins ?? [];
          return (
            <div className="space-y-6 pb-8">
              <section>
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
                  Révélés — {revealed.length}
                </p>
                {revealed.length === 0 ? (
                  <p className="rounded-[3px] bg-secondary/20 p-3 text-xs text-muted-foreground ring-1 ring-border">
                    Aucun skin révélé pour l&apos;instant — ouvre des packs, ou tire les cartes de tes mystères.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {revealed.map((s, i) => (
                      <div key={i} className={`overflow-hidden rounded-[10px] bg-card ring-2 ${LEVEL_RING[s.level] ?? "ring-border"}`}>
                        <div className="relative aspect-square w-full bg-black/40">
                          {s.imageUrl ? (
                            <Image src={s.imageUrl} alt="" fill unoptimized className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground">Bientôt…</div>
                          )}
                          <span className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${LEVEL_BADGE[s.level] ?? ""}`}>
                            N{s.level}
                          </span>
                          {s.equipped && (
                            <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-black text-black">
                              ÉQUIPÉ
                            </span>
                          )}
                        </div>
                        <div className="px-1.5 py-1.5 text-center">
                          <p className="truncate text-[10px] font-black leading-tight">« {s.name} »</p>
                          <p className="truncate text-[9px] font-bold text-muted-foreground">{s.cardName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
                  Mystères — {mysteries.length}
                </p>
                {mysteries.length === 0 ? (
                  <p className="rounded-[3px] bg-secondary/20 p-3 text-xs text-muted-foreground ring-1 ring-border">
                    Aucun mystère en réserve.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {mysteries.map((m, i) => (
                      <div
                        key={i}
                        className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] bg-gradient-to-b ring-1 ring-white/10 ${MYST_BG[m.rarity] ?? MYST_BG.common}`}
                      >
                        <span className="text-2xl font-black text-white/30">?</span>
                        <span className="px-1 text-center text-[9px] font-black leading-tight">
                          {m.category === "animal" ? "Animal" : "Pokémon"}
                          <br />
                          {RARITY_LABELS[m.rarity].toLowerCase()}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${LEVEL_BADGE[m.level] ?? ""}`}>
                          N{m.level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Un mystère se révèle le jour où tu tires sa carte.
                </p>
              </section>
            </div>
          );
        })()
      ) : (
        <>
      {/* TOUT le filtrage sur une ligne : catégorie, raretés, critères. */}
      <div className="mb-4 flex items-center gap-1.5">
        {(
          [
            ["all", "Tous", null],
            ["animal", "Animaux", PawPrint],
            ["pokemon", "Pokémon", Zap],
          ] as [CatView, string, typeof PawPrint | null][]
        ).map(([cat, label, Icon]) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setActiveFilter("all");
              }}
              title={label}
              className={`flex h-[30px] items-center justify-center gap-1 rounded-[3px] text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                isActive
                  ? "bg-gradient-orange-intense px-2.5 text-black shadow-[2px_2px_0_oklch(0_0_0/0.5)]"
                  : "w-[30px] bg-secondary/30 text-muted-foreground ring-1 ring-border hover:text-primary"
              }`}
            >
              {Icon ? <Icon className="size-3.5" strokeWidth={2.5} /> : isActive ? "Tous" : "∴"}
              {isActive && Icon && label}
            </button>
          );
        })}
        <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />
        {[...RARITIES].reverse().map((r) => {
          const isActive = activeFilter === r;
          return (
            <button
              key={r}
              onClick={() => setActiveFilter(isActive ? "all" : r)}
              title={`${RARITY_LABELS[r]} — ${cardsByRarity[r].length}/${totalsView[r] || 0}`}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-[3px] transition-all active:scale-95 ${
                isActive
                  ? `${TIER_FILL[r]} ring-1`
                  : "bg-secondary/30 ring-1 ring-border hover:ring-foreground/30"
              }`}
            >
              <span className={`size-2 rounded-full ${TIER_DOT[r]}`} />
            </button>
          );
        })}
        <button
          onClick={() => setShowCrits(true)}
          aria-label="Filtrer par critère"
          className={`relative ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-[3px] transition-all active:scale-95 ${
            crits.length > 0
              ? "bg-primary/15 text-primary ring-1 ring-primary/50"
              : "bg-secondary/30 text-muted-foreground ring-1 ring-border hover:text-primary"
          }`}
        >
          <Funnel className="size-3.5" />
          {crits.length > 0 && (
            <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] font-black text-black">
              {crits.length}
            </span>
          )}
        </button>
      </div>

      {/* L'Inclassable : le sélecteur de tris absurdes */}
      {has("inclassable") && (
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Trier
          </span>
          {(
            [
              ["rarity", "N°"],
              ["name", "Nom"],
              ["height", "Taille"],
              ["weight", "Poids"],
              ["habitat", "Habitat"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                sortMode === mode
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-secondary/40 text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* La Roue de la Forge : le fragment gagné, révélé en grand */}
      {forgeWin && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setForgeWin(null)}
        >
          <div className="animate-card-reveal flex flex-col items-center px-8 text-center">
            <div className="pointer-events-none absolute size-64 rounded-full bg-primary/15 blur-3xl" />
            <Flame className={`size-14 ${TIER_TEXT[forgeWin.rarity]}`} />
            <p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">
              La Roue de la Forge
            </p>
            <p className={`mt-2 text-3xl font-black tracking-tighter ${TIER_TEXT[forgeWin.rarity]}`}>
              +1 fragment {RARITY_LABELS[forgeWin.rarity].toLowerCase()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {forgeWin.category === "animal" ? "côté animaux" : "côté Pokémon"}
            </p>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Toucher pour continuer
            </p>
          </div>
        </div>
      )}

      {/* Fusion bar — single tier when filter active, summary when "Tout" */}
      {fusionRarity && FUSION_NEXT[fusionRarity] ? (
        <div className="mb-5 flex items-center justify-between rounded-2xl bg-secondary/30 px-4 py-3 ring-1 ring-border">
          <div className="flex items-center gap-2.5">
            <Flame className={`size-4 ${TIER_TEXT[fusionRarity]}`} />
            <span className="text-xs font-bold">
              <span className="font-mono tabular-nums">{fusionShards}</span> fragment{fusionShards !== 1 ? "s" : ""}{" "}
              <span className="text-muted-foreground">{RARITY_LABELS[fusionRarity].toLowerCase()}</span>
            </span>
          </div>
          <Button
            size="sm"
            disabled={!canFuse || fusing !== null}
            onClick={() => handleFuse(fusionRarity)}
            className="h-8 rounded-lg bg-gradient-orange-intense px-3 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-40"
          >
            {fusing === fusionRarity ? "Fusion..." : `Fusionner ${FUSION_COST}→1`}
          </Button>
        </div>
      ) : activeCategory !== "all" && activeFilter === "all" && Object.values(section.shards).some((n) => n > 0) ? (
        // Fragments : une seule ligne de pastilles. Les actions (fusion,
        // conversion) n'apparaissent que quand elles sont possibles —
        // sinon la pastille reste un simple compteur.
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <Flame className="size-3.5 text-muted-foreground" />
          {[...RARITIES].reverse().map((r) => {
            const n = section.shards[r] || 0;
            if (n === 0) return null;
            const next = FUSION_NEXT[r];
            const fuseable = next && n >= FUSION_COST;
            const convBatch = CONVERSION_BATCH[r];
            const convReward = CONVERSION_RATE[r];
            const convertible = n >= convBatch;
            return (
              <span
                key={r}
                className={`inline-flex items-center gap-1.5 rounded-lg ${TIER_FILL[r]} ring-1 px-2 py-1`}
              >
                <span className={`size-1.5 rounded-full ${TIER_DOT[r]}`} />
                <span className={`font-mono text-[11px] font-black tabular-nums ${TIER_TEXT[r]}`}>
                  {n}
                </span>
                {fuseable && (
                  <button
                    onClick={() => handleFuse(r)}
                    disabled={fusing !== null || converting !== null}
                    className="rounded bg-gradient-orange-intense px-1.5 py-px text-[9px] font-black uppercase text-black disabled:opacity-40"
                  >
                    {fusing === r ? "..." : `${FUSION_COST}→1`}
                  </button>
                )}
                {convertible && (
                  <button
                    onClick={() => handleConvert(r)}
                    disabled={converting !== null || fusing !== null}
                    className="rounded bg-secondary px-1.5 py-px text-[9px] font-black uppercase text-foreground/80 ring-1 ring-border disabled:opacity-40"
                  >
                    {converting === r ? "..." : `→${convReward}j`}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Cards display */}
      {activeFilter === "all" ? (
        shownCards.length === 0 ? (
          <EmptyState
            big
            title={crits.length > 0 ? "Aucune carte à ces critères" : "Vault vide"}
            subtitle={
              crits.length > 0
                ? "Aucune de tes cartes ne coche tous les critères choisis — retire-en un dans l'entonnoir."
                : "Termine une séance pour gagner ton premier jeton et ouvrir ton premier pack."
            }
          />
        ) : (
          <div className="space-y-7">
            {[...RARITIES].reverse().map((r) => {
              const cards = cardsByRarity[r];
              if (cards.length === 0) return null;
              return (
                <section key={r}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className={`h-5 w-1 rounded-full ${TIER_DOT[r]}`} />
                    <h3 className={`text-[11px] font-black uppercase tracking-[0.25em] ${TIER_TEXT[r]}`}>
                      {RARITY_LABELS[r]}
                    </h3>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {crits.length > 0 ? cards.length : `${cards.length}/${totalsView[r] || 0}`}
                    </span>
                    <div className={`h-px flex-1 ${TIER_DOT[r]} opacity-20`} />
                  </div>
                  {renderGrid(cards)}
                </section>
              );
            })}
          </div>
        )
      ) : tabCards.length === 0 ? (
        <EmptyState
          title={`Aucune carte ${RARITY_LABELS[activeFilter as Rarity].toLowerCase()}${crits.length > 0 ? " à ces critères" : ""}`}
          subtitle="Ouvre des packs ou fusionne des fragments pour étendre cette section."
        />
      ) : (
        renderGrid(tabCards)
      )}

      {/* Le tiroir des critères : cumulables, comptes en direct. */}
      <Sheet open={showCrits} onOpenChange={setShowCrits}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t-2 border-t-primary/20">
          <SheetHeader>
            <SheetTitle className="text-lg font-black tracking-tight">Filtrer par critère</SheetTitle>
            <SheetDescription className="text-xs">
              Cumulables — seules restent les cartes qui cochent tous les critères choisis.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4 pb-6">
            {CRIT_DEFS.map(({ key, label, hint, Icon, tint, ring }) => {
              const active = crits.includes(key);
              return (
                <button
                  key={key}
                  onClick={() =>
                    setCrits((prev) => (active ? prev.filter((k) => k !== key) : [...prev, key]))
                  }
                  className={`flex items-center gap-2.5 rounded-[3px] px-3 py-3 text-left ring-1 transition-all active:scale-95 ${
                    active ? ring : "bg-secondary/30 ring-border"
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${tint}`} />
                  <span className="min-w-0">
                    <span className={`block text-xs font-black ${active ? tint : ""}`}>
                      {label}
                      <span className="ml-1.5 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                        {critCount(key)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                      {hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {crits.length > 0 && (
            <div className="px-4 pb-6">
              <button
                onClick={() => setCrits([])}
                className="w-full rounded-[3px] bg-secondary/40 py-2.5 text-xs font-bold text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
              >
                Tout effacer
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
        </>
      )}

      {modalResult && (
        <PackOpenModal result={modalResult} onClose={() => setModalResult(null)} odds={data.odds} />
      )}
      {detailCreature && (
        <CardDetailModal
          creature={detailCreature}
          onClose={() => setDetailCreature(null)}
          onNicknameChange={() => {
            setDetailCreature(null);
            refresh();
          }}
          onSkinChange={refresh}
        />
      )}
      {showSpinWheel && (
        <SpinWheelModal
          onClose={() => setShowSpinWheel(false)}
          onAfterSpin={refresh}
          wheel={data.odds?.wheel}
        />
      )}
    </div>
  );
}

function EmptyState({ title, subtitle, big = false }: { title: string; subtitle: string; big?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${big ? "py-16" : "py-10"} text-center`}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/40 ring-1 ring-border">
        <Vault className="size-7 text-muted-foreground/60" />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-black tracking-tight">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
