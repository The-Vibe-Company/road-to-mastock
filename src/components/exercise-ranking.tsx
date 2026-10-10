"use client";

import { Spinner } from "@/components/spinner";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Dumbbell, Sparkles, Funnel, X } from "@/components/icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    fetch("/api/exercises/frequent?limit=all")
      .then((r) => r.json())
      .then((data) => setExercises(Array.isArray(data) ? data : []))
      .catch(() => setExercises([]));
  }, []);

  if (exercises === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Chargement..." />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="plate flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="stamp size-14">
          <Dumbbell className="size-7" />
        </span>
        <div>
          <p className="font-heading text-xl font-bold uppercase tracking-[0.04em]">Aucun exercice</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
    <div className="space-y-3">
      {/* Le filtre par groupe : une ligne discrète — le tag actif se retire
          d'un tap, l'entonnoir ouvre le tiroir des groupes. */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="font-heading text-[14px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Classement · {shown.length} machine{shown.length !== 1 ? "s" : ""}
          </span>
          {filter && (
            <button
              onClick={() => setFilter(null)}
              aria-label={`Retirer le filtre ${filter}`}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-full bg-secondary pl-2 pr-2.5 font-heading text-[13px] font-bold uppercase tracking-[0.06em] text-foreground transition-colors hover:bg-plate-hover"
            >
              <span aria-hidden className="pin size-2" />
              {filter}
              <X className="size-3" />
            </button>
          )}
          <button
            onClick={() => setShowFilter(true)}
            aria-label="Filtrer par groupe musculaire"
            className={`plate flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-plate-hover hover:text-foreground ${
              filter ? "" : "ml-auto"
            }`}
          >
            <Funnel className="size-3.5" />
          </button>
        </div>
      )}

      <Sheet open={showFilter} onOpenChange={setShowFilter}>
        <SheetContent side="bottom" className="rounded-t-lg">
          <SheetHeader>
            <SheetTitle className="uppercase tracking-[0.04em]">Filtrer par groupe</SheetTitle>
            <SheetDescription className="text-xs">
              Le classement se recalcule dans le groupe choisi.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4 pb-8">
            {[null, ...groups].map((g) => {
              const active = filter === g;
              return (
                <button
                  key={g ?? "tout"}
                  onClick={() => {
                    setFilter(g);
                    setShowFilter(false);
                  }}
                  aria-pressed={active}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius)] px-1 font-heading text-[14px] font-bold uppercase tracking-[0.04em] transition-colors ${
                    active
                      ? "plate text-foreground"
                      : "bg-gap text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {active && <span aria-hidden className="pin size-2" />}
                  <span className="truncate">{g ?? "Tout"}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <div className="plate-stack">
        {shown.map((ex, i) => (
          <Link
            key={ex.id}
            href={`/exercises/${ex.id}`}
            className="plate card-hover group block py-2.5 pl-2 pr-3"
          >
            <div className="flex items-center gap-3">
              <span className="stamp size-10 shrink-0 text-[22px]">{i + 1}</span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{ex.name}</p>
                {ex.muscleGroups.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ex.muscleGroups.map((mg) => (
                      <Badge key={mg} variant="secondary" className="text-[10px]">
                        {mg}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="segments relative mt-2 h-1.5 bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{ width: `${(ex.useCount / maxCount) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-heading text-[20px] font-bold leading-none tabular-nums">
                  {ex.useCount}x
                </span>
                {ex.setCount > 0 && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {ex.setCount} série{ex.setCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>

            {/* Le Gardien en un coup d'œil : qui garde la machine, jusqu'à
                quand, et le prix de la magnésie pour le libérer avant. */}
            {ex.guardian && (
              <div
                className={`ml-[3.25rem] mt-2 flex items-center gap-1.5 rounded-[3px] border ${GUARDIAN_TINT[ex.guardian.rarity].border} bg-gap/70 px-1.5 py-1`}
              >
                {ex.guardian.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.guardian.imageUrl}
                    alt=""
                    className={`size-[18px] shrink-0 rounded-[2px] border ${GUARDIAN_TINT[ex.guardian.rarity].border} object-cover object-top`}
                  />
                )}
                <span
                  className={`truncate text-[11px] font-bold ${GUARDIAN_TINT[ex.guardian.rarity].text}`}
                >
                  {ex.guardian.name}
                </span>
                {ex.guardian.unlockAt ? (
                  <>
                    <span className="ml-auto shrink-0 font-heading text-[12px] font-semibold text-muted-foreground">
                      → {frDate(ex.guardian.unlockAt)}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 rounded-[3px] border border-sky-400/35 bg-sky-500/10 px-1 font-heading text-[12px] font-bold text-sky-300">
                      <Sparkles className="size-2.5" />
                      {ex.guardian.unbindPrice}
                    </span>
                  </>
                ) : (
                  <span className="ml-auto shrink-0 font-heading text-[12px] font-semibold text-muted-foreground">
                    libre
                  </span>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
