"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { CreatureCard } from "@/components/creature-card";
import { Search, PawPrint, Zap, Loader2, Vault, Check, Trash2, Lock } from "@/components/icons";
import { RARITIES, RARITY_LABELS, type Rarity } from "@/lib/rarities";
import type { Mascot, MascotCategory } from "@/lib/mascot-types";
import { powerLabel, powerShorts } from "@/lib/powers";

interface OwnedCard {
  id: number;
  name: string;
  slug?: string;
  rarity: Rarity;
  imageUrl: string | null;
  cardNumber?: number | null;
  pokedexNumber?: number | null;
  primaryType?: string | null;
  secondaryType?: string | null;
  lineage?: string | null;
}

interface CollectionResponse {
  animals: { cards: OwnedCard[] };
  pokemon: { cards: OwnedCard[] };
  // Qui garde quoi : pour griser les cartes déjà en poste ailleurs.
  guardians?: { category: MascotCategory; cardId: number; exerciseId: number; exerciseName: string }[];
}

const TIER_DOT: Record<Rarity, string> = {
  common: "bg-zinc-400",
  uncommon: "bg-emerald-400",
  rare: "bg-sky-400",
  epic: "bg-violet-400",
  legendary: "bg-amber-400",
  mythic: "bg-rose-400",
};

// L'étiquette de pouvoir sous chaque carte du sélecteur : métier ± pour le
// commun → épique, le NOM du prodige/miracle pour les grandes.
function cardPowerHint(card: OwnedCard, category: MascotCategory): string {
  const subtype = category === "animal" ? card.lineage ?? null : card.primaryType ?? null;
  if (card.rarity === "legendary" || card.rarity === "mythic") {
    return powerLabel(category, card.rarity, subtype, card.slug).name;
  }
  return powerShorts(category, subtype, card.rarity).tiny;
}

const TIER_TEXT: Record<Rarity, string> = {
  common: "text-zinc-300",
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  epic: "text-violet-300",
  legendary: "text-amber-300",
  mythic: "text-rose-300",
};

interface MascotPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  // Un Gardien ne tient qu'un poste : quand on choisit pour une MACHINE,
  // les cartes déjà en poste ailleurs sont grisées et incliquables.
  // (Le Totem et l'Étendard, purement décoratifs, restent libres.)
  exerciseId?: number;
  blockPostedElsewhere?: boolean;
  // Texte d'entête — par défaut celui des mascottes de machine ; le Totem
  // et autres réemplois passent le leur.
  title?: string;
  description?: string;
  current: Mascot | null;
  onSelect: (
    mascot: { category: MascotCategory; id: number } | null,
  ) => void | Promise<void>;
}

