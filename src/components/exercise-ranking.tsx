"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Dumbbell, Sparkles } from "@/components/icons";
import { MUSCLE_GROUPS } from "@/lib/muscle-groups";
import type { Rarity } from "@/lib/rarities";

interface RankedGuardian {
  name: string;
  rarity: Rarity;
  imageUrl: string | null;
  // Null : la carte est libre (grâce ou lien expiré) — sinon la date où
  // le lien se dénoue tout seul.
  unlockAt: string | null;
  unbindPrice: number;
}

interface RankedExercise {
  id: number;
  name: string;
  kind: "muscu" | "cardio";
  muscleGroups: string[];
  useCount: number;
  setCount: number;
  lastDate: string | null;
  guardian: RankedGuardian | null;
}

// Teintes du bandeau gardien, à la rareté de la carte.
const GUARDIAN_TINT: Record<Rarity, { border: string; text: string }> = {
  common: { border: "border-zinc-400/30", text: "text-zinc-300" },
  uncommon: { border: "border-emerald-400/30", text: "text-emerald-300" },
  rare: { border: "border-sky-400/30", text: "text-sky-300" },
  epic: { border: "border-violet-400/35", text: "text-violet-300" },
  legendary: { border: "border-amber-400/40", text: "text-amber-300" },
  mythic: { border: "border-rose-500/45", text: "text-rose-300" },
};

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function ExerciseRanking() {
  const [exercises, setExercises] = useState<RankedExercise[] | null>(null);
  // Le filtre par groupe musculaire — null : tout le classement.
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/exercises/frequent?limit=all")
      .then((r) => r.json())
      .then((data) => setExercises(Array.isArray(data) ? data : []))
      .catch(() => setExercises([]));
  }, []);

  if (exercises === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-primary/60">Chargement...</p>
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Dumbbell className="size-8 text-primary/50" />
        </div>
        <div>
          <p className="font-semibold">Aucun exercice</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fais ta première séance pour voir ton classement
          </p>
        </div>
      </div>
    );
  }

  // Les chips du filtre : seulement les groupes réellement présents dans le
  // classement, dans l'ordre canonique — le cardio matche aussi par kind.
  const inGroup = (ex: RankedExercise, g: string) =>
    ex.muscleGroups.includes(g) || (g === "Cardio" && ex.kind === "cardio");
  const groups = MUSCLE_GROUPS.filter((g) => exercises.some((ex) => inGroup(ex, g)));
  const shown = filter ? exercises.filter((ex) => inGroup(ex, filter)) : exercises;
  // La barre d'usage se recalcule dans le groupe : un classement par famille.
  const maxCount = shown[0]?.useCount ?? 1;

  return (
    <div className="space-y-2">
      {groups.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {[null, ...groups].map((g) => {
            const active = filter === g;
            return (
              <button
                key={g ?? "tout"}
                onClick={() => setFilter(g)}
                className={`shrink-0 rounded-[3px] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                  active
                    ? "bg-gradient-orange-intense text-black shadow-[2px_2px_0_oklch(0_0_0/0.5)]"
                    : "bg-secondary/30 text-muted-foreground ring-1 ring-border hover:text-primary"
                }`}
              >
                {g ?? "Tout"}
              </button>
            );
          })}
        </div>
      )}
      {shown.map((ex, i) => (
        <Link key={ex.id} href={`/exercises/${ex.id}`} className="block">
          <Card className="card-gradient-border card-hover">
            <CardContent className="flex items-center gap-3 py-3">
              <span className="w-6 shrink-0 text-right text-base font-black text-primary/50">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{ex.name}</p>
                {ex.muscleGroups.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ex.muscleGroups.map((mg) => (
                      <Badge key={mg} variant="secondary" className="text-[10px] font-bold">
                        {mg}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-orange"
                    style={{ width: `${(ex.useCount / maxCount) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {ex.useCount}x
                </span>
                {ex.setCount > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {ex.setCount} série{ex.setCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>

            {/* Le Gardien en un coup d'œil : qui garde la machine, jusqu'à
                quand, et le prix de la magnésie pour le libérer avant. */}
            {ex.guardian && (
              <div
                className={`mx-4 -mb-1 -mt-3 flex items-center gap-1.5 rounded-[3px] border ${GUARDIAN_TINT[ex.guardian.rarity].border} bg-black/40 px-1.5 py-0.5`}
              >
                {ex.guardian.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.guardian.imageUrl}
                    alt=""
                    className={`size-[17px] shrink-0 rounded-[2px] border ${GUARDIAN_TINT[ex.guardian.rarity].border} object-cover object-top`}
                  />
                )}
                <span
                  className={`truncate text-[10px] font-black ${GUARDIAN_TINT[ex.guardian.rarity].text}`}
                >
                  {ex.guardian.name}
                </span>
                {ex.guardian.unlockAt ? (
                  <>
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                      → {frDate(ex.guardian.unlockAt)}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 rounded-[3px] border border-sky-400/35 bg-sky-500/10 px-1 font-mono text-[9px] font-black text-sky-300">
                      <Sparkles className="size-2.5" />
                      {ex.guardian.unbindPrice}
                    </span>
                  </>
                ) : (
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                    libre
                  </span>
                )}
              </div>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
