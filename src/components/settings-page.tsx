"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Sun, Moon, Flag, Lock, BookOpen, ChevronRight } from "@/components/icons";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ACCENT_KEYS } from "@/lib/colors";
import { unlockedTrophyColors } from "@/lib/trophies";
import { ColorPicker } from "./color-picker";
import { useAccent } from "./accent-provider";
import { useTalents } from "./talents-provider";
import { useTrophies } from "./trophies-provider";
import { MascotPicker } from "./mascot-picker";
import { BackButton } from "./back-button";
import { LogoutButton } from "./logout-button";
import type { MascotCategory } from "@/lib/mascot-types";

// Trônes disponibles par page — mêmes ids que côté serveur.
const THRONE_OPTIONS: Record<"home" | "session" | "collection", { id: string; label: string }[]> = {
  home: [
    { id: "serpent-monde", label: "Le Serpent-Monde" },
    { id: "traversee", label: "La Traversée" },
  ],
  session: [
    { id: "jardin", label: "Le Jardin" },
    { id: "etreinte", label: "L'Étreinte" },
  ],
  collection: [{ id: "mere-dragons", label: "La Mère des Dragons" }],
};

const PAGE_LABELS: Record<"home" | "session" | "collection", string> = {
  home: "Accueil",
  session: "Séance",
  collection: "Collection",
};

// Un titre de bloc : gravé sur la plaque, en capitales étroites (le même
// que sur le Dashboard de l'accueil).
const BLOCK_TITLE =
  "font-heading text-[14px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

// Le texte posé dans la glissière : en mode papier, le jour entre deux
// plaques est clair, le gris atténué n'y suffit plus.
const ON_GAP = "text-muted-foreground [.light_&]:text-secondary-foreground";

// La glissière : les choix rangés dans le jour sombre de la pile. Celui
// qu'on a pris en sort, devient une plaque, et porte la goupille.
function Slot({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`gap-[3px] rounded-lg bg-gap p-[3px] ${className}`}>{children}</div>;
}

