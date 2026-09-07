"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SetForm } from "./set-form";
import { SetRow } from "./set-row";
import { CardioSetForm, type CardioPayload } from "./cardio-set-form";
import { CardioSetRow } from "./cardio-set-row";
import { AssistedSetForm, type AssistedPayload } from "./assisted-set-form";
import { AssistedSetRow } from "./assisted-set-row";
import { RestTimer } from "./rest-timer";
import { Lock, Unlock, Trophy, ChevronUp, ChevronDown, StickyNote, Check, Trash2, History, Loader2, AlertTriangle, MapPin, ListOrdered, Shield } from "@/components/icons";
import { cardioMachineFromName } from "@/lib/cardio";
import { computeSessionPlan } from "@/lib/session-plan";
import { MascotBackdrop } from "./mascot-backdrop";
import type { Mascot } from "@/lib/mascot-types";
import { powerLabel, powerShorts } from "@/lib/powers";
import { RARITY_COLORS, type Rarity } from "@/lib/rarities";

interface ExerciseSet {
  id: number;
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

interface LastPerf {
  date: string;
  position: number;
  totalExercises: number;
  sets: { weightKg: number; reps: number }[];
}

interface ExerciseBlockProps {
  sessionExerciseId: number;
  exerciseId: number;
  name: string;
  kind: "muscu" | "cardio";
  isAssisted: boolean;
  bodyweightKg: number | null;
  onRequestBodyweight?: () => void;
  muscleGroups: string[];
  // Carte associée à la machine — décor uniquement, aucune incidence sur les
  // séries. Null tant que rien n'a été associé depuis la fiche de l'exercice.
  mascot?: Mascot | null;
  hasVariants?: boolean;
  variantId?: number | null;
  variantName?: string | null;
  onChangeVariant?: (
    sessionExerciseId: number,
    variantId: number | null,
  ) => void | Promise<void>;
  locked: boolean;
  notes: string | null;
  record: number | null;
  lastPerf: LastPerf | null;
  knownWeights: number[];
  sets: ExerciseSet[];
  onAddSet: (sessionExerciseId: number, weightKg: number, reps: number) => void | Promise<void>;
  onAddCardioSet?: (sessionExerciseId: number, payload: CardioPayload) => void | Promise<void>;
  onAddAssistedSet?: (sessionExerciseId: number, payload: AssistedPayload) => void | Promise<void>;
  onDeleteSet: (setId: number) => void | Promise<void>;
  onRemoveExercise: (sessionExerciseId: number) => void | Promise<void>;
  onToggleLock: (sessionExerciseId: number, locked: boolean) => void;
  onUpdateNotes: (sessionExerciseId: number, notes: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  // Rafraîchit la séance après un ajout de palier depuis le plan du jour.
  onRefresh?: () => void | Promise<void>;
}

// "exercice" est masculin : 1er, puis 2e, 3e...
function ordinal(n: number): string {
  return n === 1 ? "1ᵉʳ" : `${n}ᵉ`;
}

function formatLastPerfDate(raw: string): string {
  return new Date(raw).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Ecart en jours pleins, calcule sur les dates locales pour ne pas etre
// fausse par l'heure stockee avec la date.
function daysAgo(raw: string): number {
  const then = new Date(raw);
  const now = new Date();
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86400000);
}

const recordStyles: Record<number, { badge: string; label: string }> = {
  1: { badge: "bg-yellow-500/15 text-yellow-500", label: "Record" },
  2: { badge: "bg-gray-400/15 text-gray-400", label: "2e" },
  3: { badge: "bg-amber-700/15 text-amber-700", label: "3e" },
};

// Le cadre du bloc suit la carte gardienne, pas le podium : l'aura de la
// rareté (voir globals.css). Sans gardien — ou commun — le bloc reste banal.
const ringStyles: Record<Rarity, string> = {
  common: "card-gradient-border",
  uncommon: "card-ring-uncommon",
  rare: "card-ring-rare",
  epic: "card-ring-epic",
  legendary: "card-ring-legendary",
  mythic: "card-ring-mythic",
};

export function ExerciseBlock({
  sessionExerciseId,
  exerciseId,
  name,
  kind,
  isAssisted,
  bodyweightKg,
  onRequestBodyweight,
  muscleGroups,
  mascot,
  hasVariants,
  variantId,
  variantName,
  onChangeVariant,
  locked,
  notes,
  record,
  lastPerf,
  knownWeights,
  sets,
  onAddSet,
  onAddCardioSet,
  onAddAssistedSet,
  onDeleteSet,
  onRemoveExercise,
  onToggleLock,
  onUpdateNotes,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRefresh,
}: ExerciseBlockProps) {
  const isCardio = kind === "cardio";
  const cardioMachine = isCardio ? cardioMachineFromName(name) : null;
  const lastSet = sets[sets.length - 1];
  const totalVolume = isCardio
    ? 0
    : sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const totalDuration = isCardio
    ? sets.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
    : 0;
  const totalCalories = isCardio
    ? sets.reduce((sum, s) => sum + (s.calories ?? 0), 0)
    : 0;
  const medal = !isCardio && record && record <= 3 ? recordStyles[record] : null;
  const [applyToken, setApplyToken] = useState(0);
  const [showVariants, setShowVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<{ id: number; name: string }[]>([]);
  const [variantBusy, setVariantBusy] = useState(false);
  const [newVariant, setNewVariant] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [savedNotes, setSavedNotes] = useState(notes || "");
  const [showTimer, setShowTimer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSetId, setDeleteSetId] = useState<number | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  const [deletingExercise, setDeletingExercise] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesVisible = !!savedNotes || showNotes;

  // La salle reste modifiable meme sur une seance passee ou cloturee : on
  // corrige souvent apres coup, ou on retiquette d'anciennes seances apres
  // avoir declare ses salles.
  const openVariants = async () => {
    if (showVariants) return setShowVariants(false);
    setShowVariants(true);
    const res = await fetch(`/api/exercises/${exerciseId}/variants`);
    const data = res.ok ? await res.json() : [];
    setVariantOptions(Array.isArray(data) ? data : []);
  };

  const pickVariant = async (id: number | null) => {
    if (!onChangeVariant || variantBusy) return;
    setVariantBusy(true);
    try {
      await onChangeVariant(sessionExerciseId, id);
      setShowVariants(false);
    } finally {
      setVariantBusy(false);
    }
  };

  const createAndPickVariant = async () => {
    const name = newVariant.trim();
    if (!name || variantBusy) return;
    setVariantBusy(true);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const created = res.ok ? await res.json() : null;
      setNewVariant("");
      if (created?.id) {
        await onChangeVariant?.(sessionExerciseId, created.id);
        setShowVariants(false);
      }
    } finally {
      setVariantBusy(false);
    }
  };

  // Programme du jour, déduit des paliers et de la dernière séance faite.
  // Pas pour le cardio (pas de poids) ni pour l'assisté (poids dérivé du corps).
  const plan = useMemo(
    () =>
      isCardio || isAssisted
        ? null
        : computeSessionPlan(knownWeights, lastPerf?.sets ?? null),
    [isCardio, isAssisted, knownWeights, lastPerf],
  );
  // Si une série enregistrée s'écarte du programme, on cesse de prescrire :
  // continuer à proposer plan[i] serait faux, et barrer plan[0] comme « fait »
  // alors qu'un autre poids a été soulevé serait mensonger.
  const onPlan =
    plan !== null &&
    sets.every(
      // Tolérance : les poids sont stockés en float4 côté base, la valeur
      // optimiste vient du JS. Une comparaison stricte ferait clignoter le
      // bandeau en « Hors plan » le temps du rafraîchissement.
      (s, i) =>
        i >= plan.weights.length ||
        Math.abs((s.weightKg ?? 0) - plan.weights[i]) < 0.01,
    );
  const plannedWeight =
    plan && onPlan && sets.length < plan.weights.length
      ? plan.weights[sets.length]
      : undefined;

  const handleAddSet = async (w: number, r: number) => {
    await onAddSet(sessionExerciseId, w, r);
    setShowTimer(true);
  };

  const handleAddCardioSet = async (payload: CardioPayload) => {
    if (!onAddCardioSet) return;
    await onAddCardioSet(sessionExerciseId, payload);
  };

  const handleAddAssistedSet = async (payload: AssistedPayload) => {
    if (!onAddAssistedSet) return;
    await onAddAssistedSet(sessionExerciseId, payload);
    setShowTimer(true);
  };

  const handleConfirmDeleteSet = async () => {
    if (deleteSetId === null || deletingSet) return;
    setDeletingSet(true);
    try {
      await onDeleteSet(deleteSetId);
      setDeleteSetId(null);
    } finally {
      setDeletingSet(false);
    }
  };

  const handleConfirmDeleteExercise = async () => {
    if (deletingExercise) return;
    setDeletingExercise(true);
    try {
      await onRemoveExercise(sessionExerciseId);
    } finally {
      setDeletingExercise(false);
    }
  };

  return (
    <Card
      className={`relative ${mascot ? ringStyles[mascot.rarity] : "card-gradient-border"} ${
        locked ? "opacity-70" : ""
      }`}
    >
      {/* Le filigrane est un frère absolu placé en premier : header et content
          sont positionnés à leur tour, donc l'ordre du DOM suffit à les peindre
          par-dessus, sans z-index. */}
      {mascot?.imageUrl && (
        <MascotBackdrop
          imageUrl={mascot.imageUrl}
          rarity={mascot.rarity}
          evolved={mascot.evolved}
        />
      )}
      <CardHeader className="relative">
        <div>
          <Link href={`/exercises/${exerciseId}`} className="transition-colors hover:text-primary">
            <CardTitle className="text-base font-black tracking-tight">{name}</CardTitle>
          </Link>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* L'impact du Gardien, en petit : on sait ce que la carte
                rapportera à la clôture, sans ouvrir sa fiche. */}
            {mascot && (
              <Badge
                variant="outline"
                className={`border-transparent text-[10px] font-bold ring-1 ${RARITY_COLORS[mascot.rarity].bg} ${RARITY_COLORS[mascot.rarity].text} ${RARITY_COLORS[mascot.rarity].ring}`}
              >
                <Shield className="mr-1 size-3" />
                {mascot.rarity === "legendary" || mascot.rarity === "mythic"
                  ? powerLabel(mascot.category, mascot.rarity, mascot.subtype, mascot.slug).name
                  : powerShorts(mascot.category, mascot.subtype, mascot.rarity).tiny}
              </Badge>
            )}
            {medal && (
              <Badge className={`${medal.badge} text-[10px] font-bold`}>
                <Trophy className="mr-1 size-3" />
                {medal.label}
              </Badge>
            )}
            {muscleGroups.map((mg) => (
              <Badge key={mg} variant="secondary" className="text-[10px] font-bold">{mg}</Badge>
            ))}
            {hasVariants && (
              <button
                onClick={openVariants}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all active:scale-95 ${
                  variantName
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-secondary/50 text-muted-foreground ring-1 ring-primary/30 hover:text-primary"
                }`}
              >
                <MapPin className="size-3" />
                {variantName ?? "Salle ?"}
              </button>
            )}
            {!isCardio && totalVolume > 0 && (
              <Badge variant="outline" className="border-primary/20 text-[10px] text-primary">
                {Math.round(totalVolume)} kg vol.
              </Badge>
            )}
            {isCardio && totalDuration > 0 && (
              <Badge variant="outline" className="border-primary/20 text-[10px] text-primary">
                {totalDuration} min
              </Badge>
            )}
            {isCardio && totalCalories > 0 && (
              <Badge variant="outline" className="border-primary/20 text-[10px] text-primary">
                {totalCalories} kcal
              </Badge>
            )}
            {locked && (
              <Badge variant="outline" className="border-muted-foreground/20 text-[10px] text-muted-foreground">
                Termine
              </Badge>
            )}
          </div>
        </div>
        <CardAction className="flex gap-1">
          {!locked && canMoveUp && (
            <button onClick={onMoveUp} className="flex size-10 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground transition-colors active:scale-95 hover:text-primary">
              <ChevronUp className="size-5" />
            </button>
          )}
          {!locked && canMoveDown && (
            <button onClick={onMoveDown} className="flex size-10 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground transition-colors active:scale-95 hover:text-primary">
              <ChevronDown className="size-5" />
            </button>
          )}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`flex size-10 items-center justify-center rounded-xl transition-colors active:scale-95 ${
              savedNotes ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-primary"
            }`}
          >
            <StickyNote className="size-5" />
          </button>
          <button
            onClick={() => onToggleLock(sessionExerciseId, !locked)}
            className={`flex size-10 items-center justify-center rounded-xl transition-colors active:scale-95 ${
              locked ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-primary"
            }`}
          >
            {locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </button>
          {!locked && (
            <button onClick={() => setShowDeleteConfirm(true)} className="flex size-10 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground transition-colors active:scale-95 hover:text-red-500">
              <Trash2 className="size-5" />
            </button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="relative">
        {/* Notes */}
        {showVariants && (
          <div className="mb-3 rounded-xl border border-primary/20 bg-secondary/30 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary/50">
              Salle de cette séance
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {variantOptions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => pickVariant(v.id)}
                  disabled={variantBusy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                    variantId === v.id
                      ? "bg-gradient-orange-intense text-black shadow-lg"
                      : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {v.name}
                </button>
              ))}
              <button
                onClick={() => pickVariant(null)}
                disabled={variantBusy}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                  variantId == null
                    ? "bg-gradient-orange-intense text-black shadow-lg"
                    : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                }`}
              >
                Aucune
              </button>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createAndPickVariant();
              }}
            >
              <input
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                placeholder="Nouvelle salle"
                className="h-9 flex-1 rounded-lg bg-secondary/50 px-3 text-xs font-medium outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={!newVariant.trim() || variantBusy}
                className="rounded-lg bg-secondary px-3 text-xs font-bold disabled:opacity-50"
              >
                Ajouter
              </button>
            </form>
          </div>
        )}

        {notesVisible && (
          <div className="mb-3 flex gap-2">
            <textarea
              ref={notesRef}
              defaultValue={savedNotes}
              placeholder="Notes..."
              className="flex-1 resize-none rounded-lg bg-secondary/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              rows={2}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              className="mt-1 shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => {
                const val = notesRef.current?.value || "";
                onUpdateNotes(sessionExerciseId, val);
                setSavedNotes(val);
                if (!val) setShowNotes(false);
              }}
            >
              <Check className="size-4" />
            </Button>
          </div>
        )}

        {/* Programme du jour — muscu non assistée, dès qu'on a assez de paliers */}
        {plan && !locked && (
          <div className="mb-3 rounded-lg border border-l-2 border-primary/10 border-l-primary/50 bg-primary/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <ListOrdered className="size-3 shrink-0 text-primary/40" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40">
                Plan du jour · kg
              </span>
              <span className="ml-auto text-[10px] font-bold text-primary/50">
                {!onPlan
                  ? "Hors plan"
                  : `${plan.pattern === "ascendant" ? "Montée" : "Pyramide"}${
                      plan.shifted ? " · +1 palier" : ""
                    }`}
              </span>
            </div>
            {plan.atCeiling && onPlan && (
              <form
                className="mt-2 flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const kg = Number(newStep.replace(",", "."));
                  if (!Number.isFinite(kg) || kg <= 0 || addingStep) return;
                  setAddingStep(true);
                  try {
                    await fetch(`/api/exercises/${exerciseId}/weights`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ weightKg: kg, variantId: variantId ?? null }),
                    });
                    setNewStep("");
                    await onRefresh?.();
                  } finally {
                    setAddingStep(false);
                  }
                }}
              >
                <p className="text-[10px] font-medium leading-snug text-muted-foreground">
                  Palier au-dessus de{" "}
                  <span className="font-black text-primary">
                    {Math.max(...knownWeights)} kg
                  </span>{" "}
                  ?
                </p>
                <input
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  inputMode="decimal"
                  placeholder="kg"
                  className="h-8 w-16 rounded-lg bg-secondary/50 px-2 text-center font-mono text-xs font-black outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={!newStep.trim() || addingStep}
                  className="rounded-lg bg-gradient-orange-intense px-2.5 py-1.5 text-[10px] font-black uppercase text-black disabled:opacity-50"
                >
                  {addingStep ? "..." : "Ajouter"}
                </button>
              </form>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {plan.weights.map((w, i) => {
                const done = onPlan && i < sets.length;
                const current = onPlan && i === sets.length;
                return (
                  <span
                    key={i}
                    className={`rounded-md px-2 py-1 text-xs font-black tabular-nums ${
                      done
                        ? "bg-secondary/40 text-muted-foreground line-through"
                        : current
                          ? "bg-gradient-orange-intense text-black shadow-lg"
                          : "bg-secondary/50 text-primary/70"
                    }`}
                  >
                    {w}
                  </span>
                );
              })}
              {plannedWeight != null && (
                <button
                  type="button"
                  onClick={() => setApplyToken((n) => n + 1)}
                  className="ml-auto rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary/60 transition-colors hover:text-primary active:scale-95"
                >
                  Appliquer
                </button>
              )}
            </div>
          </div>
        )}

        {/* Last performance — muscu only */}
        {!isCardio && !locked && lastPerf && lastPerf.sets.length > 0 && (
          <div className="mb-3 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5">
            <div className="mb-2">
              <div className="flex items-center gap-1.5">
                <History className="size-3 shrink-0 text-primary/40" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40">
                  Derniere perf
                </span>
                <span className="ml-auto text-[10px] font-bold text-primary/50">
                  {formatLastPerfDate(lastPerf.date)}
                </span>
              </div>
              <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                {ordinal(lastPerf.position)} exercice sur {lastPerf.totalExercises}
                {(() => {
                  const d = daysAgo(lastPerf.date);
                  if (d <= 0) return null;
                  return ` \u00b7 il y a ${d} jour${d > 1 ? "s" : ""}`;
                })()}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {lastPerf.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 text-right text-[10px] font-bold text-primary/30">{i + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-primary/70">{s.weightKg}</span>
                    <span className="text-[10px] text-muted-foreground">kg</span>
                    <span className="text-xs text-primary/25">x</span>
                    <span className="text-sm font-black text-primary/70">{s.reps}</span>
                    <span className="text-[10px] text-muted-foreground">reps</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sets.length > 0 && (
          <div className={!locked ? "mb-3 border-b border-border/50 pb-2" : ""}>
            {sets.map((s) =>
              isCardio ? (
                <CardioSetRow
                  key={s.id}
                  setNumber={s.setNumber}
                  durationMinutes={s.durationMinutes}
                  calories={s.calories}
                  distanceKm={s.distanceKm}
                  avgSpeedKmh={s.avgSpeedKmh}
                  resistanceLevel={s.resistanceLevel}
                  onDelete={locked ? undefined : () => setDeleteSetId(s.id)}
                />
              ) : isAssisted ? (
                <AssistedSetRow
                  key={s.id}
                  setNumber={s.setNumber}
                  weightKg={s.weightKg}
                  reps={s.reps}
                  assistanceKg={s.assistanceKg}
                  onDelete={locked ? undefined : () => setDeleteSetId(s.id)}
                />
              ) : (
                <SetRow
                  key={s.id}
                  setNumber={s.setNumber}
                  weightKg={s.weightKg ?? 0}
                  reps={s.reps ?? 0}
                  onDelete={locked ? undefined : () => setDeleteSetId(s.id)}
                />
              ),
            )}
          </div>
        )}

        {/* Delete set confirmation */}
        {deleteSetId !== null && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3">
            <p className="mb-2.5 text-center text-sm font-bold">Supprimer cette serie ?</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10 border-primary/30 text-sm font-bold"
                onClick={() => setDeleteSetId(null)}
                disabled={deletingSet}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-10 text-sm font-bold"
                onClick={handleConfirmDeleteSet}
                disabled={deletingSet}
              >
                {deletingSet ? <Loader2 className="size-4 animate-spin" /> : "Supprimer"}
              </Button>
            </div>
          </div>
        )}

        {/* Rest timer (muscu only) */}
        {!isCardio && !locked && showTimer && (
          <div className="mb-3">
            <RestTimer onDismiss={() => setShowTimer(false)} />
          </div>
        )}

        {!locked && !isCardio && !isAssisted && (
          <SetForm
            onAdd={handleAddSet}
            lastWeight={lastSet?.weightKg ?? undefined}
            lastReps={lastSet?.reps ?? undefined}
            defaultReps={name.toLowerCase().includes("marteau") ? 20 : 10}
            knownWeights={knownWeights}
            plannedWeight={plannedWeight}
            applyToken={applyToken}
          />
        )}

        {!locked && isCardio && cardioMachine && (
          <CardioSetForm
            machine={cardioMachine}
            onAdd={handleAddCardioSet}
            lastDuration={lastSet?.durationMinutes ?? null}
            lastResistance={lastSet?.resistanceLevel ?? null}
          />
        )}

        {!locked && isAssisted && (
          bodyweightKg != null ? (
            <AssistedSetForm
              bodyweightKg={bodyweightKg}
              onAdd={handleAddAssistedSet}
              lastAssistance={lastSet?.assistanceKg ?? null}
              lastReps={lastSet?.reps ?? null}
            />
          ) : (
            <button
              type="button"
              onClick={() => onRequestBodyweight?.()}
              className="flex w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-left text-sm font-bold text-primary transition-all active:scale-[0.98]"
            >
              <AlertTriangle className="size-4" />
              Renseigne ton poids de corps pour calculer le poids soulevé
            </button>
          )
        )}
      </CardContent>

      {/* Delete exercise confirmation */}
      {showDeleteConfirm && (
        <div className="relative border-t border-border/50 px-4 py-3">
          <p className="mb-3 text-center text-sm font-bold">
            Supprimer {name} ?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10 border-primary/30 text-sm font-bold"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deletingExercise}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-10 text-sm font-bold"
              onClick={handleConfirmDeleteExercise}
              disabled={deletingExercise}
            >
              {deletingExercise ? <Loader2 className="size-4 animate-spin" /> : "Supprimer"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
