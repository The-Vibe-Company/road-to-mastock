"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "@/components/icons";

interface SetRowProps {
  setNumber: number;
  weightKg: number;
  reps: number;
  onDelete?: () => void;
}

export function SetRow({ setNumber, weightKg, reps, onDelete }: SetRowProps) {
  return (
    <div className="flex items-center py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {setNumber}
      </span>
      <div className="flex flex-1 items-center justify-center gap-3">
        <span className="text-base font-black">{weightKg} kg</span>
        <span className="text-sm font-bold text-primary/40">x</span>
        <span className="text-base font-semibold">{reps} reps</span>
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