export function MascotPicker({
  open,
  onOpenChange,
  exerciseName,
  exerciseId,
  blockPostedElsewhere = false,
  title = "Mascotte",
  description,
  current,
  onSelect,
}: MascotPickerProps) {
  const [data, setData] = useState<CollectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<MascotCategory>("animal");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Les postes occupés AILLEURS : clé « catégorie:id » → nom de la machine.
  const postedElsewhere = useMemo(() => {
    const map = new Map<string, string>();
    if (!blockPostedElsewhere) return map;
    for (const g of data?.guardians ?? []) {
      if (exerciseId != null && g.exerciseId === exerciseId) continue;
      map.set(`${g.category}:${g.cardId}`, g.exerciseName);
    }
    return map;
  }, [data, blockPostedElsewhere, exerciseId]);

  // On ouvre sur la catégorie de la mascotte actuelle : changer de Pikachu
  // pour un autre pokémon ne doit pas commencer par un aller-retour d'onglet.
  const currentCategory = current?.category ?? null;
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setCategory(currentCategory ?? "animal");
  }, [open, currentCategory]);

  // La collection ne bouge pas pendant qu'on choisit : un seul chargement,
  // conservé si l'utilisateur rouvre la feuille.
  useEffect(() => {
    if (!open || data || loading) return;
    setLoading(true);
    fetch("/api/cards")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, data, loading]);

  const cards = useMemo(() => {
    const section =
      category === "animal" ? data?.animals.cards : data?.pokemon.cards;
    const list = section ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) => c.name.toLowerCase().includes(q))
      : list;
    // Les plus rares d'abord : c'est là qu'on va chercher sa mascotte.
    const order = [...RARITIES].reverse();
    return [...filtered].sort(
      (a, b) =>
        order.indexOf(a.rarity) - order.indexOf(b.rarity) ||
        a.name.localeCompare(b.name),
    );
  }, [data, category, search]);

  const byRarity = useMemo(() => {
    const groups = new Map<Rarity, OwnedCard[]>();
    for (const c of cards) {
      if (!groups.has(c.rarity)) groups.set(c.rarity, []);
      groups.get(c.rarity)!.push(c);
    }
    return groups;
  }, [cards]);

  const pick = async (card: OwnedCard) => {
    if (saving) return;
    setSaving(true);
    try {
      await onSelect({ category, id: card.id });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSelect(null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="!h-[92dvh] rounded-t-3xl border-t-2 border-t-primary/20"
      >
        <SheetHeader>
          <SheetTitle className="text-lg font-black tracking-tight">
            {title}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {description ?? `La carte choisie décore ${exerciseName} en filigrane pendant la séance.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/30 p-1">
            {(["animal", "pokemon"] as MascotCategory[]).map((cat) => {
              const isActive = category === cat;
              const Icon = cat === "animal" ? PawPrint : Zap;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-colors ${
                    isActive
                      ? "bg-gradient-orange-intense text-black shadow-lg"
                      : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={2.5} />
                  {cat === "animal" ? "Animaux" : "Pokémon"}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher une carte..."
              className="h-11 bg-secondary/50 pl-9 font-medium"
            />
          </div>

          {current && (
            <button
              onClick={clear}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-secondary/50 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Retirer {current.name}
            </button>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-6 animate-spin text-primary/60" />
              </div>
            ) : cards.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/40 ring-1 ring-border">
                  <Vault className="size-7 text-muted-foreground/60" />
                </div>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  {search
                    ? "Aucune carte à ce nom dans ta collection."
                    : "Aucune carte de cette catégorie. Termine une séance pour gagner un jeton et ouvrir un pack."}
                </p>
              </div>
            ) : (
              <div className="space-y-6 pb-2">
                {[...RARITIES].reverse().map((rarity) => {
                  const group = byRarity.get(rarity);
                  if (!group?.length) return null;
                  return (
                    <section key={rarity}>
                      <div className="mb-2.5 flex items-center gap-3">
                        <div className={`h-4 w-1 rounded-full ${TIER_DOT[rarity]}`} />
                        <h3
                          className={`text-[10px] font-black uppercase tracking-[0.25em] ${TIER_TEXT[rarity]}`}
                        >
                          {RARITY_LABELS[rarity]}
                        </h3>
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {group.length}
                        </span>
                        <div className={`h-px flex-1 ${TIER_DOT[rarity]} opacity-20`} />
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {group.map((card) => {
                          const isCurrent =
                            current?.category === category && current.id === card.id;
                          const busyAt = postedElsewhere.get(`${category}:${card.id}`);
                          return (
                            <button
                              key={card.id}
                              onClick={() => {
                                if (busyAt) return;
                                pick(card);
                              }}
                              disabled={saving || !!busyAt}
                              className={`group relative block w-full transition-all duration-150 active:scale-95 disabled:opacity-60 ${
                                busyAt ? "opacity-40 grayscale" : ""
                              }`}
                            >
                              <CreatureCard
                                name={card.name}
                                rarity={card.rarity}
                                imageUrl={card.imageUrl}
                                number={
                                  category === "animal"
                                    ? card.cardNumber ?? null
                                    : card.pokedexNumber ?? null
                                }
                                category={category}
                                primaryType={card.primaryType}
                                secondaryType={card.secondaryType}
                                size="sm"
                                className={
                                  isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                                }
                              />
                              {isCurrent && (
                                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-black shadow-lg">
                                  <Check className="size-3" strokeWidth={4} />
                                </span>
                              )}
                              {/* Ce que fait la carte — ou pourquoi elle est
                                  indisponible : un Gardien, un seul poste. */}
                              {busyAt ? (
                                <p className="mt-1 flex items-center justify-center gap-1 truncate text-center text-[9px] font-bold leading-tight text-amber-400/90">
                                  <Lock className="size-2.5 shrink-0" />
                                  Garde « {busyAt} »
                                </p>
                              ) : (
                                <p className={`mt-1 truncate text-center text-[9px] font-bold leading-tight ${TIER_TEXT[card.rarity]}`}>
                                  {cardPowerHint(card, category)}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