function SlotOption({
  selected,
  onClick,
  className = "",
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-10 items-center justify-center gap-2 rounded-[3px] px-3 text-[13px] font-semibold transition-colors active:translate-y-px ${
        selected ? "plate text-foreground" : `${ON_GAP} hover:bg-secondary hover:text-foreground`
      } ${className}`}
    >
      {selected && <span aria-hidden className="pin size-2" />}
      {children}
    </button>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useAccent();
  const { has, profile, refresh } = useTalents();
  const { hasFeature, earned, loaded: trophiesLoaded } = useTrophies();
  const [titles, setTitles] = useState<string[]>([]);
  const [showTotemPicker, setShowTotemPicker] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.titles)) setTitles(d.titles);
      })
      .catch(() => {});
  }, []);

  const patch = async (body: object) => {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  };

  const anyThrone = (Object.keys(THRONE_OPTIONS) as ("home" | "session" | "collection")[]).some(
    (page) => THRONE_OPTIONS[page].some((o) => has(o.id)),
  );

  // Le compte des couleurs de base gagnées, frappé à côté du titre.
  const trophyColors = unlockedTrophyColors(earned);
  const earnedColors = ACCENT_KEYS.filter((k) => trophyColors.has(k)).length;
  const lightUnlocked = hasFeature("light");

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-12 pt-6">
      <BackButton fallback="/" />

      <header className="mb-6 mt-3">
        <p className="etched">Le vestiaire</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">Paramètres</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce que tu as gagné à la salle, tu le portes ici : couleur, thème, titre.
        </p>
      </header>

      {/* Les réglages : une pile de plaques, la couleur en tête. */}
      <div className="plate-stack">
        {/* Color picker */}
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
              Couleur principale
            </CardTitle>
            {trophiesLoaded && (
              <CardAction>
                <span
                  className="stamp h-6 px-1.5 text-[15px]"
                  aria-label={`${earnedColors} couleurs gagnées sur ${ACCENT_KEYS.length}`}
                  title="Couleurs gagnées"
                >
                  {earnedColors}/{ACCENT_KEYS.length}
                </span>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <ColorPicker />
          </CardContent>
        </Card>

        {/* Theme toggle */}
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
              Thème
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Slot className="grid grid-cols-2">
              <SlotOption selected={theme === "dark"} onClick={() => setTheme("dark")}>
                <Moon className="size-4" />
                Sombre
              </SlotOption>
              {lightUnlocked ? (
                <SlotOption selected={theme === "light"} onClick={() => setTheme("light")}>
                  <Sun className="size-4" />
                  Clair
                </SlotOption>
              ) : (
                <div
                  aria-disabled="true"
                  className={`flex min-h-10 items-center justify-center gap-2 px-3 text-[13px] font-semibold ${ON_GAP}`}
                >
                  <Lock className="size-3.5" />
                  Clair
                </div>
              )}
            </Slot>
            {!lightUnlocked && (
              <p className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="stamp h-5 px-1 text-[13px]">100</span>
                séances pour gagner le thème clair.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Un titre sous ton nom — gagné au Règne (talent) ou au cabinet */}
        {titles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
                Titre
              </CardTitle>
              <CardAction>
                <span
                  className="stamp h-6 min-w-6 px-1.5 text-[15px]"
                  aria-label={`${titles.length} titres gagnés`}
                  title="Titres gagnés"
                >
                  {titles.length}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Slot className="flex flex-wrap">
                {titles.map((t) => (
                  <SlotOption
                    key={t}
                    selected={profile?.title === t}
                    onClick={() => patch({ title: profile?.title === t ? null : t })}
                  >
                    {t}
                  </SlotOption>
                ))}
              </Slot>
              {profile && (
                <p className="mt-2.5 text-xs leading-snug text-muted-foreground">
                  {profile.title ? (
                    <>
                      <span className="font-semibold text-foreground">« {profile.title} »</span>{" "}
                      s&apos;affiche sous ton nom. Touche-le encore pour le retirer.
                    </>
                  ) : (
                    "Aucun titre porté. Touches-en un pour l'afficher sous ton nom."
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* La Résolution (Keldeo) : l'objectif hebdo */}
        {has("resolution") && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
                Objectif hebdo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Slot className="grid grid-cols-5">
                {[2, 3, 4, 5, 6].map((n) => (
                  <SlotOption
                    key={n}
                    selected={profile?.weeklyGoal === n}
                    onClick={() => patch({ weeklyGoal: profile?.weeklyGoal === n ? null : n })}
                    className="gap-1.5 px-1 font-heading text-[18px] font-bold tabular-nums"
                  >
                    {n}
                  </SlotOption>
                ))}
              </Slot>
              <p className="mt-2.5 text-xs leading-snug text-muted-foreground">
                Séances par semaine — le tableau de marche s&apos;affiche sur l&apos;accueil.
              </p>
            </CardContent>
          </Card>
        )}

        {/* L'Étendard (trophée Porte-Étendard) : une carte en bannière sur la home */}
        {hasFeature("banner") && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
                L&apos;Étendard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-snug text-muted-foreground">
                La carte choisie flotte en bannière sur ta page d&apos;accueil.
                Gagné avec le trophée « Le Porte-Étendard ».
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="lg" onClick={() => setShowBannerPicker(true)}>
                  Choisir la carte
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => patch({ banner: null })}
                  className="text-muted-foreground"
                >
                  Retirer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Le Totem (aura de Typhon) : la carte affichée chez tes amis */}
        {has("totem") && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
                Totem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {profile?.totem?.imageUrl ? (
                  <Image
                    src={profile.totem.imageUrl}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="size-11 object-contain"
                  />
                ) : (
                  <span className="stamp size-11 shrink-0">
                    <Flag className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {profile?.totem?.name ?? "Aucun totem"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Affiché à côté de ton nom chez tes amis
                  </p>
                </div>
                <Button variant="secondary" size="lg" onClick={() => setShowTotemPicker(true)}>
                  Choisir
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Les Trônes : fonds d'écran débloqués */}
        {anyThrone && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className={BLOCK_TITLE}>
                Trônes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(THRONE_OPTIONS) as ("home" | "session" | "collection")[]).map((page) => {
                const options = THRONE_OPTIONS[page].filter((o) => has(o.id));
                if (options.length === 0) return null;
                const active = profile?.wallpapers?.[page] ?? null;
                return (
                  <div key={page}>
                    <p className="etched mb-1.5">{PAGE_LABELS[page]}</p>
                    <Slot className="flex flex-wrap">
                      <SlotOption
                        selected={active === null}
                        onClick={() => patch({ wallpapers: { [page]: null } })}
                      >
                        Aucun
                      </SlotOption>
                      {options.map((o) => (
                        <SlotOption
                          key={o.id}
                          selected={active === o.id}
                          onClick={() => patch({ wallpapers: { [page]: o.id } })}
                        >
                          {o.label}
                        </SlotOption>
                      ))}
                    </Slot>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Le reste : les règles du jeu, et la sortie — retirée du header de
          la home, elle vit ici. */}
      <p className="etched mb-2 mt-8">Le compte</p>
      <div className="plate-stack">
        <Link
          href="/manuel"
          className="plate card-hover group flex items-center gap-3 py-2 pl-2 pr-3"
        >
          <span className="stamp size-10 shrink-0">
            <BookOpen className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[17px] font-bold uppercase leading-tight tracking-[0.04em]">
              Le Manuel
            </p>
            <p className="text-xs text-muted-foreground">Toutes les règles du jeu</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
        <LogoutButton labeled />
      </div>

      {hasFeature("banner") && (
        <MascotPicker
          open={showBannerPicker}
          onOpenChange={setShowBannerPicker}
          exerciseName=""
          title="L'Étendard"
          description="La carte choisie flotte en bannière sur ta page d'accueil."
          current={null}
          onSelect={async (sel: { category: MascotCategory; id: number } | null) => {
            await patch({ banner: sel });
          }}
        />
      )}

      {/* Le Totem réutilise le sélecteur de cartes des mascottes */}
      {has("totem") && (
        <MascotPicker
          open={showTotemPicker}
          onOpenChange={setShowTotemPicker}
          exerciseName=""
          title="Totem"
          description="La carte choisie s'affiche à côté de ton nom chez tes amis."
          current={null}
          onSelect={async (sel: { category: MascotCategory; id: number } | null) => {
            await patch({ totem: sel });
          }}
        />
      )}
    </div>
  );
}
