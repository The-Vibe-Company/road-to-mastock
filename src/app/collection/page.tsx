"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flame,
  PawPrint,
  Zap,
  Vault,
  Star,
  Package,
  Sparkles,
  Shield,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Funnel,
  Eye,
  Layers,
} from "@/components/icons";
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

// Les teintes des critères : l'identité de chaque critère, lisible dans les
// deux fontes (la nuit par défaut, le papier gagné).
const CRIT_DEFS: { key: Crit; label: string; hint: string; Icon: typeof Flame; tint: string }[] = [
  { key: "magnesie", label: "Magnésie", hint: "la carte rapporte de la magnésie à l'éveil", Icon: Sparkles, tint: "text-sky-700 dark:text-sky-300" },
  { key: "talent", label: "Grimoire", hint: "la carte porte un talent caché", Icon: BookOpen, tint: "text-violet-700 dark:text-violet-300" },
  { key: "forge", label: "Forge", hint: "son pouvoir nourrit la jauge de Forge", Icon: Flame, tint: "text-orange-700 dark:text-orange-300" },
  { key: "guardian", label: "Gardiens", hint: "actuellement postée sur une machine", Icon: Shield, tint: "text-amber-700 dark:text-amber-300" },
  { key: "skin", label: "Skins", hint: "possède au moins un skin dans sa garde-robe", Icon: Star, tint: "text-emerald-700 dark:text-emerald-300" },
];

// La rareté est une donnée de la carte, pas un accent : un point de couleur
// à côté du nom, et le texte reste lisible dans les deux fontes.
const TIER_DOT: Record<Rarity, string> = {
  common:    "bg-zinc-400",
  uncommon:  "bg-emerald-400",
  rare:      "bg-sky-400",
  epic:      "bg-violet-400",
  legendary: "bg-amber-400",
  mythic:    "bg-rose-400",
};

