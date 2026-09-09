"use client";

import { useState } from "react";
import { X, ChevronRight, Spin } from "@/components/icons";
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-30 flex size-10 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
      >
        <X className="size-5" />
      </button>

      <div className="flex w-full max-w-md flex-col items-center gap-8 px-6 py-12">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
            Jeton spécial
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tighter">Tourne la roue</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Convertit ton jeton spécial en {minR} à {maxR} jetons normaux
          </p>
        </div>

        <div className="w-full">
          {phase === "ready" && (
            <div className="flex items-end justify-center gap-3 py-3">
              {segments.map(({ r, pct }) => (
                <div key={r} className="flex flex-col items-center gap-1.5">
                  <JackpotCoin reward={r as 1 | 2 | 3 | 4 | 10} size={72} />
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
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
          <div className="text-center animate-card-reveal">
            <p
              className={`text-5xl font-black tracking-tighter ${
                reward === 4
                  ? "text-amber-300"
                  : reward === 3
                  ? "text-stone-200"
                  : reward === 2
                  ? "text-orange-200"
                  : "text-zinc-300"
              }`}
            >
              ×{reward} jeton{reward > 1 ? "s" : ""}
            </p>
            {reward === 4 && (
              <p className="mt-2 text-xs font-black uppercase tracking-[0.3em] text-amber-300">
                ★ Jackpot ★
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              ajouté{reward > 1 ? "s" : ""} à ton solde de jetons normaux
            </p>
          </div>
        )}

        {error && <p className="text-sm font-bold text-destructive">{error}</p>}

        <Button
          onClick={phase === "result" ? onClose : handleSpin}
          disabled={phase === "spinning"}
          className="h-11 w-full max-w-xs rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black disabled:opacity-100"
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
