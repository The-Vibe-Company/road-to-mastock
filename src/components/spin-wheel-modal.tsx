"use client";

import { useState } from "react";
import { X, ChevronRight, Spin, Star } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SlotReel } from "@/components/slot-reel";
import { JackpotCoin } from "@/components/emblems/jackpot-coin";

interface SpinResponse {
  reward: number;
  tokens: number;
  specialTokens: number;
}

const COIN_ITEMS = [
  { key: "1", render: () => <JackpotCoin reward={1} size={120} /> },
  { key: "2", render: () => <JackpotCoin reward={2} size={120} /> },
  { key: "3", render: () => <JackpotCoin reward={3} size={120} /> },
  { key: "4", render: () => <JackpotCoin reward={4} size={120} /> },
  { key: "10", render: () => <JackpotCoin reward={10} size={120} /> },
];

export function SpinWheelModal({
  onClose,
  onAfterSpin,
  wheel,
}: {
  onClose: () => void;
  onAfterSpin?: () => void;
  // Les VRAIS segments du moment (reward → %), depuis /api/cards — les
  // sorts des Gardiens transforment la roue, la modale doit le montrer.
  wheel?: Record<string, number>;
}) {
  const [phase, setPhase] = useState<"ready" | "spinning" | "result">("ready");
  // À défaut d'odds (vieux appelant), la roue de base.
  const segments = Object.entries(wheel ?? { "1": 20, "2": 60, "3": 19, "4": 1 })
    .map(([r, pct]) => ({ r: Number(r), pct }))
    .filter((s) => s.pct > 0)
    .sort((a, b) => a.r - b.r);
  const minR = segments[0]?.r ?? 1;
  const maxR = segments[segments.length - 1]?.r ?? 4;
  // Le rouleau ne fait défiler que les pièces réellement en jeu — le ×10
  // n'apparaît que si un sort (Qilin) l'a mis sur la roue.
  const reelItems = COIN_ITEMS.filter((c) => segments.some((s) => String(s.r) === c.key));
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSpin = async () => {
    if (phase !== "ready") return;
    setPhase("spinning");
    setError(null);
    try {
      const r = await fetch("/api/cards/spin", { method: "POST" });
      if (!r.ok) {
        const e = await r.json();
        setError(e.error || "Erreur");
        setPhase("ready");
        return;
      }
      const data: SpinResponse = await r.json();
      setReward(data.reward);
    } catch {
      setError("Erreur réseau");
      setPhase("ready");
    }
  };

  return (
    <div className="scrim fixed inset-0 z-[100] flex overflow-y-auto sm:p-6">
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="plate fixed right-4 top-4 z-30 flex size-10 items-center justify-center text-muted-foreground transition-colors hover:bg-plate-hover hover:text-foreground"
      >
        <X className="size-5" />
      </button>

      <div className="relative m-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 bg-background px-6 py-14 shadow-[inset_0_1px_0_var(--plate-edge),0_24px_60px_-20px_oklch(0_0_0/0.8)] sm:min-h-0 sm:rounded-xl">
        <div className="text-center">
          <p className="etched inline-flex items-center gap-1.5">
            <Star className="size-3.5 text-amber-600 dark:text-amber-300" strokeWidth={2.5} />
            Jeton spécial
          </p>
          <h2 className="mt-1.5 text-4xl uppercase leading-none">Tourne la roue</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Convertit ton jeton spécial en {minR} à {maxR} jetons normaux
          </p>
        </div>

        <div className="w-full">
          {phase === "ready" && (
            <div className="plate flex items-end justify-center gap-3 px-3 py-4">
              {segments.map(({ r, pct }) => (
                <div key={r} className="flex flex-col items-center gap-2">
                  <JackpotCoin reward={r as 1 | 2 | 3 | 4 | 10} size={72} />
                  <span className="stamp h-6 min-w-10 px-1.5 text-[14px]">{pct}%</span>
                </div>
              ))}
            </div>
          )}
          {phase !== "ready" && reward !== null && (
            <SlotReel
              items={reelItems.length > 0 ? reelItems : COIN_ITEMS}
              targetKey={String(reward)}
              itemWidth={144}
              duration={3400}
              loops={5}
              onSettle={() => {
                setPhase("result");
                onAfterSpin?.();
              }}
            />
          )}
        </div>

        {phase === "result" && reward !== null && (
          <div className="flex flex-col items-center text-center animate-card-reveal">
            {reward === 4 && (
              <p className="etched mb-2 inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <Star className="size-3.5" strokeWidth={2.5} />
                Jackpot
                <Star className="size-3.5" strokeWidth={2.5} />
              </p>
            )}
            <p className="flex items-center gap-3">
              <span className="stamp h-16 min-w-16 px-3 text-[48px]">×{reward}</span>
              <span className="text-4xl uppercase leading-none">jeton{reward > 1 ? "s" : ""}</span>
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              ajouté{reward > 1 ? "s" : ""} à ton solde de jetons normaux
            </p>
          </div>
        )}

        {error && <p className="text-sm font-bold text-destructive">{error}</p>}

        <Button
          onClick={phase === "result" ? onClose : handleSpin}
          disabled={phase === "spinning"}
          className="h-12 w-full max-w-xs gap-2 rounded-full bg-gradient-orange-intense font-heading text-[18px] font-bold uppercase tracking-[0.06em] text-primary-foreground disabled:opacity-100"
        >
          {phase === "ready" && (
            <>
              <Spin className="size-4" />
              Tourner la roue
            </>
          )}
          {phase === "spinning" && (
            <>
              <ChevronRight className="size-4" />
              Roule...
            </>
          )}
          {phase === "result" && "Continuer"}
        </Button>
      </div>
    </div>
  );
}
