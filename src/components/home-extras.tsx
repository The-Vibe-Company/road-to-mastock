"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flame, Target, X, Shield, ChevronLeft, ChevronRight, Trophy, Ticket, Gem, Magnet, Check, BookOpen, Eye } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "@/components/creature-card";
import { ThroneBackdrop } from "@/components/throne-backdrop";
import { useTalents } from "@/components/talents-provider";
import { useTrophies } from "@/components/trophies-provider";
import { Medallion, METAL_NAMES, TROPHY_FAMILIES, gradeOf, trophyStatOf } from "@/components/trophy-medallion";
import { TalentDescription } from "@/components/talent-description";
import { PowerRules } from "@/components/power-rules";
import { powerLabel, polarityBreakdown, ENERGY_BY_RARITY } from "@/lib/powers";
import { RARITIES, RARITY_COLORS, RARITY_LABELS, type Rarity } from "@/lib/rarities";

// Tout ce que les Talents ajoutent à la page d'accueil : le trône, le rêve
// de Baku, la flamme de Victini, le tonnage en baleines, l'objectif hebdo,
// le chat squatteur, Ronflex endormi — et l'annonce des pouvoirs.

const NEWS_KEY = "news-gardiens-v6";

// Le mode démo : « ?nouveaute » dans l'URL rejoue TOUTE la tournée des
// annonces — Gardiens, puis Révélation des talents, puis Palmarès — même
// déjà vues. Rien n'est marqué comme annoncé dans ce mode.
function isForcedTour(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("nouveaute");
  } catch {
    return false;
  }
}

interface PreviewCard {
  name: string;
  slug: string;
  rarity: Rarity;
  imageUrl: string | null;
  number: number | null;
  category: "animal" | "pokemon";
  subtype: string | null;
}

export function HomeExtras() {
  const { loaded, has, assets } = useTalents();

  return (
    <>
      <ThroneBackdrop page="home" />
      <NewsModal />
      <TalentAnnounceModal />
      <TrophyAnnounceModal />
      <MagnesieAnnounceModal />
      <PactesAnnounceModal />

      {/* Le Squatteur : le chat traverse le bas de l'écran, sans se presser */}
      {loaded && has("squatteur") && <CatWalker />}
    </>
  );
}

