"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "@/components/icons";

interface BodyweightPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number | null;
  onChange: (kg: number) => void | Promise<void>;
}

export function BodyweightPicker({ open, onOpenChange, value, onChange }: BodyweightPickerProps) {
  const [draft, setDraft] = useState<string>(value?.toString() ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDraft(value?.toString() ?? "");
  }, [open, value]);

  const handleSave = async () => {
    const n = parseFloat(draft);
    if (!isFinite(n) || n <= 0 || submitting) return;
    setSubmitting(true);
    try {
      await onChange(n);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-2 border-t-primary/20">
        <SheetHeader>
          <SheetTitle className="text-xl font-black tracking-tight">
            Poids de corps
          </SheetTitle>
          <SheetDescription className="text-sm font-medium text-muted-foreground">
            Sert au calcul des exos assistés (tractions, dips…). Auto-prérempli pour la prochaine séance.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-6">
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="300"
              autoFocus
              placeholder="0"
              aria-label="Poids de corps en kg"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-14 bg-secondary/50 pr-12 text-center text-2xl font-black"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              kg
            </span>
          </div>
          <Button
            onClick={handleSave}
            disabled={submitting || !draft}
            className="h-12 w-full bg-gradient-orange-intense font-bold text-black shadow-lg disabled:opacity-100"
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" strokeWidth={3} />
            ) : (
              <>
                <Check className="size-5" strokeWidth={3} />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
