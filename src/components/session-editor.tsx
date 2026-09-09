"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ExercisePicker } from "./exercise-picker";
import { ExerciseBlock } from "./exercise-block";
import { DatePicker } from "./date-picker";
import { BodyweightPicker } from "./bodyweight-picker";
import { TerminateSessionButton } from "./terminate-session-button";
import { Plus, Trash2, Dumbbell, Activity, Weight, Layers, CalendarDays, Loader2, Scale } from "@/components/icons";
import { BackButton } from "./back-button";
import { ThroneBackdrop } from "./throne-backdrop";
import { Spinner } from "./spinner";
import type { CardioPayload } from "./cardio-set-form";
import type { AssistedPayload } from "./assisted-set-form";
import type { Mascot } from "@/lib/mascot-types";

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

interface SessionExercise {
  sessionExerciseId: number;
  exerciseId: number;
  name: string;
  kind: "muscu" | "cardio";
  isAssisted: boolean;
  muscleGroup: string | null;
  muscleGroups: string[];
  mascot: Mascot | null;
  hasVariants: boolean;
  variantId: number | null;
  variantName: string | null;
  locked: boolean;
  notes: string | null;
  record: number | null;
  lastPerf: LastPerf | null;
  knownWeights: number[];
  sets: ExerciseSet[];
}

interface SessionData {
  id: number;
  date: string;
  bodyweightKg: number | null;
  exercises: SessionExercise[];
}