// ─── L'annonce : « Tes cartes ont des pouvoirs » ────────────────────────────
// Un guide en plusieurs pages : l'annonce, le mode d'emploi (très clair),
// puis TOUTES les cartes du joueur, une par une, des communes aux mythiques.
function NewsModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [cards, setCards] = useState<PreviewCard[]>([]);
  // Lu paresseusement au premier rendu client ; false côté serveur — sans
  // conséquence, la modale ne rend rien tant qu'elle n'est pas ouverte.
  const [forced] = useState(isForcedTour);

  useEffect(() => {
    // « ?nouveaute » dans l'URL force l'annonce, déjà vue ou pas — pour la
    // remontrer à un ami ou la revoir pour le plaisir.
    const forced = new URLSearchParams(window.location.search).has("nouveaute");
    try {
      if (!forced && localStorage.getItem(NEWS_KEY)) return;
    } catch {
      return;
    }
    // Différé d'un tick : pas de setState synchrone dans un effet.
    const t = setTimeout(() => setOpen(true), 0);
    fetch("/api/cards")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const all: PreviewCard[] = [
          ...data.animals.cards.map((c: { name: string; slug: string; rarity: Rarity; imageUrl: string | null; cardNumber: number | null; lineage: string | null }) => ({
            name: c.name, slug: c.slug, rarity: c.rarity, imageUrl: c.imageUrl,
            number: c.cardNumber, category: "animal" as const, subtype: c.lineage,
          })),
          ...data.pokemon.cards.map((c: { name: string; slug: string; rarity: Rarity; imageUrl: string | null; pokedexNumber: number | null; primaryType: string | null }) => ({
            name: c.name, slug: c.slug, rarity: c.rarity, imageUrl: c.imageUrl,
            number: c.pokedexNumber, category: "pokemon" as const, subtype: c.primaryType,
          })),
        ];
        setCards(all);
      })
      .catch(() => {});
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    // En tournée de démo (?nouveaute), on ne marque rien : la vraie
    // première fois du joueur reste à venir.
    if (!forced) {
      try {
        localStorage.setItem(NEWS_KEY, "1");
      } catch {}
    }
    setOpen(false);
    setStep(0);
    // La tournée continue : au tour de la Révélation des talents.
    window.dispatchEvent(new Event("rtm:news-done"));
  };

  // Cartes groupées par rareté, dans l'ordre croissant : on commence par
  // les communes et on finit sur les mythiques — le crescendo.
  const byRarity = useMemo(() => {
    const groups = new Map<Rarity, PreviewCard[]>();
    for (const r of RARITIES) groups.set(r, []);
    for (const c of cards) groups.get(c.rarity)?.push(c);
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [cards]);

  const lowTiers = useMemo(
    () =>
      RARITIES.filter(
        (r) =>
          r !== "legendary" && r !== "mythic" && (byRarity.get(r)?.length ?? 0) > 0,
      ),
    [byRarity],
  );
  // Légendaires et mythiques : une page par carte — la cérémonie.
  const bigCards = useMemo(
    () => [...(byRarity.get("legendary") ?? []), ...(byRarity.get("mythic") ?? [])],
    [byRarity],
  );

  // Pages : 0 = annonce, 1-6 = le mode d'emploi (une règle par écran), une
  // page par rareté jusqu'à l'épique, puis une page PAR CARTE légendaire et
  // mythique — le pouvoir s'y découvre au toucher.
  const GUIDE_COUNT = 6;
  const totalSteps = 1 + GUIDE_COUNT + lowTiers.length + bigCards.length;
  const isLast = step === totalSteps - 1;
  const guideIndex = step >= 1 && step <= GUIDE_COUNT ? step : null;
  const tierIndex = step - 1 - GUIDE_COUNT;
  const currentTier: Rarity | null =
    tierIndex >= 0 && tierIndex < lowTiers.length ? lowTiers[tierIndex] : null;
  const currentBig: PreviewCard | null =
    tierIndex >= lowTiers.length ? bigCards[tierIndex - lowTiers.length] ?? null : null;

  // Le sceau : chaque grande carte arrive pouvoir caché, re-scellé à
  // chaque changement de page (dans les handlers de navigation).
  const [revealed, setRevealed] = useState(false);
  const goTo = (n: number) => {
    setStep(n);
    setRevealed(false);
  };

  // L'éventail de l'annonce : les 3 plus belles cartes, en vrai format.
  const fan = useMemo(() => {
    const order = [...RARITIES].reverse();
    return [...cards]
      .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
      .slice(0, 3);
  }, [cards]);
  const fanStyles = [
    "-rotate-[10deg] -translate-x-16 translate-y-3",
    "z-10 -translate-y-1",
    "rotate-[10deg] translate-x-16 translate-y-3",
  ];

  // Ce que vaut une carte : ±n pour la polarité, l'étage pour les grandes.
  const pointsOf = (c: PreviewCard): string => {
    if (c.rarity === "mythic") return "miracle";
    if (c.rarity === "legendary") return "prodige";
    return `±${ENERGY_BY_RARITY[c.rarity]}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="relative flex h-[37rem] max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-primary/40 bg-background sm:rounded-3xl sm:border-2 sm:border-primary/30">
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground transition-colors hover:text-primary"
        >
          <X className="size-4" />
        </button>

        {/* ── Contenu de la page ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-6">
          {step === 0 && (
            <div>
              <div className="pointer-events-none absolute left-1/2 top-24 size-64 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
                  Nouveauté
                </p>
                <h2 className="mt-1 text-[1.7rem] font-black leading-tight tracking-tighter">
                  Tes cartes ont des{" "}
                  <span className="text-gradient-orange">pouvoirs</span>
                </h2>
              </div>
              {fan.length > 0 && (
                <div className="relative mt-5 flex h-44 items-center justify-center">
                  {fan.map((card, i) => (
                    <div
                      key={i}
                      className={`absolute w-[6.5rem] drop-shadow-2xl ${fanStyles[i] ?? ""}`}
                    >
                      <CreatureCard
                        name={card.name}
                        rarity={card.rarity}
                        imageUrl={card.imageUrl}
                        number={card.number}
                        category={card.category}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
                Chacune de tes {cards.length} cartes porte désormais un pouvoir.
                Posées sur tes machines, elles deviennent des{" "}
                <strong className="text-foreground">Gardiens</strong> : elles
                s&apos;éveillent à chaque séance et améliorent tes prochains tirages.
              </p>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                On t&apos;explique tout, puis on passe tes cartes en revue — une par une.
              </p>
            </div>
          )}

          {guideIndex && (
            <GuideScreen index={guideIndex} total={GUIDE_COUNT} />
          )}

          {currentTier && (
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-widest ${RARITY_COLORS[currentTier].bg} ${RARITY_COLORS[currentTier].text} ring-1 ${RARITY_COLORS[currentTier].ring}`}>
                  {RARITY_LABELS[currentTier]}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {byRarity.get(currentTier)?.length ?? 0} carte{(byRarity.get(currentTier)?.length ?? 0) > 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {currentTier === "common" && "Polarité ±1 % : à la pose, tu choisis — attirer ou repousser."}
                {currentTier === "uncommon" && "Polarité ±2 % : attirer ou repousser, à toi de voir."}
                {currentTier === "rare" && "Polarité ±4 % : le cœur de ton armée, dans le sens que tu décides."}
                {currentTier === "epic" && "Polarité ±6 % : les plus lourds des choix du jeu."}
              </p>
              <div className="mt-3 space-y-2">
                {(byRarity.get(currentTier) ?? []).map((c, i) => {
                  const power = powerLabel(c.category, c.rarity, c.subtype, c.slug);
                  const breakdown = polarityBreakdown(c.category, c.rarity, c.subtype);
                  const pts = pointsOf(c);
                  return (
                    <div key={i} className="flex gap-3 rounded-xl bg-secondary/30 p-2.5 ring-1 ring-border">
                      <div className={`relative size-14 shrink-0 overflow-hidden rounded-lg ${RARITY_COLORS[c.rarity].bg} ring-1 ${RARITY_COLORS[c.rarity].ring}`}>
                        {c.imageUrl && (
                          <Image src={c.imageUrl} alt="" fill unoptimized className="object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className={`min-w-0 truncate text-sm font-black tracking-tight ${RARITY_COLORS[c.rarity].text}`}>
                            {c.name}
                          </p>
                          {pts && (
                            <span className={`ml-auto shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black ${pts === "miracle" ? "bg-rose-500/15 text-rose-300" : pts === "prodige" ? "bg-amber-500/15 text-amber-300" : "bg-primary/10 text-primary"}`}>
                              {pts === "miracle" || pts === "prodige" ? pts : `${pts} %`}
                            </span>
                          )}
                        </div>
                        {breakdown ? (
                          <>
                            <p className="mt-0.5 text-xs font-bold text-foreground/90">{breakdown.name}</p>
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              <span className="mr-1 rounded bg-emerald-500/15 px-1 font-mono font-black text-emerald-300">{breakdown.attract.delta}</span>
                              {breakdown.attract.text}
                            </p>
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              <span className="mr-1 rounded bg-red-500/15 px-1 font-mono font-black text-red-300">{breakdown.repel.delta}</span>
                              {breakdown.repel.text}
                            </p>
                          </>
                        ) : power ? (
                          <>
                            <p className="mt-0.5 text-xs font-bold text-foreground/90">{power.name}</p>
                            <p className="text-[11px] leading-snug text-muted-foreground">{power.description}</p>
                          </>
                        ) : (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                            Pouvoir en cours d&apos;attribution.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentBig && (() => {
            const big = currentBig;
            const isMythic = big.rarity === "mythic";
            const power = powerLabel(big.category, big.rarity, big.subtype, big.slug);
            const accent = isMythic
              ? { text: "text-rose-300", ring: "ring-rose-500/40", bg: "bg-rose-500/10", glow: "bg-rose-500/15", btn: "bg-rose-500/15 text-rose-200 ring-rose-500/50" }
              : { text: "text-amber-300", ring: "ring-amber-500/40", bg: "bg-amber-400/10", glow: "bg-amber-400/15", btn: "bg-amber-400/15 text-amber-200 ring-amber-400/50" };
            return (
              <div key={big.slug} className="animate-card-reveal flex flex-col items-center pb-2 text-center">
                <div className={`pointer-events-none absolute left-1/2 top-20 size-64 -translate-x-1/2 rounded-full ${accent.glow} blur-3xl`} />
                <p className={`font-mono text-[10px] font-black uppercase tracking-[0.35em] ${accent.text}`}>
                  {isMythic ? "Mythique" : "Légendaire"}
                </p>
                <div className="relative mt-4 w-40 drop-shadow-2xl">
                  <CreatureCard
                    name={big.name}
                    rarity={big.rarity}
                    imageUrl={big.imageUrl}
                    number={big.number}
                    category={big.category}
                    size="sm"
                  />
                </div>
                <h2 className={`mt-4 text-2xl font-black tracking-tighter ${RARITY_COLORS[big.rarity].text}`}>
                  {big.name}
                </h2>
                {!revealed ? (
                  <button
                    onClick={() => setRevealed(true)}
                    className={`mt-4 w-full max-w-xs animate-pulse rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-wider ring-2 transition-all active:scale-95 ${accent.btn}`}
                  >
                    Toucher pour révéler son {isMythic ? "miracle" : "prodige"}
                  </button>
                ) : (
                  <div className={`animate-card-reveal mt-4 w-full max-w-xs rounded-2xl px-4 py-4 text-left ring-1 ${accent.bg} ${accent.ring}`}>
                    <p className={`text-center text-[10px] font-black uppercase tracking-[0.3em] ${accent.text}`}>
                      {isMythic ? "Miracle" : "Prodige"}
                    </p>
                    <p className="mt-1 text-center text-lg font-black tracking-tight">{power.name}</p>
                    <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
                      {power.description}
                    </p>
                    {power.rules && <PowerRules text={power.rules} reminder className="mt-2.5" />}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Pied : progression + navigation ── */}
        <div className="border-t border-border/50 px-6 pb-6 pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-secondary"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                onClick={() => goTo(step - 1)}
                variant="outline"
                className="h-12 rounded-2xl border-primary/30 px-4 text-sm font-bold text-primary"
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
            {isLast ? (
              forced ? (
                <Button
                  onClick={dismiss}
                  className="h-12 flex-1 rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                >
                  Continuer la tournée
                  <ChevronRight className="size-4" strokeWidth={3} />
                </Button>
              ) : (
                <Link href="/exercises" className="flex-1" onClick={dismiss}>
                  <Button className="h-12 w-full rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black">
                    <Shield className="size-4" strokeWidth={3} />
                    Poser mes gardiens
                  </Button>
                </Link>
              )
            ) : (
              <Button
                onClick={() => goTo(step + 1)}
                className="h-12 flex-1 rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
              >
                {step === 0
                  ? "Comment ça marche"
                  : step === GUIDE_COUNT
                    ? "Voir mes cartes"
                    : "Suivant"}
                <ChevronRight className="size-4" strokeWidth={3} />
              </Button>
            )}
            {step === 0 && (
              <Button
                onClick={dismiss}
                variant="outline"
                className="h-12 rounded-2xl border-primary/30 px-4 text-sm font-bold text-primary"
              >
                Plus tard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Une règle du mode d'emploi — un écran entier, aéré, un seul message.
function GuideScreen({ index, total }: { index: number; total: number }) {
  const screens: {
    icon: React.ReactNode;
    title: React.ReactNode;
    body: React.ReactNode;
    visual?: React.ReactNode;
  }[] = [
    {
      icon: <Shield className="size-8 text-primary" strokeWidth={2.5} />,
      title: <>Pose un <span className="text-gradient-orange">Gardien</span></>,
      body: (
        <>
          Va sur la fiche d&apos;une machine — Catalogue, puis la machine, puis{" "}
          <strong className="text-foreground">Mascotte</strong> — et choisis une
          carte de ta collection.
          <br />
          <br />
          Attention : un Gardien posé est <strong className="text-foreground">lié</strong> —
          à une seule machine à la fois, et pour 30 jours… sauf à payer sa
          magnésie, la poudre qui délie.
        </>
      ),
    },
    {
      icon: <Magnet className="size-8 text-primary" strokeWidth={2.5} />,
      title: <>Un métier, une <span className="text-gradient-orange">polarité</span></>,
      body: (
        <>
          Chaque carte du commun à l&apos;épique exerce un{" "}
          <strong className="text-foreground">métier</strong>, selon sa nature.
          Et c&apos;est toi qui choisis le sens :{" "}
          <strong className="text-emerald-300">Attractif</strong> ou{" "}
          <strong className="text-red-300">Répulsif</strong>, sur sa machine.
        </>
      ),
      visual: (
        <div className="w-full space-y-2 text-left">
          <div className="rounded-xl bg-secondary/30 px-3 py-2 ring-1 ring-border">
            <p className="text-xs font-black">La Famille</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Un Pokémon ajoute des tickets « pack Pokémon » dans le chapeau,
              un animal des tickets « pack Animal » : ±1 pour un commun, ±2
              peu commun, ±4 rare, ±6 épique. Exemple : +4 tickets Pokémon
              (rare), et ce pack passe de 15 % à 18,3 % de chances. En
              Répulsif, il les retire.
            </p>
          </div>
          <div className="rounded-xl bg-secondary/30 px-3 py-2 ring-1 ring-border">
            <p className="text-xs font-black">Le Lest</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Il joue sur les tickets « pack Basique » (64 % de base). En
              Répulsif : −1 à −6 tickets Basique selon sa rareté, donc tous
              les bons packs deviennent plus probables. En Attractif, il en
              ajoute — pour farmer du commun et des fragments.
            </p>
          </div>
          <div className="rounded-xl bg-secondary/30 px-3 py-2 ring-1 ring-border">
            <p className="text-xs font-black">L&apos;Étincelle</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              En Attractif, il ajoute 0,1 à 0,6 ticket « pack Mythique » par
              éveil selon sa rareté. Le Mythique part de 1 % : trois éveils
              d&apos;un épique (+0,6) le montent à ~2,8 %. En Répulsif, il retire
              des tickets Basique.
            </p>
          </div>
          <div className="rounded-xl bg-secondary/30 px-3 py-2 ring-1 ring-border">
            <p className="text-xs font-black">La Balance</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Quand un pack Basique s&apos;ouvre, la carte tirée est animale à
              75 % et Pokémon à 25 %. La Balance déplace ce curseur de 1 à
              6 % par éveil selon sa rareté : en Attractif vers sa propre
              famille, en Répulsif vers l&apos;autre.
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: <Ticket className="size-8 text-primary" strokeWidth={2.5} />,
      title: <>Les points sont des <span className="text-gradient-orange">tickets</span></>,
      body: (
        <>
          Ouvrir un pack, c&apos;est piocher un ticket dans un chapeau qui en
          contient 100.
          <br />
          <br />
          Fais une série sur une machine gardée, clôture ta séance : son Gardien
          s&apos;éveille et modifie le chapeau. Un Répulsif peut même{" "}
          <strong className="text-foreground">vider un pack jusqu&apos;à zéro</strong>.
          <br />
          <br />
          Ouvre ton pack <strong className="text-foreground">après la séance</strong> :
          clôturer la suivante remet le chapeau à zéro avec sa propre récolte.
        </>
      ),
      visual: (
        <div className="w-full">
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            <div className="bg-zinc-600" style={{ width: "64%" }} />
            <div className="bg-emerald-500/70" style={{ width: "15%" }} />
            <div className="bg-sky-500/70" style={{ width: "15%" }} />
            <div className="bg-amber-500/80" style={{ width: "5%" }} />
            <div className="bg-rose-500" style={{ width: "1%" }} />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <span className="rounded-md bg-secondary/60 px-2 py-1 font-mono text-xs font-black tabular-nums text-muted-foreground">Basique 64</span>
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 font-mono text-xs font-black tabular-nums text-emerald-300">Animal 15</span>
            <span className="rounded-md bg-sky-500/15 px-2 py-1 font-mono text-xs font-black tabular-nums text-sky-300">Pokémon 15</span>
            <span className="rounded-md bg-amber-500/15 px-2 py-1 font-mono text-xs font-black tabular-nums text-amber-300">Premium 5</span>
            <span className="rounded-md bg-rose-500/15 px-2 py-1 font-mono text-xs font-black tabular-nums text-rose-300">Mythique 1</span>
          </div>
        </div>
      ),
    },
    {
      icon: <Gem className="size-8 text-primary" strokeWidth={2.5} />,
      title: <>Trois <span className="text-gradient-orange">étages</span> de pouvoir</>,
      body: <>Plus la carte est rare, plus l&apos;étage est haut.</>,
      visual: (
        <div className="w-full space-y-2 text-left">
          <div className="flex gap-3 rounded-xl bg-secondary/30 px-3 py-2.5 ring-1 ring-border">
            <span className="font-mono text-lg font-black text-primary">1</span>
            <div>
              <p className="text-xs font-black">La Polarité <span className="font-bold text-muted-foreground">· commun → épique</span></p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                ±1 à ±6 tickets selon la rareté, dans le sens que tu choisis.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-amber-400/5 px-3 py-2.5 ring-1 ring-amber-500/30">
            <span className="font-mono text-lg font-black text-amber-300">2</span>
            <div>
              <p className="text-xs font-black text-amber-300">Les Prodiges <span className="font-bold text-muted-foreground">· légendaire</span></p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Un pouvoir unique par carte, qui plie les règles : les portes
                vers le Premium, la roue qui perd son ×1, le pack qui refuse
                d&apos;être Basique…
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-rose-500/5 px-3 py-2.5 ring-1 ring-rose-500/30">
            <span className="font-mono text-lg font-black text-rose-300">3</span>
            <div>
              <p className="text-xs font-black text-rose-300">Les Miracles <span className="font-bold text-muted-foreground">· mythique</span></p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Encore au-dessus : jetons offerts, roue ×10, le chapeau qui
                échappe à la remise à zéro.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <BookOpen className="size-8 text-primary" strokeWidth={2.5} />,
      title: <>Le <span className="text-gradient-orange">Grimoire</span></>,
      body: (
        <>
          Certaines cartes cachent un <strong className="text-foreground">Talent</strong> :
          un privilège d&apos;appli — couleurs scellées, fonds d&apos;écran,
          pages interdites, easter eggs. Il suffit de posséder la carte, pour
          toujours.
          <br />
          <br />
          Personne ne sait lesquelles. Le <strong className="text-foreground">Grimoire</strong>,
          depuis la Collection, compte tes découvertes et garde le reste en
          silhouettes.
        </>
      ),
    },
    {
      icon: <Eye className="size-8 text-primary" strokeWidth={2.5} />,
      title: <>L&apos;<span className="text-gradient-orange">Oracle</span></>,
      body: (
        <>
          L&apos;<strong className="text-foreground">Oracle</strong>, depuis la
          Collection aussi, lit dans tes séances : tes chances de pack en
          direct, ton énergie en réserve, tes records.
          <br />
          <br />
          Ses salles les plus profondes — la frise du temps, l&apos;anatomie,
          la carte du ciel — restent verrouillées tant que le bon Talent ne
          t&apos;a pas ouvert la porte.
        </>
      ),
    },
  ];

  const screen = screens[index - 1];
  if (!screen) return null;

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-2 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        {screen.icon}
      </div>
      <p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">
        Règle {index} / {total}
      </p>
      <h2 className="mt-2 text-2xl font-black leading-tight tracking-tighter">
        {screen.title}
      </h2>
      <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-muted-foreground">
        {screen.body}
      </p>
      {screen.visual && <div className="mt-6 w-full max-w-sm">{screen.visual}</div>}
    </div>
  );
}


// ─── L'annonce des Talents à la reconnexion ─────────────────────────────────
// Si le joueur possède des cartes à talent qu'on ne lui a jamais
// présentées, on les lui révèle — la carte, le pouvoir, où le trouver.
function TalentAnnounceModal() {
  const { loaded, discovered, unannounced, refresh } = useTalents();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [forced] = useState(isForcedTour);

  useEffect(() => {
    if (!loaded || dismissed) return;
    if (forced) {
      // La tournée forcée : on attend la fin de l'annonce des Gardiens.
      const onNews = () => {
        if (discovered.some((t) => t.card)) setOpen(true);
        else window.dispatchEvent(new Event("rtm:talents-done"));
      };
      window.addEventListener("rtm:news-done", onNews);
      return () => window.removeEventListener("rtm:news-done", onNews);
    }
    if (unannounced.length === 0) return;
    // La grande annonce des Gardiens passe d'abord.
    try {
      if (!localStorage.getItem(NEWS_KEY)) return;
    } catch {}
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [loaded, unannounced, dismissed, forced, discovered]);

  const items = useMemo(
    () =>
      forced
        ? discovered.filter((t) => t.card)
        : discovered.filter((t) => unannounced.includes(t.id) && t.card),
    [discovered, unannounced, forced],
  );

  const dismiss = async () => {
    setOpen(false);
    setDismissed(true);
    setStep(0);
    if (forced) {
      // Rien n'est marqué en mode démo — on passe au Palmarès.
      window.dispatchEvent(new Event("rtm:talents-done"));
      return;
    }
    try {
      await fetch("/api/talents/announce", { method: "POST" });
    } catch {}
    refresh();
  };

  // La révélation : scellée à chaque nouveau talent.
  if (!open || items.length === 0) return null;
  const current = items[Math.min(step, items.length - 1)];
  const isLast = step >= items.length - 1;

  return (
    <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="relative flex h-[31rem] max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-amber-400/50 bg-background sm:rounded-3xl sm:border-2 sm:border-amber-400/40">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-8">
          <div className="pointer-events-none absolute left-1/2 top-16 size-56 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

          <p className="text-center font-mono text-[10px] font-black uppercase tracking-[0.35em] text-amber-300/70">
            Révélation · {step + 1} / {items.length}
          </p>

          <div key={current.id} className="animate-card-reveal mt-5 flex flex-col items-center text-center">
            <div className={`relative size-32 overflow-hidden rounded-2xl ${RARITY_COLORS[current.card!.rarity as Rarity]?.bg ?? "bg-secondary/40"} ring-2 ${RARITY_COLORS[current.card!.rarity as Rarity]?.ring ?? "ring-border"} drop-shadow-2xl`}>
              {current.card!.imageUrl && (
                <Image src={current.card!.imageUrl} alt="" fill unoptimized className="object-cover" />
              )}
            </div>
            <p className={`mt-3 text-xl font-black tracking-tight ${RARITY_COLORS[current.card!.rarity as Rarity]?.text ?? ""}`}>
              {current.card!.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cette carte cachait un Talent — gagné pour toujours.
            </p>

            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="mt-5 w-full max-w-xs animate-pulse rounded-2xl bg-amber-400/15 px-4 py-4 text-xs font-black uppercase tracking-wider text-amber-200 ring-2 ring-amber-400/50 transition-all active:scale-95"
              >
                Toucher pour révéler son talent
              </button>
            ) : (
              <div className="animate-card-reveal mt-5 w-full max-w-xs rounded-2xl bg-amber-400/5 px-4 py-4 text-left ring-1 ring-amber-400/30">
                <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
                  Talent
                </p>
                <p className="mt-1 text-center text-lg font-black tracking-tight text-amber-200">
                  {current.name}
                </p>
                <TalentDescription
                  text={current.description}
                  className="mt-2 text-xs leading-relaxed text-foreground/85"
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 px-6 pb-6 pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-amber-400" : i < step ? "w-1.5 bg-amber-400/50" : "w-1.5 bg-secondary"
                }`}
              />
            ))}
          </div>
          {isLast ? (
            <Button
              onClick={dismiss}
              className="h-12 w-full rounded-2xl bg-amber-400 text-sm font-black uppercase tracking-wider text-black hover:bg-amber-300"
            >
              <Check className="size-4" />
              Compris, ils sont à moi
            </Button>
          ) : (
            <Button
              onClick={() => {
                setStep((n) => n + 1);
                setRevealed(false);
              }}
              className="h-12 w-full rounded-2xl bg-amber-400 text-sm font-black uppercase tracking-wider text-black hover:bg-amber-300"
            >
              Talent suivant
              <ChevronRight className="size-4" strokeWidth={3} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}



// ─── L'annonce de la Magnésie ───────────────────────────────────────────────
// La nouveauté du déliement : la règle, les prix — et les cartes du joueur
// qui portent la poudre, s'il en a.
// ─── Les pactes requalifiés : Yéti et Léviathan ─────────────────────────────
// L'énergie des Gardiens tient désormais jusqu'à la prochaine clôture :
// leurs deux pouvoirs, qui protégeaient l'OUVERTURE, agissent maintenant
// à la CLÔTURE. On ne prévient que les joueurs qui possèdent ces cartes.
// `?pactes` dans l'URL force l'aperçu sans rien marquer.

const PACTES_KEY = "news-pactes-v1";

const PACT_CHANGES: Record<string, { title: string; before: string; after: string }> = {
  yeti: {
    title: "Le Blizzard Gardien",
    before: "jusqu'à 10 tickets par direction survivaient à ta prochaine OUVERTURE de pack.",
    after: "à la prochaine CLÔTURE, jusqu'à 10 tickets par direction survivent à la remise à zéro.",
  },
  leviathan: {
    title: "Le Pardon des Abysses",
    before: "si ta prochaine ouverture sortait un pack Basique, tes tickets n'étaient pas consommés.",
    after: "à la clôture, si ton DERNIER pack ouvert était un Basique, toute ton énergie survit.",
  },
};

function isForcedPactes(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("pactes");
}

function PactesAnnounceModal() {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<{ slug: string; name: string; rarity: Rarity; imageUrl: string | null }[]>([]);
  const [forced] = useState(isForcedPactes);

  useEffect(() => {
    if (!forced) {
      try {
        if (localStorage.getItem(PACTES_KEY)) return;
        if (!localStorage.getItem(NEWS_KEY)) return; // la grande annonce d'abord
      } catch {
        return;
      }
    }
    const t = setTimeout(() => {
      fetch("/api/pactes")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const owned = (d?.cards ?? []).filter((c: { slug: string }) => PACT_CHANGES[c.slug]);
          // Sans carte concernée : rien à annoncer, on marque et on se tait.
          if (owned.length === 0 && !forced) {
            try {
              localStorage.setItem(PACTES_KEY, "1");
            } catch {}
            return;
          }
          setCards(owned);
          setOpen(true);
        })
        .catch(() => {});
    }, 1400);
    return () => clearTimeout(t);
  }, [forced]);

  const dismiss = () => {
    if (!forced) {
      try {
        localStorage.setItem(PACTES_KEY, "1");
      } catch {}
    }
    setOpen(false);
  };

  if (!open) return null;
  const shown = cards.length > 0 ? cards : [];

  return (
    <div data-pactes="" className="fixed inset-0 z-[103] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-primary/50 bg-background sm:rounded-3xl sm:border-2 sm:border-primary/40">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-8">
          <p className="text-center font-mono text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">
            Rééquilibrage
          </p>
          <h2 className="mt-1 text-center text-2xl font-black leading-tight tracking-tighter">
            Tes pactes ont <span className="text-gradient-orange">changé</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            L&apos;énergie des Gardiens vaut désormais pour{" "}
            <strong className="text-foreground">tous tes packs</strong>, jusqu&apos;à
            la prochaine clôture qui la remplace. Plus rien ne se consomme à
            l&apos;ouverture — alors tes cartes qui protégeaient l&apos;ouverture
            protègent maintenant la <strong className="text-foreground">clôture</strong>.
          </p>

          <div className="mt-4 space-y-3">
            {(shown.length > 0 ? shown : Object.keys(PACT_CHANGES).map((slug) => ({ slug, name: "", rarity: "legendary" as Rarity, imageUrl: null }))).map((c) => {
              const chg = PACT_CHANGES[c.slug];
              if (!chg) return null;
              return (
                <div key={c.slug} className="rounded-xl bg-secondary/30 p-3 ring-1 ring-border">
                  <div className="flex items-center gap-2.5">
                    {c.imageUrl && (
                      <div className={`relative size-9 shrink-0 overflow-hidden rounded-lg ${RARITY_COLORS[c.rarity]?.bg ?? ""} ring-1 ${RARITY_COLORS[c.rarity]?.ring ?? "ring-border"}`}>
                        <Image src={c.imageUrl} alt="" fill unoptimized className="object-cover" />
                      </div>
                    )}
                    <p className={`text-sm font-black ${RARITY_COLORS[c.rarity]?.text ?? ""}`}>
                      {chg.title}
                      {c.name && <span className="ml-1.5 text-xs font-bold text-muted-foreground">({c.name})</span>}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-black uppercase tracking-wider text-red-300/80">Avant</span>{" "}
                    — {chg.before}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-black uppercase tracking-wider text-emerald-300/80">Maintenant</span>{" "}
                    — {chg.after}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-border/60 px-6 py-4">
          <button
            onClick={dismiss}
            className="w-full rounded-xl bg-gradient-orange-intense py-3 text-sm font-black uppercase tracking-wider text-black transition-all active:scale-95"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}

const MAGNESIE_KEY = "news-magnesie-v1";

interface MagnesieCarrier {
  category: "animal" | "pokemon";
  name: string;
  rarity: Rarity;
  imageUrl: string | null;
  yieldPerAwakening: number | null;
}

function MagnesieAnnounceModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ balance: number; carriers: MagnesieCarrier[] } | null>(null);
  const [forced] = useState(isForcedTour);

  useEffect(() => {
    const show = () => {
      fetch("/api/magnesie")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setData(d);
          setOpen(true);
        })
        .catch(() => {});
    };
    if (forced) {
      // La tournée forcée : la Magnésie ferme le cortège, après le Palmarès.
      window.addEventListener("rtm:trophies-done", show);
      return () => window.removeEventListener("rtm:trophies-done", show);
    }
    try {
      if (localStorage.getItem(MAGNESIE_KEY)) return;
      if (!localStorage.getItem(NEWS_KEY)) return; // la grande annonce d'abord
    } catch {
      return;
    }
    const t = setTimeout(show, 1000);
    return () => clearTimeout(t);
  }, [forced]);

  const dismiss = () => {
    if (!forced) {
      try {
        localStorage.setItem(MAGNESIE_KEY, "1");
      } catch {}
    }
    setOpen(false);
  };

  if (!open) return null;
  const carriers = data?.carriers ?? [];

  return (
    <div className="fixed inset-0 z-[103] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="relative flex h-[34rem] max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-sky-400/50 bg-background sm:rounded-3xl sm:border-2 sm:border-sky-400/40">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-8">
          <div className="pointer-events-none absolute left-1/2 top-14 size-56 -translate-x-1/2 rounded-full bg-sky-400/10 blur-3xl" />
          <p className="text-center font-mono text-[10px] font-black uppercase tracking-[0.35em] text-sky-300/70">
            Nouveauté
          </p>
          <h2 className="mt-1 text-center text-2xl font-black leading-tight tracking-tighter">
            La <span className="text-sky-300">Magnésie</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Un Gardien lié ne se libère qu&apos;après 30 jours. Désormais, il
            y a une seconde voie :{" "}
            <strong className="text-foreground">payer sa magnésie</strong> —
            la poudre qui délie — au prix du rang de la carte libérée.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {([["Commun", 4], ["Peu commun", 6], ["Rare", 9], ["Épique", 12], ["Légendaire", 16], ["Mythique", 20]] as const).map(([label, price]) => (
              <span key={label} className="rounded-md bg-secondary/50 px-2 py-1 font-mono text-[10px] font-black tabular-nums text-muted-foreground ring-1 ring-border">
                {label} {price}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Où la trouver ? Environ une carte sur dix la{" "}
            <strong className="text-foreground">porte</strong>, tirée au sort
            une fois pour toutes : quand elle s&apos;éveille — posée en
            Gardienne ou tirée par l&apos;Échappée du cardio — elle dépose sa
            poudre en plus de son pouvoir.
          </p>

          {carriers.length > 0 ? (
            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-300">
                {carriers.length} de tes cartes la portent
              </p>
              <div className="mt-2 space-y-1.5">
                {carriers.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg bg-sky-500/5 p-2 ring-1 ring-sky-500/20">
                    <div className={`relative size-9 shrink-0 overflow-hidden rounded-lg ${RARITY_COLORS[c.rarity]?.bg ?? "bg-secondary/40"} ring-1 ${RARITY_COLORS[c.rarity]?.ring ?? "ring-border"}`}>
                      {c.imageUrl && (
                        <Image src={c.imageUrl} alt="" fill unoptimized className="object-cover" />
                      )}
                    </div>
                    <p className={`min-w-0 flex-1 truncate text-xs font-black ${RARITY_COLORS[c.rarity]?.text ?? ""}`}>
                      {c.name}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] font-black text-sky-300">
                      +{c.yieldPerAwakening} / éveil
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-secondary/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-border">
              Aucune de tes cartes actuelles ne la porte — elle t&apos;attend
              dans les packs. Personne ne sait lesquelles avant de les tirer.
            </p>
          )}
        </div>
        <div className="border-t border-border/50 px-6 pb-6 pt-4">
          <Button
            onClick={dismiss}
            className="h-12 w-full rounded-2xl bg-sky-400 text-sm font-black uppercase tracking-wider text-black hover:bg-sky-300"
          >
            <Check className="size-4" />
            Compris
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Le Squatteur ───────────────────────────────────────────────────────────
// Un chat dessiné à la main (SVG) qui marche le long du bas de l'écran,
// de droite à gauche, en boucle lente. Pattes alternées, queue vivante,
// petit bob du corps — il ne te regarde pas, il passe.
function CatWalker() {
  return (
    <div aria-hidden className="cat-track pointer-events-none fixed bottom-16 left-0 z-30">
      <svg
        width="52"
        height="34"
        viewBox="0 0 52 34"
        className="cat-body text-foreground/80 drop-shadow-lg"
        fill="currentColor"
      >
        {/* pattes arrière + avant : deux paires alternées */}
        <g className="cat-legs-a">
          <rect x="12" y="22" width="3" height="10" rx="1.5" />
          <rect x="34" y="22" width="3" height="10" rx="1.5" />
        </g>
        <g className="cat-legs-b">
          <rect x="18" y="22" width="3" height="10" rx="1.5" />
          <rect x="40" y="22" width="3" height="10" rx="1.5" />
        </g>
        {/* le corps */}
        <rect x="9" y="12" width="34" height="13" rx="6.5" />
        {/* la tête, tournée vers la gauche (sens de la marche) */}
        <circle cx="8.5" cy="12" r="6.5" />
        {/* les oreilles */}
        <path d="M3.5 8.5 L4.5 2.5 L9 6.5 Z" />
        <path d="M9.5 6 L12.5 1.5 L14.5 7.5 Z" />
        {/* la queue, relevée, qui ondule */}
        <path
          className="cat-tail"
          d="M42 16 Q 50 14 49 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ─── La vitrine ─────────────────────────────────────────────────────────────
// Les gadgets des Talents — rigolos mais secondaires : ils vivent en bas de
// page, compacts, sous les vraies informations d'entraînement.
export function HomeTrinkets() {
  const { loaded, has, assets, home, profile, discovered } = useTalents();
  // La modal d'explication : quel talent, quelle carte, pourquoi c'est là.
  const [explain, setExplain] = useState<string | null>(null);
  if (!loaded) return null;
  const explained = explain ? discovered.find((t) => t.id === explain) : null;

  const hasAny =
    (has("sieste") && (home.siesteDays ?? 0) >= 4) ||
    has("flamme-v") ||
    has("tonnage") ||
    (has("resolution") && profile?.weeklyGoal) ||
    (has("songe") && home.dream?.imageUrl);
  if (!hasAny) return null;

  return (
    <div className="relative mt-8 space-y-2">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
        La vitrine
      </p>

      {/* La Sieste : Ronflex garde sa place — c'est un rappel, pas un gadget */}
      {has("sieste") && assets["sieste"] && (home.siesteDays ?? 0) >= 4 && (
        <button onClick={() => setExplain("sieste")} className="flex w-full items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2 text-left ring-1 ring-border transition-all active:scale-[0.99]">
          <div className="relative size-10 shrink-0">
            <Image src={assets["sieste"]!} alt="" fill unoptimized className="snorlax-sleep object-contain" />
          </div>
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
            <span className="font-black text-foreground">Ronflex s&apos;est endormi</span>
            {" — "}{home.siesteDays} jours sans séance. Viens le réveiller.
          </p>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {has("flamme-v") && (
          <button onClick={() => setExplain("flamme-v")} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5 ring-1 ring-border transition-all active:scale-95">
            <Flame className={`size-3.5 ${(home.recordStreak ?? 0) > 0 ? "text-orange-400" : "text-muted-foreground/40"}`} />
            <span className="font-mono text-xs font-black tabular-nums text-primary">{home.recordStreak ?? 0}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">records</span>
          </button>
        )}
        {has("resolution") && profile?.weeklyGoal ? (
          <button onClick={() => setExplain("resolution")} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5 ring-1 ring-border transition-all active:scale-95">
            <Target className={`size-3.5 ${(home.weekSessions ?? 0) >= profile.weeklyGoal ? "text-emerald-400" : "text-primary"}`} />
            <span className="font-mono text-xs font-black tabular-nums text-primary">
              {home.weekSessions ?? 0}/{profile.weeklyGoal}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">semaine</span>
          </button>
        ) : null}
        {has("tonnage") && home.tonnageWhales != null && (
          <button onClick={() => setExplain("tonnage")} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5 ring-1 ring-border transition-all active:scale-95">
            {assets["tonnage"] && (
              <Image src={assets["tonnage"]!} alt="" width={16} height={16} unoptimized className="size-4 object-contain" />
            )}
            <span className="font-mono text-xs font-black tabular-nums text-primary">{home.tonnageWhales}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">baleines</span>
          </button>
        )}
        {has("songe") && home.dream?.imageUrl && (
          <button onClick={() => setExplain("songe")} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5 ring-1 ring-border transition-all active:scale-95">
            <Image src={home.dream.imageUrl} alt="" width={16} height={16} unoptimized className="size-4 object-contain" />
            <span className={`max-w-32 truncate text-xs font-black ${RARITY_COLORS[home.dream.rarity as Rarity]?.text ?? ""}`}>
              {home.dream.name}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">rêve de Baku</span>
          </button>
        )}
      </div>

      {/* Pourquoi je vois ça : la carte responsable, son talent, son effet */}
      {explained && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
          onClick={() => setExplain(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t-2 border-t-primary/40 bg-background px-6 pb-8 pt-6 sm:rounded-3xl sm:border-2 sm:border-primary/30"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
              Pourquoi je vois ça
            </p>
            <div className="mt-3 flex items-center gap-3">
              {explained.card?.imageUrl && (
                <div className={`relative size-14 shrink-0 overflow-hidden rounded-xl ${RARITY_COLORS[explained.card.rarity as Rarity]?.bg ?? "bg-secondary/40"} ring-1 ${RARITY_COLORS[explained.card.rarity as Rarity]?.ring ?? "ring-border"}`}>
                  <Image src={explained.card.imageUrl} alt="" fill unoptimized className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl tracking-tight">{explained.name}</h2>
                {explained.card && (
                  <p className={`text-xs font-bold ${RARITY_COLORS[explained.card.rarity as Rarity]?.text ?? "text-muted-foreground"}`}>
                    l&apos;aura de {explained.card.name}
                  </p>
                )}
              </div>
            </div>
            <TalentDescription
              text={explained.description}
              className="mt-3 text-sm leading-relaxed text-muted-foreground"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/70">
              Ce privilège est actif parce que cette carte est dans ta
              collection — il vivra tant qu&apos;elle y sera. Retrouve tous tes
              talents dans le Grimoire.
            </p>
            <Button
              onClick={() => setExplain(null)}
              className="mt-4 h-11 w-full rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
            >
              Compris
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── La célébration des Trophées à la reconnexion ───────────────────────────
// La cérémonie : un trophée par écran, remis un par un. Le titre gagné se
// révèle ici — c'était son secret.
function TrophyAnnounceModal() {
  const { loaded, trophies, unannounced, refresh } = useTrophies();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const [forced] = useState(isForcedTour);

  useEffect(() => {
    if (!loaded || dismissed) return;
    if (forced) {
      // La tournée forcée : après la Révélation des talents.
      const onTalents = () => {
        if (trophies.some((t) => t.earned)) setOpen(true);
        else window.dispatchEvent(new Event("rtm:trophies-done"));
      };
      window.addEventListener("rtm:talents-done", onTalents);
      return () => window.removeEventListener("rtm:talents-done", onTalents);
    }
    if (unannounced.length === 0) return;
    try {
      if (!localStorage.getItem(NEWS_KEY)) return; // la grande annonce d'abord
    } catch {}
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [loaded, unannounced, dismissed, forced, trophies]);

  const items = useMemo(
    () =>
      forced
        ? trophies.filter((t) => t.earned)
        : trophies.filter((t) => unannounced.includes(t.id)),
    [trophies, unannounced, forced],
  );

  const dismiss = async () => {
    setOpen(false);
    setDismissed(true);
    setStep(0);
    if (forced) {
      // Rien n'est marqué — au tour de la Magnésie.
      window.dispatchEvent(new Event("rtm:trophies-done"));
      return;
    }
    try {
      await fetch("/api/trophies/announce", { method: "POST" });
    } catch {}
    refresh();
  };

  if (!open || items.length === 0) return null;
  const current = items[Math.min(step, items.length - 1)];
  const isLast = step >= items.length - 1;
  const fam = TROPHY_FAMILIES[trophyStatOf(current.id)] ?? TROPHY_FAMILIES.sessions;

  return (
    <div className="fixed inset-0 z-[104] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="relative flex h-[31rem] max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-yellow-400/50 bg-background sm:rounded-3xl sm:border-2 sm:border-yellow-400/40">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-8">
          {/* Le halo prend la couleur de la famille du trophée */}
          <div className={`pointer-events-none absolute left-1/2 top-10 size-52 -translate-x-1/2 rounded-full ${fam.glow} blur-3xl`} />

          <p className="text-center font-mono text-[10px] font-black uppercase tracking-[0.35em] text-yellow-300/70">
            Palmarès · {step + 1} / {items.length}
          </p>

          <div key={current.id} className="animate-card-reveal mt-5 flex flex-col items-center text-center">
            <span className={`rounded-md bg-black/30 px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.3em] ring-1 ring-border ${fam.accent}`}>
              {fam.label} · {METAL_NAMES[gradeOf(current)]}
            </span>
            <div className="mt-5">
              <Medallion entry={current} size="lg" />
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">
              Trophée gagné
            </p>
            <h2 className="mt-1 text-3xl leading-tight tracking-tight text-yellow-100">
              {current.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{current.description}</p>
            <p className="mt-4 rounded-xl bg-yellow-500/10 px-4 py-2.5 text-sm font-bold text-yellow-200 ring-1 ring-yellow-500/40">
              {current.rewardLabel}
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 px-6 pb-6 pt-4">
          <div className="mb-3 flex items-center justify-center gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-yellow-400" : i < step ? "w-1.5 bg-yellow-400/50" : "w-1.5 bg-secondary"
                }`}
              />
            ))}
          </div>
          {isLast ? (
            <>
              <Link href="/trophees" onClick={dismiss}>
                <Button className="h-12 w-full rounded-2xl bg-yellow-400 text-sm font-black uppercase tracking-wider text-black hover:bg-yellow-300">
                  <Trophy className="size-4" />
                  Voir la Salle des Trophées
                </Button>
              </Link>
              <button
                onClick={dismiss}
                className="mt-2 w-full text-center text-xs font-bold text-muted-foreground"
              >
                Fermer
              </button>
            </>
          ) : (
            <Button
              onClick={() => setStep((n) => n + 1)}
              className="h-12 w-full rounded-2xl bg-yellow-400 text-sm font-black uppercase tracking-wider text-black hover:bg-yellow-300"
            >
              Trophée suivant
              <ChevronRight className="size-4" strokeWidth={3} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
