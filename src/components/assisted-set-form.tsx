"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "@/components/icons";

export interface AssistedPayload {
  assistanceKg: number;
  reps: number;
}

interface AssistedSetFormProps {
  bodyweightKg: number;
  onAdd: (payload: AssistedPayload) => void | Promise<void>;
  lastAssistance?: number | null;
  lastReps?: number | null;
}

export function AssistedSetForm({ bodyweightKg, onAdd, lastAssistance, lastReps }: AssistedSetFormProps) {
  const [assistance, setAssistance] = useState(lastAssistance != null ? lastAssistance.toString() : "");
  const [reps, setReps] = useState((lastReps ?? 10).toString());
  const [submitting, setSubmitting] = useState(false);
  // Les mots « aide » et « reps » posés dans les champs sont leurs libellés.
  const assistanceId = useId();
  const repsId = useId();

  useEffect(() => {
    if (lastAssistance != null) setAssistance(lastAssistance.toString());
    setReps((lastReps ?? 10).toString());
  }, [lastAssistance, lastReps]);

  const a = parseFloat(assistance);
  const aValid = isFinite(a) && a >= 0;
  const effective = aValid ? Math.max(0, Number((bodyweightKg - a).toFixed(2))) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const r = parseInt(reps);
    if (!aValid || isNaN(r) || r <= 0) return;
    setSubmitting(true);
    try {
      await onAdd({ assistanceKg: a, reps: r });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={assistanceId}
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            placeholder="Aide"
            value={assistance}
            onChange={(e) => setAssistance(e.target.value)}
            className="h-11 bg-secondary/50 pr-12 text-center text-base font-bold"
          />
          <label
            htmlFor={assistanceId}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
          >
            aide
          </label>
        </div>
        <span className="text-lg font-black text-primary/40">x</span>
        <div className="relative flex-1">
          <Input
            id={repsId}
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="0"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-11 bg-secondary/50 pr-10 text-center text-base font-bold"
          />
          <label
            htmlFor={repsId}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
          >
            reps
          </label>
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={submitting || !aValid}
          aria-label="Ajouter la série"
          className="h-11 w-11 shrink-0 rounded-xl bg-gradient-orange-intense text-black shadow-lg disabled:opacity-100"
        >
          {submitting ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={3} />
          ) : (
            <Check className="size-5" strokeWidth={3} />
          )}
        </Button>
      </div>
      <div className="text-center text-[11px] font-bold uppercase tracking-widest text-primary/60">
        {effective != null ? (
          <>
            = <span className="text-primary">{effective}</span> kg soulevés <span className="text-muted-foreground/60">(bw {bodyweightKg} − aide)</span>
          </>
        ) : (
          <>Saisis l&apos;aide pour voir le poids effectif</>
        )}
      </div>
    </form>
  );
}
