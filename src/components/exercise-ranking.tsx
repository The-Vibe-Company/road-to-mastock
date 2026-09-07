"use client";

import { Spinner } from "@/components/spinner";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Dumbbell } from "@/components/icons";

interface RankedExercise {
  id: number;
  name: string;
  kind: "muscu" | "cardio";
  muscleGroups: string[];
  useCount: number;
  setCount: number;
  lastDate: string | null;
}

export function ExerciseRanking() {
  const [exercises, setExercises] = useState<RankedExercise[] | null>(null);

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
          <Spinner />
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

  const maxCount = exercises[0].useCount;

  return (
    <div className="space-y-2">
      {exercises.map((ex, i) => (
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
          </Card>
        </Link>
      ))}
    </div>
  );
}
