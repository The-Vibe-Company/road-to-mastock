"use client";

import { PowerRules } from "@/components/power-rules";
import { use, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Minus, Trophy, Calendar, Clock, Flame, PawPrint, Plus, Lock, Magnet, ShieldOff, Unlock } from "@/components/icons";
import { BackButton } from "@/components/back-button";
import { WeightSteps } from "@/components/weight-steps";
import { CreatureCard } from "@/components/creature-card";
import { MascotPicker } from "@/components/mascot-picker";
import { Spinner } from "@/components/spinner";
import { useTalents } from "@/components/talents-provider";
import { useTrophies } from "@/components/trophies-provider";
import { RARITY_COLORS, RARITY_LABELS } from "@/lib/rarities";
import { powerLabel } from "@/lib/powers";
import type { Mascot, MascotCategory } from "@/lib/mascot-types";

interface ExerciseInfo {
  id: number;
  name: string;
  kind: "muscu" | "cardio";
  isAssisted: boolean;
  hasVariants?: boolean;
  muscleGroup: string | null;
  muscleGroups: string[];
  mascot: Mascot | null;
  mascotMode?: "attract" | "repel";
  mascotBond?: { locked: boolean; unlockAt: string | null; grace?: boolean };
  unbind?: { price: number; balance: number } | null;
}

interface SetEntry {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  durationMinutes: number | null;
  calories: number | null;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  resistanceLevel: number | null;
  assistanceKg: number | null;
}

interface SessionHistory {
  date: string;
  sessionId: number;
  bodyweightKg: number | null;
  sets: SetEntry[];
}

interface HistoryData {
  exercise: ExerciseInfo;
  history: SessionHistory[];
}

type MuscuTab = "weight" | "volume";
type CardioTab = "calories" | "duration" | "distance";

