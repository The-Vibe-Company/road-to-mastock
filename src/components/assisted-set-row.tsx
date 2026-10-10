"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Minus } from "@/components/icons";

interface AssistedSetRowProps {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  assistanceKg: number | null;
  onDelete?: () => void;
}

export function AssistedSetRow({
  setNumber,
  weightKg,
  reps,
  assistanceKg,
  onDelete,
}: AssistedSetRowProps) {
  return (
    <div className="flex items-center py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {setNumber}
      </span>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="text-base font-black">{weightKg ?? 0} kg</span>
          <span className="text-sm font-bold text-primary/40">x</span>
          <span className="text-base font-semibold">{reps ?? 0} reps</span>
        </div>
        {assistanceKg != null && (
          <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-md bg-secondary/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Minus className="size-2.5" strokeWidth={3} />
            {assistanceKg} kg aide
          </span>
        )}
      </div>
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          aria-label={`Supprimer la série ${setNumber}`}
          className="shrink-0 text-muted-foreground/50 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : (
        <div className="w-6 shrink-0" />
      )}
    </div>
  );
}
