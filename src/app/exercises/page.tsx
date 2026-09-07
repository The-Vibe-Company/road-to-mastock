"use client";

import { Spinner } from "@/components/spinner";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, Plus, Pencil, Check, X } from "@/components/icons";
import { BackButton } from "@/components/back-button";
import { MUSCLE_GROUPS } from "@/lib/muscle-groups";
import type { Mascot } from "@/lib/mascot-types";

interface Exercise {
  id: number;
  name: string;
  muscleGroup: string | null;
  muscleGroups: string[];
  mascot: Mascot | null;
}

export default function ExerciseCatalog() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscles, setNewMuscles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMuscles, setEditMuscles] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then((data) => {
        setExercises(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), muscleGroups: newMuscles }),
    });
    setCreating(false);
    setNewName("");
    setNewMuscles([]);
    setShowCreate(false);
    refresh();
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim() || savingEdit) return;
    setSavingEdit(true);
    await fetch(`/api/exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        muscleGroups: editMuscles,
      }),
    });
    setSavingEdit(false);
    setEditingId(null);
    setEditName("");
    setEditMuscles([]);
    refresh();
  };

  const startEdit = (ex: Exercise) => {
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditMuscles(ex.muscleGroups);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditMuscles([]);
  };

  const toggleNew = (mg: string) => {
    setNewMuscles((prev) =>
      prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]
    );
  };

  const toggleEdit = (mg: string) => {
    setEditMuscles((prev) =>
      prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]
    );
  };

  const grouped: Record<string, Exercise[]> = {};
  for (const ex of exercises) {
    const tags = ex.muscleGroups.length > 0 ? ex.muscleGroups : ["Autre"];
    for (const key of tags) {
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ex);
    }
  }
  // Sort groups alphabetically, and exercises within each group
  const sortedGroups = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([key, exs]) => [key, exs.sort((a, b) => a.name.localeCompare(b.name, "fr"))] as const);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 pb-8 pt-6">
      <BackButton />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Catalogue</h1>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="h-10 bg-gradient-orange-intense px-4 font-bold text-black"
        >
          <Plus className="size-4" strokeWidth={3} />
          Créer
        </Button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-secondary/30 p-4">
          <p className="mb-3 text-sm font-bold">Nouvel exercice</p>
          <Input
            placeholder="Nom de l'exercice"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mb-3 h-11 bg-secondary/50 font-medium"
            autoFocus
          />
          <p className="mb-2 text-xs font-bold text-muted-foreground">Muscles ciblés</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((mg) => (
              <button
                key={mg}
                onClick={() => toggleNew(mg)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                  newMuscles.includes(mg)
                    ? "bg-gradient-orange-intense text-black shadow-lg"
                    : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                }`}
              >
                {mg}
              </button>
            ))}
          </div>
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="h-11 w-full bg-gradient-orange-intense font-bold text-black"
          >
            {creating ? "Création..." : "Ajouter"}
          </Button>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Aucun exercice. Clique sur Créer pour commencer.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([muscleGroup, exs]) => (
            <Card key={muscleGroup}>
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
                  {muscleGroup}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {exs.map((ex) => {
                  const primaryGroup = ex.muscleGroups[0] ?? "Autre";
                  const isEditing = editingId === ex.id;
                  if (isEditing && primaryGroup !== muscleGroup) {
                    return (
                      <div
                        key={`${muscleGroup}-${ex.id}`}
                        className="rounded-xl px-3 py-3 text-xs italic text-muted-foreground"
                      >
                        {ex.name} — modification en cours dans {primaryGroup}…
                      </div>
                    );
                  }
                  return (
                  <div key={`${muscleGroup}-${ex.id}`}>
                    {isEditing ? (
                      <form
                        className="space-y-3 rounded-xl border border-primary/20 bg-secondary/30 p-3"
                        onSubmit={(e) => { e.preventDefault(); handleSaveEdit(ex.id); }}
                      >
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nom de l'exercice"
                          className="h-10 bg-secondary/50 font-bold"
                          autoFocus
                        />
                        <div>
                          <p className="mb-2 text-xs font-bold text-muted-foreground">Muscles ciblés</p>
                          <div className="flex flex-wrap gap-1.5">
                            {MUSCLE_GROUPS.map((mg) => (
                              <button
                                key={mg}
                                type="button"
                                onClick={() => toggleEdit(mg)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                                  editMuscles.includes(mg)
                                    ? "bg-gradient-orange-intense text-black shadow-lg"
                                    : "bg-secondary/50 text-muted-foreground hover:bg-accent"
                                }`}
                              >
                                {mg}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            disabled={!editName.trim() || savingEdit}
                            className="h-10 flex-1 bg-gradient-orange-intense font-bold text-black"
                          >
                            <Check className="size-4" strokeWidth={3} />
                            {savingEdit ? "..." : "Enregistrer"}
                          </Button>
                          <Button
                            type="button"
                            onClick={cancelEdit}
                            variant="ghost"
                            className="h-10 px-4 font-bold"
                          >
                            <X className="size-4" />
                            Annuler
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/exercises/${ex.id}`}
                          className="flex flex-1 items-center justify-between gap-2 rounded-xl px-3 py-3 transition-all hover:bg-accent active:scale-[0.97]"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ex.mascot?.imageUrl && (
                              <Image
                                src={ex.mascot.imageUrl}
                                alt=""
                                width={28}
                                height={28}
                                unoptimized
                                className="size-7 shrink-0 object-contain"
                              />
                            )}
                            <p className="font-bold">{ex.name}</p>
                            {ex.muscleGroups
                              .filter((mg) => mg !== muscleGroup)
                              .map((mg) => (
                                <Badge key={mg} variant="outline" className="text-[10px]">{mg}</Badge>
                              ))}
                          </div>
                          <ChevronRight className="size-4 text-primary/40" />
                        </Link>
                        <button
                          onClick={() => startEdit(ex)}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