export default function ExerciseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [muscuTab, setMuscuTab] = useState<MuscuTab>("weight");
  const [cardioTab, setCardioTab] = useState<CardioTab>("calories");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [showMascotPicker, setShowMascotPicker] = useState(false);
  const { has } = useTalents();
  // Le Métronome (50 séances) : la moyenne mobile sur les courbes.
  const { hasFeature } = useTrophies();
  const [smoothed, setSmoothed] = useState(false);
  // Le déliement à la magnésie : requête en cours.
  const [unbinding, setUnbinding] = useState(false);

  useEffect(() => {
    fetch(`/api/exercises/${id}/history`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Chargement..." />
      </div>
    );
  }

  if (!data) return null;

  const { exercise, history } = data;

  // Le PATCH renvoie la mascotte résolue (image, rareté) : on recopie sa
  // réponse plutôt que de deviner, et rien d'autre de la fiche ne bouge.
  // Un 403 = le Gardien lié refuse de partir.
  const handleSelectMascot = async (
    mascot: { category: MascotCategory; id: number } | null,
  ) => {
    const res = await fetch(`/api/exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mascot }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setData((prev) =>
      prev
        ? {
            ...prev,
            exercise: {
              ...prev.exercise,
              mascot: updated.mascot ?? null,
              mascotMode: updated.mascotMode ?? "attract",
              mascotBond: updated.mascotBond ?? prev.exercise.mascotBond,
            },
          }
        : prev,
    );
  };

  // La polarité (cartes sous légendaire) : attirer ou repousser, à volonté.
  const handleUnbind = async () => {
    if (unbinding) return;
    setUnbinding(true);
    try {
      const r = await fetch(`/api/exercises/${id}/unbind`, { method: "POST" });
      if (r.ok) {
        // Recharge la fiche : gardien parti, lien dissous, solde débité.
        const d = await fetch(`/api/exercises/${id}/history`).then((res) => res.json());
        setData(d);
      }
    } finally {
      setUnbinding(false);
    }
  };

  const handleSetMode = async (mode: "attract" | "repel") => {
    setData((prev) =>
      prev ? { ...prev, exercise: { ...prev.exercise, mascotMode: mode } } : prev,
    );
    await fetch(`/api/exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mascotMode: mode }),
    });
  };
  const isCardio = exercise.kind === "cardio";

  const totalSessions = history.length;

  // Aggregate per session
  const muscuChartData = history.map((h) => ({
    date: h.date,
    maxWeight: Math.max(0, ...h.sets.map((s) => s.weightKg ?? 0)),
    totalVolume: h.sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
  }));
  const cardioChartData = history.map((h) => ({
    date: h.date,
    calories: h.sets.reduce((sum, s) => sum + (s.calories ?? 0), 0),
    duration: h.sets.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
    distance: h.sets.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0),
  }));

  const bestWeight = isCardio ? 0 : Math.max(0, ...muscuChartData.map((d) => d.maxWeight));
  const bestDuration = isCardio ? Math.max(0, ...cardioChartData.map((d) => d.duration)) : 0;
  const bestCalories = isCardio ? Math.max(0, ...cardioChartData.map((d) => d.calories)) : 0;

  const cardioHasDistance = isCardio && history.some((h) => h.sets.some((s) => s.distanceKm != null));

  // Build chart values + unit per active tab
  let values: number[] = [];
  let unitLabel = "";
  let chartDates: string[] = [];

  if (isCardio) {
    chartDates = cardioChartData.map((d) => d.date);
    if (cardioTab === "calories") {
      values = cardioChartData.map((d) => d.calories);
      unitLabel = "kcal";
    } else if (cardioTab === "duration") {
      values = cardioChartData.map((d) => d.duration);
      unitLabel = "min";
    } else {
      values = cardioChartData.map((d) => d.distance);
      unitLabel = "km";
    }
  } else {
    chartDates = muscuChartData.map((d) => d.date);
    values = muscuChartData.map((d) => (muscuTab === "weight" ? d.maxWeight : d.totalVolume));
    unitLabel = "kg";
  }

  // La moyenne mobile sur 3 séances : la tendance sans le bruit.
  if (smoothed && hasFeature("smooth") && values.length >= 3) {
    values = values.map((_, i) => {
      const from = Math.max(0, i - 2);
      const window = values.slice(from, i + 1);
      return Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10;
    });
  }

  return (
    <div className="min-h-dvh px-4 pb-8 pt-6">
      <BackButton fallback="/exercises" />

      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">{exercise.name}</h1>
        {exercise.muscleGroups.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exercise.muscleGroups.map((mg) => (
              <Badge key={mg} variant="secondary" className="font-bold">{mg}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Mascotte : purement décoratif. La carte choisie passe en filigrane
          derrière ce bloc pendant les séances. */}
      <Card className="card-gradient-border mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
            <PawPrint className="size-4" />
            Mascotte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exercise.mascot ? (
            <div className="flex items-center gap-4">
              <div className="w-16 shrink-0">
                <CreatureCard
                  name={exercise.mascot.name}
                  rarity={exercise.mascot.rarity}
                  imageUrl={exercise.mascot.imageUrl}
                  number={exercise.mascot.number}
                  category={exercise.mascot.category}
                  size="sm"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    RARITY_COLORS[exercise.mascot.rarity].text
                  }`}
                >
                  {RARITY_LABELS[exercise.mascot.rarity]} ·{" "}
                  {exercise.mascot.category === "animal" ? "Animal" : "Pokémon"}
                </p>
                <p className="mt-0.5 truncate text-base font-black tracking-tight">
                  {exercise.mascot.name}
                </p>
                {(() => {
                  const power = powerLabel(
                    exercise.mascot!.category,
                    exercise.mascot!.rarity,
                    exercise.mascot!.subtype,
                    exercise.mascot!.slug,
                    exercise.mascotMode ?? null,
                  );
                  return power ? (
                    <div className="mt-1">
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        <span className="font-black text-primary/80">{power.name}</span>
                        {" — "}
                        <span className="italic">{power.description}</span>
                      </p>
                      {power.rules && <PowerRules text={power.rules} className="mt-1.5" />}
                    </div>
                  ) : null;
                })()}
                {/* La Polarité : réservée aux cartes sous légendaire —
                    Mew (l'Origine) fait exception, il épouse ta volonté. */}
                {(!["legendary", "mythic"].includes(exercise.mascot.rarity) ||
                  exercise.mascot.slug === "mew") && (
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => handleSetMode("attract")}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                        (exercise.mascotMode ?? "attract") === "attract"
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                          : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <Magnet className="size-3" />
                      Attractif
                    </button>
                    <button
                      onClick={() => handleSetMode("repel")}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                        exercise.mascotMode === "repel"
                          ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/40"
                          : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <ShieldOff className="size-3" />
                      Répulsif
                    </button>
                  </div>
                )}
                {exercise.mascotBond?.locked ? (
                  <div className="mt-1.5">
                    <p className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400/90">
                      <Lock className="size-3" />
                      Gardien lié — libre le{" "}
                      {exercise.mascotBond.unlockAt
                        ? new Date(exercise.mascotBond.unlockAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                        : "..."}
                    </p>
                    {/* La Magnésie : payer pour délier sans attendre */}
                    {exercise.unbind && (
                      <button
                        onClick={handleUnbind}
                        disabled={unbinding || exercise.unbind.balance < exercise.unbind.price}
                        className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider ring-1 transition-all active:scale-95 ${
                          exercise.unbind.balance >= exercise.unbind.price
                            ? "bg-sky-500/15 text-sky-300 ring-sky-500/40"
                            : "bg-secondary/40 text-muted-foreground ring-border opacity-60"
                        }`}
                      >
                        <Unlock className="size-3" />
                        {unbinding
                          ? "Déliement..."
                          : `Délier — ${exercise.unbind.price} magnésie (tu en as ${exercise.unbind.balance})`}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {exercise.mascotBond?.grace && (
                      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                        Libre jusqu&apos;à son premier éveil — ensuite la carte
                        sera <span className="font-bold text-amber-400/90">liée</span>{" "}
                        jusqu&apos;au{" "}
                        <span className="font-bold text-foreground">
                          {exercise.mascotBond.unlockAt
                            ? new Date(exercise.mascotBond.unlockAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                            : "..."}
                        </span>
                        .
                      </p>
                    )}
                    <button
                      onClick={() => setShowMascotPicker(true)}
                      className="mt-1.5 block text-[11px] font-bold text-muted-foreground transition-colors hover:text-primary"
                    >
                      Changer la carte
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowMascotPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-secondary/30 py-4 text-sm font-bold text-primary transition-all active:scale-[0.98] hover:bg-primary/10"
            >
              <Plus className="size-4" strokeWidth={3} />
              Associer une carte
            </button>
          )}
        </CardContent>
      </Card>

      <MascotPicker
        exerciseId={Number(id)}
        blockPostedElsewhere
        open={showMascotPicker}
        onOpenChange={setShowMascotPicker}
        exerciseName={exercise.name}
        current={exercise.mascot}
        onSelect={handleSelectMascot}
      />

      {/* Paliers : uniquement pour la muscu classique — en cardio il n'y a pas
          de poids, et en assiste le poids est derive du poids de corps. */}
      {!isCardio && !exercise.isAssisted && (
        <WeightSteps exerciseId={exercise.id} hasVariants={exercise.hasVariants ?? false} />
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {isCardio ? (
          <>
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <Flame className="size-5 text-primary" />
                <p className="text-4xl font-black tracking-tighter text-primary">
                  {bestCalories > 0 ? `${bestCalories}` : "-"}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Max kcal</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <Clock className="size-5 text-muted-foreground" />
                <p className="text-4xl font-black tracking-tighter">
                  {bestDuration > 0 ? `${bestDuration}` : "-"}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Max min</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <Trophy className="size-5 text-primary" />
                <p className="text-4xl font-black tracking-tighter text-primary">
                  {bestWeight > 0 ? `${bestWeight}` : "-"}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Max (kg)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <Calendar className="size-5 text-muted-foreground" />
                <p className="text-4xl font-black tracking-tighter">{totalSessions}</p>
                <p className="text-xs font-medium text-muted-foreground">Séances</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Le Scanner (Genesect) : max estimé + vitesse de progression */}
      {has("scanner") && !isCardio && history.length >= 2 && (() => {
        // 1RM estimé (formule d'Epley) sur la meilleure série de chaque séance.
        const e1rm = (w: number, r: number) => w * (1 + r / 30);
        const perSession = history.map((h) => ({
          date: h.date,
          best: Math.max(
            0,
            ...h.sets
              .filter((st) => st.weightKg != null && st.reps != null)
              .map((st) => e1rm(st.weightKg!, st.reps!)),
          ),
        })).filter((x) => x.best > 0);
        if (perSession.length < 2) return null;
        const current = perSession[perSession.length - 1].best;
        const best = Math.max(...perSession.map((x) => x.best));
        // Pente sur les 5 dernières séances, ramenée au mois.
        const recent = perSession.slice(-5);
        const t0 = new Date(recent[0].date).getTime();
        const t1 = new Date(recent[recent.length - 1].date).getTime();
        const days = Math.max(1, (t1 - t0) / 86400000);
        const perMonth = ((recent[recent.length - 1].best - recent[0].best) / days) * 30;
        return (
          <Card className="card-gradient-border mb-6">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
                Le Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-black text-primary">{Math.round(current)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">1RM estimé</p>
                </div>
                <div>
                  <p className="text-2xl font-black">{Math.round(best)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">1RM record</p>
                </div>
                <div>
                  <p className={`text-2xl font-black ${perMonth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {perMonth >= 0 ? "+" : ""}{perMonth.toFixed(1)}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">kg / mois</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Chart */}
      {history.length > 1 && values.some((v) => v > 0) && (() => {
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        const range = maxVal - minVal || 1;
        const W = 320;
        const H = 160;
        const padX = 0;
        const padY = 16;
        const graphW = W - padX * 2;
        const graphH = H - padY * 2;

        const points = values.map((v, i) => ({
          x: padX + (i / (values.length - 1)) * graphW,
          y: padY + graphH - ((v - minVal) / range) * graphH,
          value: v,
          date: chartDates[i],
        }));

        const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

        return (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2 rounded-xl bg-secondary/50 p-1">
                {hasFeature("smooth") && (
                  <button
                    onClick={() => setSmoothed((v) => !v)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                      smoothed
                        ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Lissé
                  </button>
                )}
                {isCardio ? (
                  <>
                    <button
                      onClick={() => setCardioTab("calories")}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        cardioTab === "calories"
                          ? "bg-gradient-orange-intense text-black shadow-lg"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Calories
                    </button>
                    <button
                      onClick={() => setCardioTab("duration")}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        cardioTab === "duration"
                          ? "bg-gradient-orange-intense text-black shadow-lg"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Durée
                    </button>
                    {cardioHasDistance && (
                      <button
                        onClick={() => setCardioTab("distance")}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          cardioTab === "distance"
                            ? "bg-gradient-orange-intense text-black shadow-lg"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Distance
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setMuscuTab("weight")}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        muscuTab === "weight"
                          ? "bg-gradient-orange-intense text-black shadow-lg"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Poids max
                    </button>
                    <button
                      onClick={() => setMuscuTab("volume")}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        muscuTab === "volume"
                          ? "bg-gradient-orange-intense text-black shadow-lg"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Volume total
                    </button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-hidden" onMouseLeave={() => setHoveredPoint(null)} onTouchEnd={() => setHoveredPoint(null)}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-gradient-mid)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--accent-gradient-mid)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#chartGrad)" />
                  <path d={linePath} fill="none" style={{ stroke: "var(--accent-gradient-mid)" }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {hoveredPoint !== null && (
                    <line
                      x1={points[hoveredPoint].x}
                      y1={padY}
                      x2={points[hoveredPoint].x}
                      y2={H}
                      style={{ stroke: "var(--accent-gradient-mid)" }}
                      strokeWidth="1"
                      strokeDasharray="4 3"
                      opacity="0.4"
                    />
                  )}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={hoveredPoint === i ? 6 : i === points.length - 1 ? 5 : 3}
                        style={{
                          fill: hoveredPoint === i || i === points.length - 1 ? "var(--accent-gradient-mid)" : "oklch(0.15 0 0)",
                          stroke: "var(--accent-gradient-mid)",
                        }}
                        strokeWidth={hoveredPoint === i || i === points.length - 1 ? 0 : 1.5}
                        className="transition-all duration-150"
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={16}
                        fill="transparent"
                        onMouseEnter={() => setHoveredPoint(i)}
                        onTouchStart={() => setHoveredPoint(i)}
                        style={{ cursor: "pointer" }}
                      />
                    </g>
                  ))}
                </svg>

                {hoveredPoint !== null && (() => {
                  const p = points[hoveredPoint];
                  const pctX = (p.x / W) * 100;
                  const dateStr = new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
                  const valNum = unitLabel === "km" ? Number(p.value.toFixed(1)) : Math.round(p.value);
                  const val = `${valNum} ${unitLabel}`;
                  const isLeft = pctX < 15;
                  const isRight = pctX > 85;
                  return (
                    <div
                      className="pointer-events-none absolute top-2 z-10"
                      style={{
                        left: `${pctX}%`,
                        transform: isLeft ? "translateX(0%)" : isRight ? "translateX(-100%)" : "translateX(-50%)",
                      }}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-primary/30 bg-card/95 px-3 py-1.5 shadow-xl backdrop-blur-sm">
                        <span className="text-xs font-black text-primary">{val}</span>
                        <span className="text-[10px] font-medium text-muted-foreground capitalize">{dateStr}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>{new Date(chartDates[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                <span>{new Date(chartDates[chartDates.length - 1]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              </div>

              <div className="mt-2 flex justify-center gap-4 text-[10px] text-muted-foreground">
                <span>
                  Min: <span className="font-bold text-foreground">{unitLabel === "km" ? Number(minVal.toFixed(1)) : Math.round(minVal)} {unitLabel}</span>
                </span>
                <span>
                  Max: <span className="font-bold text-primary">{unitLabel === "km" ? Number(maxVal.toFixed(1)) : Math.round(maxVal)} {unitLabel}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* History */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Minus className="size-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Aucune donnée pour cet exercice
          </p>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-primary/60">
            Historique
          </h2>
          <div className="space-y-3">
            {[...history].reverse().map((h) => {
              const d = new Date(h.date);
              if (isCardio) {
                const totalDur = h.sets.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
                const totalCal = h.sets.reduce((sum, s) => sum + (s.calories ?? 0), 0);
                return (
                  <Card key={h.sessionId}>
                    <CardContent>
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="font-bold capitalize">
                          {d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                        </p>
                        <div className="flex gap-1.5">
                          {totalDur > 0 && (
                            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                              {totalDur} min
                            </span>
                          )}
                          {totalCal > 0 && (
                            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                              {totalCal} kcal
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {h.sets.map((s) => (
                          <div key={s.setNumber} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                              {s.setNumber}
                            </span>
                            {s.durationMinutes != null && (
                              <span className="text-sm font-bold">{s.durationMinutes}<span className="ml-0.5 text-xs text-muted-foreground">min</span></span>
                            )}
                            {s.calories != null && (
                              <span className="text-sm font-semibold text-foreground/80">{s.calories}<span className="ml-0.5 text-xs text-muted-foreground">kcal</span></span>
                            )}
                            {s.distanceKm != null && (
                              <span className="text-sm font-semibold text-foreground/80">{s.distanceKm}<span className="ml-0.5 text-xs text-muted-foreground">km</span></span>
                            )}
                            {s.avgSpeedKmh != null && (
                              <span className="text-sm font-semibold text-foreground/80">{s.avgSpeedKmh}<span className="ml-0.5 text-xs text-muted-foreground">km/h</span></span>
                            )}
                            {s.resistanceLevel != null && (
                              <span className="text-sm font-semibold text-foreground/80">niv. {s.resistanceLevel}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              const vol = h.sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
              return (
                <Card key={h.sessionId}>
                  <CardContent>
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold capitalize">
                          {d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                        </p>
                        {exercise.isAssisted && h.bodyweightKg != null && (
                          <span className="rounded-md bg-secondary/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            bw {h.bodyweightKg} kg
                          </span>
                        )}
                      </div>
                      <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        {Math.round(vol)} kg vol.
                      </span>
                    </div>
                    <div className="space-y-1">
                      {h.sets.map((s) => (
                        <div key={s.setNumber} className="flex items-center gap-3">
                          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                            {s.setNumber}
                          </span>
                          <span className="text-base font-black">{s.weightKg ?? 0} kg</span>
                          <span className="text-sm font-bold text-primary/40">x</span>
                          <span className="text-base font-semibold">{s.reps ?? 0}</span>
                          {exercise.isAssisted && s.assistanceKg != null && (
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              −{s.assistanceKg} aide
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