const TIER_TEXT: Record<Rarity, string> = {
  common:    "text-zinc-600 dark:text-zinc-300",
  uncommon:  "text-emerald-700 dark:text-emerald-300",
  rare:      "text-sky-700 dark:text-sky-300",
  epic:      "text-violet-700 dark:text-violet-300",
  legendary: "text-amber-700 dark:text-amber-300",
  mythic:    "text-rose-700 dark:text-rose-300",
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


// La vue « Tous mes skins » : l'étiquette de niveau, à la couleur du niveau.
const LEVEL_BADGE: Record<number, string> = {
  1: "bg-zinc-600 text-zinc-50", 2: "bg-emerald-700 text-emerald-50", 3: "bg-sky-700 text-sky-50",
  4: "bg-violet-700 text-violet-50", 5: "bg-amber-400 text-black",
};
const MYST_BG: Record<Rarity, string> = {
  common: "from-zinc-700 via-zinc-900 to-zinc-950",
  uncommon: "from-emerald-700 via-emerald-900 to-emerald-950",
  rare: "from-sky-700 via-sky-900 to-sky-950",
  epic: "from-violet-700 via-violet-900 to-violet-950",
  legendary: "from-amber-700 via-amber-900 to-amber-950",
  mythic: "from-rose-700 via-fuchsia-900 to-rose-950",
};

// Une plaque dans sa glissière : celle qu'on a choisie sort de la glissière
// (plaque pleine) et porte la goupille ; les autres restent dans le jour.
const SLOT_ON = "plate text-foreground";
const SLOT_OFF = "text-muted-foreground hover:bg-secondary/70 hover:text-foreground";

// Le nom d'un bloc, gravé en capitales étroites.
const BLOCK_LABEL = "font-heading text-[16px] font-bold uppercase leading-none tracking-[0.08em]";

export default function CollectionPage() {
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CatView>("all");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  // Le panneau « Détail des tirages » : skins en réserve, énergie des gardiens.
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
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
          className="h-10 rounded-full px-5 font-heading text-[15px] font-bold uppercase tracking-[0.06em]"
        >
          Réessayer
        </Button>
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
  // Fragments et fusion : par classeur. Dans la vue « Tous », on ne peut pas
  // fusionner (la fusion vise un classeur précis) mais on AFFICHE le cumul des
  // deux — sinon le joueur croit avoir perdu ses fragments.
  const section = activeCategory === "pokemon" ? data.pokemon : data.animals;
  const shardsView: Record<Rarity, number> =
    activeCategory === "all"
      ? (Object.fromEntries(
          RARITIES.map((r) => [r, (data.pokemon.shards[r] || 0) + (data.animals.shards[r] || 0)]),
        ) as Record<Rarity, number>)
      : section.shards;
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
            className="group block w-full rounded-[var(--radius)] transition-transform duration-150 hover:-translate-y-1 active:scale-95"
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

  // Ce que la page doit dire en premier : les jetons et le pack.
  const hasTokens = data.tokens >= 1;
  const forgeFull = forgePoints >= 20;
  const ownedTotal = data.animals.cards.length + data.pokemon.cards.length;
  const skinCount =
    data.animals.cards.reduce((a, c) => a + (c.skins?.filter((s) => s.owned).length ?? 0), 0) +
    data.pokemon.cards.reduce((a, c) => a + (c.skins?.filter((s) => s.owned).length ?? 0), 0) +
    (data.mysterySkins?.length ?? 0);
  const reserveCount = data.skinReserve?.reduce((a, r) => a + r.count, 0) ?? 0;
  const hasEnergy = Boolean(
    data.odds && data.charges && Object.values(data.charges).some((n) => n > 0),
  );
  // Les filtres n'ont rien à trier tant que le classeur est vide : ils
  // apparaissent avec la première carte.
  const showFilters = ownedTotal > 0 || crits.length > 0;
  const progressPct = Math.round((totalUnique / Math.max(totalAll, 1)) * 100);

  return (
    <div className="relative min-h-dvh px-4 pb-16 pt-6">
      <ThroneBackdrop page="collection" />
      <BackButton fallback="/" />

      <header className="mb-6 mt-3">
        <p className="etched">Vault</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">Collection</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tes cartes, gagnées séance après séance.
        </p>
      </header>

      {/* Les portes de la Collection : l'Oracle, le Grimoire, le Génome
          (talent) et le Manuel. */}
      <nav aria-label="Autour de la collection" className="relative mb-6 flex gap-2">
        <Link
          href="/oracle"
          className="plate card-hover flex h-11 flex-1 items-center justify-center gap-2 font-heading text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Eye className="size-4" />
          Oracle
        </Link>
        <Link
          href="/grimoire"
          className="plate card-hover flex h-11 flex-1 items-center justify-center gap-2 font-heading text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <BookOpen className="size-4" />
          Grimoire
        </Link>
        {has("genome") && (
          <Link
            href="/genome"
            className="plate card-hover flex h-11 flex-1 items-center justify-center gap-2 font-heading text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Layers className="size-4" />
            Génome
          </Link>
        )}
        <Link
          href="/manuel"
          title="Le Manuel : comment gagner jetons et cartes"
          className="plate card-hover flex size-11 shrink-0 items-center justify-center font-heading text-[20px] font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          ?
        </Link>
      </nav>

      {/* La pile du pack : les jetons et l'ouverture en tête, le jeton
          spécial s'il y en a, la Forge dessous. */}
      <section aria-label="Les packs" className="relative">
        <div className="plate-stack">
          <div className="plate p-3">
            <div className="flex items-center gap-3">
              <span className="stamp h-14 min-w-[4.5rem] px-3 text-[40px]">{data.tokens}</span>
              <div className="min-w-0 flex-1">
                <p className={BLOCK_LABEL}>Jetons</p>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  Un jeton ouvre un pack ; chaque séance clôturée en rapporte un.
                </p>
              </div>
            </div>
            {/* La goupille : l'action principale. Sans jeton, elle reste
                acier — rien à tirer. */}
            <Button
              onClick={handleOpenPack}
              disabled={!hasTokens || opening}
              variant={hasTokens ? "default" : "secondary"}
              className={`mt-3 h-12 w-full gap-3 rounded-full pl-1.5 pr-6 font-heading text-[18px] font-bold uppercase tracking-[0.06em] disabled:opacity-100 ${
                hasTokens
                  ? "bg-gradient-orange-intense text-primary-foreground glow-orange"
                  : "text-muted-foreground"
              }`}
            >
              <span
                aria-hidden
                className={`flex size-9 items-center justify-center rounded-full ${
                  hasTokens
                    ? "bg-primary-foreground/15 shadow-[inset_0_2px_3px_oklch(0_0_0/0.3),0_1px_0_oklch(1_0_0/0.25)]"
                    : "bg-gap"
                }`}
              >
                <Package className="size-4" />
              </span>
              <span className="flex-1 text-center">{opening ? "Ouverture..." : "Ouvrir un pack"}</span>
              <span aria-hidden className="size-9" />
            </Button>
          </div>

          {data.specialTokens > 0 && (
            <div className="plate flex items-center gap-3 py-2.5 pl-3 pr-2.5">
              <span className="stamp h-11 min-w-[3.5rem] gap-1 px-2 text-[26px]">
                <Star className="size-4 text-amber-300" strokeWidth={2.5} />
                {data.specialTokens}
              </span>
              <div className="min-w-0 flex-1">
                <p className={BLOCK_LABEL}>Jeton spécial</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Tourne la roue pour des jetons normaux.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowSpinWheel(true)}
                title="Jeton spécial — tourne la roue pour des jetons normaux"
                className="h-10 shrink-0 rounded-full px-4 font-heading text-[15px] font-bold uppercase tracking-[0.06em]"
              >
                Tourner la roue
              </Button>
            </div>
          )}

          <div
            className="plate flex items-center gap-3 py-2.5 pl-3 pr-2.5"
            title={
              forgeFull
                ? "Roue de la Forge — un fragment garanti : 42 % commun, 30 % peu commun, 18 % rare, 10 % épique"
                : "La Forge — les Gardiens forgerons la remplissent à chaque éveil"
            }
          >
            <span className="stamp h-11 min-w-[3.5rem] px-2 text-[22px]">
              {forging ? "..." : `${forgePoints}/20`}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-1.5 ${BLOCK_LABEL}`}>
                <Flame className="size-3.5 text-steel" />
                La Forge
              </p>
              <div className="segments relative mt-2 h-2 bg-muted">
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (forgePoints / 20) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                {forgeFull
                  ? "Pleine : un fragment garanti — 42 % commun, 30 % peu commun, 18 % rare, 10 % épique."
                  : "Les Gardiens forgerons la remplissent à chaque éveil."}
              </p>
            </div>
            {forgeFull && (
              <Button
                onClick={handleForgeWheel}
                disabled={forging}
                className="h-10 shrink-0 rounded-full bg-gradient-orange-intense px-4 font-heading text-[15px] font-bold uppercase tracking-[0.06em] text-primary-foreground disabled:opacity-100"
              >
                {forging ? "Elle tourne..." : "Lancer la Roue"}
              </Button>
            )}
          </div>
        </div>

        {/* Le détail des tirages : les skins en réserve et l'énergie des
            gardiens sur les prochains packs. */}
        <button
          onClick={() => setDetailOpen((v) => !v)}
          aria-expanded={detailOpen}
          className="mt-2 flex h-10 w-full items-center justify-between rounded-md px-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Détail des tirages
          {detailOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {detailOpen && (
          <div className="plate mt-1 space-y-4 p-3.5">
            {reserveCount > 0 && data.skinReserve && (
              <div>
                <p className="etched mb-2">
                  Skins en réserve — {reserveCount} mystère{reserveCount > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.skinReserve.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex h-7 items-center gap-1.5 rounded-[3px] bg-secondary px-2 text-[12px] font-semibold shadow-[inset_0_1px_0_var(--plate-edge)]"
                    >
                      <span className={`size-1.5 rounded-full ${TIER_DOT[r.rarity]}`} />
                      <span>
                        {r.category === "animal" ? "Animal" : "Pokémon"} {RARITY_LABELS[r.rarity].toLowerCase()}
                      </span>
                      <span className="font-heading tabular-nums text-muted-foreground">N{r.level}</span>
                      {r.count > 1 && <span className="font-heading tabular-nums">×{r.count}</span>}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Un skin mystère se révèle le jour où tu tires sa carte.
                </p>
              </div>
            )}

            {hasEnergy && data.odds && (
              <div>
                <p className="etched mb-2">Énergie des gardiens — tes prochains packs</p>
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
                        className={`inline-flex h-7 items-center gap-1 rounded-[3px] px-2 text-[12px] font-semibold ${
                          boosted
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                            : nerfed
                              ? "bg-red-500/15 text-red-800 dark:text-red-200"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {label}
                        <span className="font-heading text-[13px] tabular-nums">
                          {boosted || nerfed ? (
                            <>
                              <span className="text-muted-foreground line-through decoration-1">{base}%</span>
                              {" → "}
                              {pct}%
                            </>
                          ) : (
                            <>{pct}%</>
                          )}
                        </span>
                      </span>
                    );
                  })}
                  {(data.odds.wheel["4"] ?? 1) > 1 && (
                    <span className="inline-flex h-7 items-center gap-1 rounded-[3px] bg-amber-500/15 px-2 text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                      Roue ×4 :
                      <span className="font-heading text-[13px] tabular-nums">{data.odds.wheel["4"]}%</span>
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Valable pour TOUS tes packs — la prochaine clôture de séance remplace
                  cette énergie par celle de tes nouveaux éveils.
                </p>
              </div>
            )}

            {reserveCount === 0 && !hasEnergy && (
              <p className="text-sm text-muted-foreground">
                Ni skin en réserve ni énergie de gardien pour l&apos;instant : rien ne
                change tes prochains tirages.
              </p>
            )}
          </div>
        )}
      </section>

      {/* La vue : les cartes, ou tous les skins — deux plaques dans leur
          glissière. */}
      <div
        role="tablist"
        aria-label="Vue"
        className="relative mb-5 mt-5 grid grid-cols-2 gap-[3px] rounded-lg bg-gap p-[3px]"
      >
        {(
          [
            [false, "Cartes", ownedTotal],
            [true, "Skins", skinCount],
          ] as const
        ).map(([skinsView, label, count]) => {
          const active = showSkins === skinsView;
          return (
            <button
              key={label}
              role="tab"
              aria-selected={active}
              onClick={() => setShowSkins(skinsView)}
              className={`flex h-11 items-center justify-center gap-2 rounded-[3px] font-heading text-[16px] font-bold uppercase tracking-[0.06em] transition-colors ${
                active ? SLOT_ON : SLOT_OFF
              }`}
            >
              {active && <span aria-hidden className="pin size-2" />}
              {label}
              <span className="stamp h-6 min-w-6 px-1.5 text-[14px]">{count}</span>
            </button>
          );
        })}
      </div>

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
            <div className="relative space-y-7 pb-8">
              <section>
                <div className="mb-3 flex items-center gap-2.5">
                  <h2 className="font-heading text-[16px] font-bold uppercase leading-none tracking-[0.12em]">
                    Révélés
                  </h2>
                  <span className="stamp h-6 min-w-6 px-1.5 text-[14px]">{revealed.length}</span>
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </div>
                {revealed.length === 0 ? (
                  <p className="plate px-4 py-3.5 text-sm text-muted-foreground">
                    Aucun skin révélé pour l&apos;instant — ouvre des packs, ou tire les cartes de tes mystères.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {revealed.map((s, i) => (
                      <div key={i} className="plate overflow-hidden">
                        <div className="relative aspect-square w-full bg-gap">
                          {s.imageUrl ? (
                            <Image src={s.imageUrl} alt="" fill unoptimized className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Bientôt…</div>
                          )}
                          <span className={`absolute right-1 top-1 rounded-[2px] px-1.5 py-0.5 font-heading text-[12px] font-bold leading-none ${LEVEL_BADGE[s.level] ?? ""}`}>
                            N{s.level}
                          </span>
                          {s.equipped && (
                            <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.06em] text-primary-foreground">
                              Équipé
                            </span>
                          )}
                        </div>
                        <div className="px-1.5 py-1.5 text-center">
                          <p className="truncate text-[12px] font-semibold leading-tight">« {s.name} »</p>
                          <p className="truncate text-[11px] text-muted-foreground">{s.cardName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2.5">
                  <h2 className="font-heading text-[16px] font-bold uppercase leading-none tracking-[0.12em]">
                    Mystères
                  </h2>
                  <span className="stamp h-6 min-w-6 px-1.5 text-[14px]">{mysteries.length}</span>
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </div>
                {mysteries.length === 0 ? (
                  <p className="plate px-4 py-3.5 text-sm text-muted-foreground">
                    Aucun mystère en réserve.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {mysteries.map((m, i) => (
                      <div
                        key={i}
                        className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] bg-gradient-to-b text-white ${MYST_BG[m.rarity] ?? MYST_BG.common}`}
                      >
                        <span aria-hidden className="font-heading text-3xl font-bold leading-none text-white/40">?</span>
                        <span className="px-1 text-center text-[11px] font-semibold leading-tight">
                          {m.category === "animal" ? "Animal" : "Pokémon"}
                          <br />
                          {RARITY_LABELS[m.rarity].toLowerCase()}
                        </span>
                        <span className={`rounded-[2px] px-1.5 py-0.5 font-heading text-[12px] font-bold leading-none ${LEVEL_BADGE[m.level] ?? ""}`}>
                          N{m.level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2.5 text-xs text-muted-foreground">
                  Un mystère se révèle le jour où tu tires sa carte.
                </p>
              </section>
            </div>
          );
        })()
      ) : (
        <div className="relative">
          {/* La progression du classeur : la charge, en plaques. */}
          <div className="mb-4 flex items-center gap-3">
            <p className="etched shrink-0">Progression</p>
            <div className="segments relative h-2 flex-1 bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 font-heading text-[16px] font-bold leading-none tabular-nums">
              {totalUnique}
              <span className="text-muted-foreground"> / {totalAll}</span>
            </span>
          </div>

          {showFilters && (
            <>
              {/* Le classeur : tous, les animaux ou les Pokémon. */}
              <div
                role="group"
                aria-label="Classeur"
                className="mb-2 grid grid-cols-3 gap-[3px] rounded-lg bg-gap p-[3px]"
              >
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
                      aria-pressed={isActive}
                      onClick={() => {
                        setActiveCategory(cat);
                        setActiveFilter("all");
                      }}
                      className={`flex h-10 items-center justify-center gap-1.5 rounded-[3px] font-heading text-[15px] font-bold uppercase tracking-[0.06em] transition-colors ${
                        isActive ? SLOT_ON : SLOT_OFF
                      }`}
                    >
                      {isActive && <span aria-hidden className="pin size-2" />}
                      {Icon && <Icon className="size-3.5" strokeWidth={2.5} />}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Les raretés, de la plus rare à la plus commune, et
                  l'entonnoir des critères au bout de la même ligne. */}
              <div className="mb-4 flex items-stretch gap-2">
                <div
                  role="group"
                  aria-label="Rareté"
                  className="grid flex-1 grid-cols-6 gap-[3px] rounded-lg bg-gap p-[3px]"
                >
                  {[...RARITIES].reverse().map((r) => {
                    const isActive = activeFilter === r;
                    const label = `${RARITY_LABELS[r]} — ${cardsByRarity[r].length}/${totalsView[r] || 0}`;
                    return (
                      <button
                        key={r}
                        aria-pressed={isActive}
                        aria-label={label}
                        title={label}
                        onClick={() => setActiveFilter(isActive ? "all" : r)}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-[3px] font-heading text-[14px] font-bold tabular-nums transition-colors ${
                          isActive ? SLOT_ON : SLOT_OFF
                        }`}
                      >
                        <span aria-hidden className={`size-2 rounded-full ${TIER_DOT[r]}`} />
                        {cardsByRarity[r].length}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowCrits(true)}
                  aria-label="Filtrer par critère"
                  className={`plate relative flex w-[42px] shrink-0 items-center justify-center transition-colors hover:bg-plate-hover ${
                    crits.length > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Funnel className="size-4" />
                  {crits.length > 0 && (
                    <span className="pin absolute -right-1 -top-1 flex size-4 items-center justify-center font-heading text-[11px] font-bold leading-none text-primary-foreground">
                      {crits.length}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}

          {/* L'Inclassable : le sélecteur de tris absurdes */}
          {has("inclassable") && (
            <div className="mb-4 flex items-center gap-2">
              <span className="etched shrink-0">Trier</span>
              <div
                role="group"
                aria-label="Trier"
                className="grid flex-1 grid-cols-5 gap-[3px] rounded-lg bg-gap p-[3px]"
              >
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
                    aria-pressed={sortMode === mode}
                    onClick={() => setSortMode(mode)}
                    className={`flex h-8 items-center justify-center rounded-[3px] px-1 text-[12px] font-semibold transition-colors ${
                      sortMode === mode ? SLOT_ON : SLOT_OFF
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fusion bar — single tier when filter active, summary when "Tout" */}
          {fusionRarity && FUSION_NEXT[fusionRarity] ? (
            <div className="plate mb-5 flex items-center justify-between gap-3 py-2.5 pl-2.5 pr-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="stamp h-10 min-w-[2.75rem] px-2 text-[22px]">{fusionShards}</span>
                <span className="min-w-0 text-sm font-semibold leading-tight">
                  fragment{fusionShards !== 1 ? "s" : ""}{" "}
                  <span className={TIER_TEXT[fusionRarity]}>{RARITY_LABELS[fusionRarity].toLowerCase()}</span>
                </span>
              </div>
              <Button
                disabled={!canFuse || fusing !== null}
                onClick={() => handleFuse(fusionRarity)}
                variant={canFuse ? "default" : "secondary"}
                className={`h-10 shrink-0 rounded-full px-4 font-heading text-[15px] font-bold uppercase tracking-[0.06em] disabled:opacity-100 ${
                  canFuse ? "bg-gradient-orange-intense text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {fusing === fusionRarity ? "Fusion..." : `Fusionner ${FUSION_COST}→1`}
              </Button>
            </div>
          ) : activeFilter === "all" && Object.values(shardsView).some((n) => n > 0) ? (
            // Fragments : une seule ligne de pastilles. Les actions (fusion,
            // conversion) n'apparaissent que quand elles sont possibles —
            // sinon la pastille reste un simple compteur. Dans la vue « Tous »,
            // le cumul s'affiche mais sans action : fusionner et convertir visent
            // un classeur précis, il faut d'abord en choisir un.
            <div className="mb-5">
              <p className="etched mb-2 flex items-center gap-1.5">
                <Flame className="size-3.5" />
                Fragments
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {[...RARITIES].reverse().map((r) => {
                  const n = shardsView[r] || 0;
                  if (n === 0) return null;
                  const actionable = activeCategory !== "all";
                  const next = FUSION_NEXT[r];
                  const fuseable = actionable && next && n >= FUSION_COST;
                  const convBatch = CONVERSION_BATCH[r];
                  const convReward = CONVERSION_RATE[r];
                  const convertible = actionable && n >= convBatch;
                  return (
                    <span
                      key={r}
                      title={`${n} fragment${n > 1 ? "s" : ""} ${RARITY_LABELS[r].toLowerCase()}`}
                      className="plate inline-flex h-10 items-center gap-1.5 pl-2.5 pr-1.5"
                    >
                      <span aria-hidden className={`size-2 rounded-full ${TIER_DOT[r]}`} />
                      <span className="pr-1 font-heading text-[17px] font-bold tabular-nums">{n}</span>
                      {fuseable && (
                        <button
                          onClick={() => handleFuse(r)}
                          disabled={fusing !== null || converting !== null}
                          aria-label={`Fusionner ${FUSION_COST} fragments ${RARITY_LABELS[r].toLowerCase()}`}
                          className="h-7 rounded-full bg-primary px-2.5 font-heading text-[13px] font-bold uppercase text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-50"
                        >
                          {fusing === r ? "..." : `${FUSION_COST}→1`}
                        </button>
                      )}
                      {convertible && (
                        <button
                          onClick={() => handleConvert(r)}
                          disabled={converting !== null || fusing !== null}
                          aria-label={`Convertir ${convBatch} fragments ${RARITY_LABELS[r].toLowerCase()} en ${convReward} jeton${convReward > 1 ? "s" : ""}`}
                          className="h-7 rounded-full bg-secondary px-2.5 font-heading text-[13px] font-bold uppercase text-foreground shadow-[inset_0_1px_0_var(--plate-edge)] transition-colors hover:bg-plate-hover disabled:opacity-50"
                        >
                          {converting === r ? "..." : `→${convReward}j`}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
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
                      <div className="mb-3 flex items-center gap-2.5">
                        <span aria-hidden className={`h-4 w-1 rounded-[1px] ${TIER_DOT[r]}`} />
                        <h2 className="font-heading text-[16px] font-bold uppercase leading-none tracking-[0.12em]">
                          {RARITY_LABELS[r]}
                        </h2>
                        <span className="font-heading text-[15px] font-semibold leading-none tabular-nums text-muted-foreground">
                          {crits.length > 0 ? cards.length : `${cards.length}/${totalsView[r] || 0}`}
                        </span>
                        <span aria-hidden className="h-px flex-1 bg-border" />
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
        </div>
      )}

      {/* Le tiroir des critères : cumulables, comptes en direct. */}
      <Sheet open={showCrits} onOpenChange={setShowCrits}>
        <SheetContent side="bottom" className="rounded-t-lg">
          <SheetHeader>
            <SheetTitle className="uppercase tracking-[0.04em]">Filtrer par critère</SheetTitle>
            <SheetDescription className="text-xs">
              Cumulables — seules restent les cartes qui cochent tous les critères choisis.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4 pb-6">
            {CRIT_DEFS.map(({ key, label, hint, Icon, tint }) => {
              const active = crits.includes(key);
              return (
                <button
                  key={key}
                  aria-pressed={active}
                  onClick={() =>
                    setCrits((prev) => (active ? prev.filter((k) => k !== key) : [...prev, key]))
                  }
                  className={`flex items-start gap-2.5 rounded-[var(--radius)] px-3 py-3 text-left transition-colors ${
                    active ? "plate" : "bg-gap hover:bg-secondary"
                  }`}
                >
                  <Icon className={`mt-0.5 size-4 shrink-0 ${tint}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-heading text-[16px] font-bold uppercase leading-none tracking-[0.04em]">
                      {label}
                      <span className="font-heading text-[14px] tabular-nums text-muted-foreground">
                        {critCount(key)}
                      </span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
                      {hint}
                    </span>
                  </span>
                  {active && <span aria-hidden className="pin mt-1 size-2" />}
                </button>
              );
            })}
          </div>
          {crits.length > 0 && (
            <div className="px-4 pb-6">
              <Button
                variant="outline"
                onClick={() => setCrits([])}
                className="h-10 w-full rounded-full font-heading text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Tout effacer
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* La Roue de la Forge : le fragment gagné, révélé en grand */}
      {forgeWin && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Fragment gagné — toucher pour continuer"
          className="scrim fixed inset-0 z-[110] flex items-center justify-center"
          onClick={() => setForgeWin(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Escape") setForgeWin(null);
          }}
        >
          <div className="animate-card-reveal flex flex-col items-center px-8 text-center">
            <span className="stamp size-20">
              <Flame className={`size-10 ${TIER_TEXT[forgeWin.rarity]}`} />
            </span>
            <p className="etched mt-5">La Roue de la Forge</p>
            <p className="mt-2 text-4xl uppercase leading-none">
              +1 fragment{" "}
              <span className={TIER_TEXT[forgeWin.rarity]}>{RARITY_LABELS[forgeWin.rarity].toLowerCase()}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {forgeWin.category === "animal" ? "côté animaux" : "côté Pokémon"}
            </p>
            <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Toucher pour continuer
            </p>
          </div>
        </div>
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

// Le classeur vide : une plaque, l'icône frappée, et ce qu'il faut faire.
function EmptyState({ title, subtitle, big = false }: { title: string; subtitle: string; big?: boolean }) {
  return (
    <div className={`plate flex flex-col items-center gap-4 px-6 text-center ${big ? "py-12" : "py-9"}`}>
      <span className="stamp size-16">
        <Vault className="size-8" />
      </span>
      <div className="max-w-xs">
        <p className="text-2xl uppercase leading-none">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
