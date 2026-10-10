"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Clock, Flame, Route, Gauge, BarChart3 } from "@/components/icons";

export interface CardioSetData {
  setNumber: number;
  durationMinutes: number | null;
  calories: number | null;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  resistanceLevel: number | null;
}

interface CardioSetRowProps extends CardioSetData {
  onDelete?: () => void;
}

export function CardioSetRow({
  setNumber,
  durationMinutes,
  calories,
  distanceKm,
  avgSpeedKmh,
  resistanceLevel,
  onDelete,
}: CardioSetRowProps) {
  return (
    <div className="flex items-start gap-2 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {setNumber}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {durationMinutes != null && (
          <span className="flex items-center gap-1 text-base font-black">
            <Clock className="size-3.5 text-primary/60" />
            {durationMinutes}
            <span className="text-xs font-medium text-muted-foreground">min</span>
          </span>
        )}
        {calories != null && (
          <span className="flex items-center gap-1 text-sm font-bold text-primary/80">
            <Flame className="size-3.5 text-primary/60" />
            {calories}
            <span className="text-xs font-medium text-muted-foreground">kcal</span>
          </span>
        )}
        {distanceKm != null && (
          <span className="flex items-center gap-1 text-sm font-bold text-foreground/80">
            <Route className="size-3.5 text-primary/60" />
            {distanceKm}
            <span className="text-xs font-medium text-muted-foreground">km</span>
          </span>
        )}
        {avgSpeedKmh != null && (
          <span className="flex items-center gap-1 text-sm font-bold text-foreground/80">
            <Gauge className="size-3.5 text-primary/60" />
            {avgSpeedKmh}
            <span className="text-xs font-medium text-muted-foreground">km/h</span>
          </span>
        )}
        {resistanceLevel != null && (
          <span className="flex items-center gap-1 text-sm font-bold text-foreground/80">
            <BarChart3 className="size-3.5 text-primary/60" />
            niv.&nbsp;{resistanceLevel}
          </span>
        )}
      </div>
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          aria-label={`Supprimer la série ${setNumber}`}
          className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : (
        <div className="w-6 shrink-0" />
      )}
    </div>
  );
}
