"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Palette, Sun, Moon, Crown, Flag, Target, Image as ImageIcon, Lock } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SettingsPage() {
  const { theme, setTheme } = useAccent();
  const { has, profile, refresh } = useTalents();
  const { hasFeature } = useTrophies();
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

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-12 pt-6">
      <div className="mb-6">
        <BackButton className="mb-3" />
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-black tracking-tight">Parametres</h1>
          <Link
            href="/manuel"
            className="mb-0.5 rounded-xl bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
          >
            Le Manuel
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {/* Theme toggle */}
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
              {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  theme === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="size-4" />
                Sombre
              </button>
              {hasFeature("light") ? (
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                    theme === "light"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="size-4" />
                  Clair
                </button>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary/30 px-4 py-2 opacity-60 ring-1 ring-border">
                  <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                    <Lock className="size-3.5" />
                    Clair
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground/70">
                    100 séances
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Color picker */}
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
              <Palette className="size-4" />
              Couleur principale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ColorPicker />
          </CardContent>
        </Card>

        {/* L'Étendard (trophée Porte-Étendard) : une carte en bannière sur la home */}
        {hasFeature("banner") && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Flag className="size-4" />
                L&apos;Étendard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
                La carte choisie flotte en bannière sur ta page d&apos;accueil.
                Gagné avec le trophée « Le Porte-Étendard ».
              </p>
              <button
                onClick={() => setShowBannerPicker(true)}
                className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
              >
                Choisir la carte
              </button>
              <button
                onClick={() => patch({ banner: null })}
                className="ml-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs font-bold text-muted-foreground"
              >
                Retirer
              </button>
            </CardContent>
          </Card>
        )}

        {/* Le Totem (aura de Typhon) : la carte affichée chez tes amis */}
        {has("totem") && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Flag className="size-4" />
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
                  <div className="flex size-11 items-center justify-center rounded-lg bg-secondary/50">
                    <Flag className="size-5 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {profile?.totem?.name ?? "Aucun totem"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Affiché à côté de ton nom chez tes amis
                  </p>
                </div>
                <button
                  onClick={() => setShowTotemPicker(true)}
                  className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
                >
                  Choisir
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Un titre sous ton nom — gagné au Règne (talent) ou au cabinet */}
        {titles.length > 0 && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Crown className="size-4" />
                Titre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {titles.map((t) => (
                  <button
                    key={t}
                    onClick={() => patch({ title: profile?.title === t ? null : t })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      profile?.title === t
                        ? "bg-gradient-orange-intense text-black shadow-lg"
                        : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* La Résolution (Keldeo) : l'objectif hebdo */}
        {has("resolution") && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Target className="size-4" />
                Objectif hebdo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => patch({ weeklyGoal: profile?.weeklyGoal === n ? null : n })}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-all active:scale-95 ${
                      profile?.weeklyGoal === n
                        ? "bg-gradient-orange-intense text-black shadow-lg"
                        : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Séances par semaine — le tableau de marche s&apos;affiche sur l&apos;accueil
              </p>
            </CardContent>
          </Card>
        )}

        {/* Les Trônes : fonds d'écran débloqués */}
        {anyThrone && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <ImageIcon className="size-4" />
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
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {PAGE_LABELS[page]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => patch({ wallpapers: { [page]: null } })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                          active === null
                            ? "bg-gradient-orange-intense text-black shadow-lg"
                            : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        Aucun
                      </button>
                      {options.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => patch({ wallpapers: { [page]: o.id } })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                            active === o.id
                              ? "bg-gradient-orange-intense text-black shadow-lg"
                              : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* La sortie — retirée du header de la home, elle vit ici. */}
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