export function SessionEditor({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBodyweightPicker, setShowBodyweightPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const pendingScrollRef = useRef<number | null>(null);

  const refreshSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    setSession(data);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const id = pendingScrollRef.current;
    if (id === null) return;
    pendingScrollRef.current = null;
    document
      .querySelector(`[data-session-exercise-id="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [session]);

  const handleSelectExercise = async (
    exercise: {
      id: number;
      name: string;
      muscleGroup: string | null;
      muscleGroups: string[];
    },
    variantId: number | null,
  ) => {
    const res = await fetch("/api/session-exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, exerciseId: exercise.id, variantId }),
    });
    const created = res.ok ? await res.json() : null;
    // Le nouvel exercice est ajoute en bas de liste, souvent hors ecran : on
    // memorise son id pour aller le chercher une fois qu'il est monte.
    pendingScrollRef.current = created?.id ?? null;
    await refreshSession();
    setShowPicker(false);
  };

  const handleAddSet = async (
    sessionExerciseId: number,
    weightKg: number,
    reps: number
  ) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.sessionExerciseId === sessionExerciseId
            ? {
                ...ex,
                sets: [
                  ...ex.sets,
                  {
                    id: Date.now(),
                    setNumber: ex.sets.length + 1,
                    weightKg,
                    reps,
                    durationMinutes: null,
                    calories: null,
                    distanceKm: null,
                    avgSpeedKmh: null,
                    resistanceLevel: null,
                    assistanceKg: null,
                  },
                ],
              }
            : ex
        ),
      };
    });
    await fetch("/api/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionExerciseId, weightKg, reps }),
    });
    refreshSession();
  };

  const handleAddAssistedSet = async (
    sessionExerciseId: number,
    payload: AssistedPayload,
  ) => {
    const bw = session?.bodyweightKg ?? null;
    const effective = bw != null ? Math.max(0, Number((bw - payload.assistanceKg).toFixed(2))) : null;
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.sessionExerciseId === sessionExerciseId
            ? {
                ...ex,
                sets: [
                  ...ex.sets,
                  {
                    id: Date.now(),
                    setNumber: ex.sets.length + 1,
                    weightKg: effective,
                    reps: payload.reps,
                    durationMinutes: null,
                    calories: null,
                    distanceKm: null,
                    avgSpeedKmh: null,
                    resistanceLevel: null,
                    assistanceKg: payload.assistanceKg,
                  },
                ],
              }
            : ex
        ),
      };
    });
    await fetch("/api/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionExerciseId, ...payload }),
    });
    refreshSession();
  };

  const handleBodyweightChange = async (kg: number) => {
    setSession((prev) => (prev ? { ...prev, bodyweightKg: kg } : prev));
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyweightKg: kg }),
    });
    refreshSession();
  };

  const handleAddCardioSet = async (
    sessionExerciseId: number,
    payload: CardioPayload,
  ) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.sessionExerciseId === sessionExerciseId
            ? {
                ...ex,
                sets: [
                  ...ex.sets,
                  {
                    id: Date.now(),
                    setNumber: ex.sets.length + 1,
                    weightKg: null,
                    reps: null,
                    assistanceKg: null,
                    ...payload,
                  },
                ],
              }
            : ex
        ),
      };
    });
    await fetch("/api/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionExerciseId, ...payload }),
    });
    refreshSession();
  };

  const handleDeleteSet = async (setId: number) => {
    // Optimistic: remove set locally
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.filter((s) => s.id !== setId),
        })),
      };
    });
    await fetch(`/api/sets/${setId}`, { method: "DELETE" });
    refreshSession();
  };

  const handleRemoveExercise = async (sessionExerciseId: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, exercises: prev.exercises.filter((ex) => ex.sessionExerciseId !== sessionExerciseId) };
    });
    await fetch(`/api/session-exercises/${sessionExerciseId}`, { method: "DELETE" });
    refreshSession();
  };

  const handleToggleLock = async (sessionExerciseId: number, locked: boolean) => {
    // Optimistic: toggle lock locally
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.sessionExerciseId === sessionExerciseId ? { ...ex, locked } : ex
        ),
      };
    });
    fetch(`/api/session-exercises/${sessionExerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    });
  };

  // Changer la salle d'un exercice deja fait : records, paliers et derniere
  // perf de ce bloc basculent sur la nouvelle version.
  const handleChangeVariant = async (
    sessionExerciseId: number,
    variantId: number | null,
  ) => {
    await fetch(`/api/session-exercises/${sessionExerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId }),
    });
    await refreshSession();
  };

  const handleUpdateNotes = async (sessionExerciseId: number, notes: string) => {
    fetch(`/api/session-exercises/${sessionExerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null }),
    });
  };

  const handleMoveExercise = async (index: number, direction: "up" | "down") => {
    if (!session) return;
    const exs = session.exercises || [];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= exs.length) return;

    // Optimistic: swap locally
    const newExercises = [...exs];
    const tmp = newExercises[index];
    newExercises[index] = newExercises[swapIndex];
    newExercises[swapIndex] = tmp;
    setSession((prev) => prev ? { ...prev, exercises: newExercises } : prev);

    await Promise.all([
      fetch(`/api/session-exercises/${exs[index].sessionExerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapIndex }),
      }),
      fetch(`/api/session-exercises/${exs[swapIndex].sessionExerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: index }),
      }),
    ]);
  };

  const [deletingSession, setDeletingSession] = useState(false);
  const handleDeleteSession = async () => {
    if (deletingSession) return;
    if (!confirm("Supprimer cette séance ?")) return;
    setDeletingSession(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        setDeletingSession(false);
        return;
      }
      router.push("/");
    } catch {
      setDeletingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Chargement..." />
      </div>
    );
  }

  if (!session) return null;

  const exercises = session.exercises || [];
  const date = new Date(session.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleDateChange = async (newDate: string) => {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate }),
    });
    await refreshSession();
  };

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolume = exercises.reduce(
    (sum, ex) =>
      ex.kind === "cardio"
        ? sum
        : sum + ex.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
    0
  );
  const totalCardioMinutes = exercises.reduce(
    (sum, ex) =>
      ex.kind === "cardio"
        ? sum + ex.sets.reduce((s, set) => s + (set.durationMinutes ?? 0), 0)
        : sum,
    0
  );

  return (
    <div className="relative flex min-h-dvh flex-col px-4 pb-24 pt-6">
      <ThroneBackdrop page="session" />
      {/* Header */}
      <div className="mb-6">
        <BackButton fallback="/?tab=sessions" className="mb-3" />
        <div className="relative">
          <button
            type="button"
            className="group flex items-center gap-2 text-left"
            onClick={() => setShowDatePicker(true)}
          >
            <h1 className="text-2xl font-black capitalize tracking-tight">
              {date}
            </h1>
            <CalendarDays className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </button>
          <DatePicker
            value={session.date}
            onChange={handleDateChange}
            open={showDatePicker}
            onOpenChange={setShowDatePicker}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowBodyweightPicker(true)}
          className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
            session.bodyweightKg != null
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20"
          }`}
        >
          <Scale className="size-3.5" />
          {session.bodyweightKg != null ? `${session.bodyweightKg} kg` : "Pèse-toi"}
        </button>
        {exercises.length > 0 && (
          <div className="mt-3 flex gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
              <Activity className="size-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">
                {exercises.length} exercice{exercises.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
              <Layers className="size-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">
                {totalSets} série{totalSets !== 1 ? "s" : ""}
              </span>
            </div>
            {totalVolume > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
                <Weight className="size-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">
                  {Math.round(totalVolume)} kg
                </span>
              </div>
            )}
            {totalCardioMinutes > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
                <Activity className="size-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">
                  {totalCardioMinutes} min cardio
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <TerminateSessionButton sessionId={sessionId} />

      {/* Exercises */}
      {exercises.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <Dumbbell className="size-8 text-primary/50" />
          </div>
          <div>
            <p className="font-semibold">Aucun exercice</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ajoute un exercice pour commencer
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {exercises.map((ex, i) => (
            <div
              key={ex.sessionExerciseId}
              data-session-exercise-id={ex.sessionExerciseId}
            >
              <ExerciseBlock
                sessionExerciseId={ex.sessionExerciseId}
                exerciseId={ex.exerciseId}
                name={ex.name}
                kind={ex.kind}
                isAssisted={ex.isAssisted}
                bodyweightKg={session.bodyweightKg}
                onRequestBodyweight={() => setShowBodyweightPicker(true)}
                muscleGroups={ex.muscleGroups}
                mascot={ex.mascot}
                hasVariants={ex.hasVariants}
                variantId={ex.variantId}
                variantName={ex.variantName}
                onChangeVariant={handleChangeVariant}
                locked={ex.locked}
                notes={ex.notes}
                record={ex.record}
                lastPerf={ex.lastPerf}
                knownWeights={ex.knownWeights}
                sets={ex.sets}
                onAddSet={handleAddSet}
                onAddCardioSet={handleAddCardioSet}
                onAddAssistedSet={handleAddAssistedSet}
                onDeleteSet={handleDeleteSet}
                onRemoveExercise={handleRemoveExercise}
                onToggleLock={handleToggleLock}
                onUpdateNotes={handleUpdateNotes}
                canMoveUp={i > 0}
                canMoveDown={i < exercises.length - 1}
                onMoveUp={() => handleMoveExercise(i, "up")}
                onMoveDown={() => handleMoveExercise(i, "down")}
                onRefresh={refreshSession}
              />
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary/10 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="outline"
            className="flex-1 h-12 border-primary/30 text-base font-bold text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="size-5" strokeWidth={3} />
            Exercice
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12"
            onClick={handleDeleteSession}
            disabled={deletingSession}
          >
            {deletingSession ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Trash2 className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Picker */}
      <ExercisePicker
        open={showPicker}
        onOpenChange={setShowPicker}
        onSelect={handleSelectExercise}
      />

      <BodyweightPicker
        open={showBodyweightPicker}
        onOpenChange={setShowBodyweightPicker}
        value={session.bodyweightKg}
        onChange={handleBodyweightChange}
      />
    </div>
  );
}
