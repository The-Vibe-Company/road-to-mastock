import { db } from "@/lib/db";
import { sessions, sessionExercises, sets, exercises, exerciseVariants, exerciseWeights } from "@/lib/db/schema";
import { eq, and, sql, inArray, asc } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { resolveMuscleGroups } from "@/lib/muscle-groups";
import { loadMascotsByExercise, loadMascotsFromSnapshots } from "@/lib/mascots";
import { pendingCardioDraws } from "@/lib/guardians";
import { revalidatePath } from "next/cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sessionId = parseInt(id);

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, auth.userId)));

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const exercisesWithSets = await db
    .select({
      sessionExerciseId: sessionExercises.id,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      kind: exercises.kind,
      isAssisted: exercises.isAssisted,
      muscleGroup: exercises.muscleGroup,
      muscleGroups: exercises.muscleGroups,
      hasVariants: exercises.hasVariants,
      variantId: sessionExercises.variantId,
      variantName: exerciseVariants.name,
      sortOrder: sessionExercises.sortOrder,
      locked: sessionExercises.locked,
      guardianCategory: sessionExercises.guardianCategory,
      guardianCardId: sessionExercises.guardianCardId,
      notes: sessionExercises.notes,
      setId: sets.id,
      setNumber: sets.setNumber,
      weightKg: sets.weightKg,
      reps: sets.reps,
      durationMinutes: sets.durationMinutes,
      calories: sets.calories,
      distanceKm: sets.distanceKm,
      avgSpeedKmh: sets.avgSpeedKmh,
      resistanceLevel: sets.resistanceLevel,
      assistanceKg: sets.assistanceKg,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .leftJoin(exerciseVariants, eq(sessionExercises.variantId, exerciseVariants.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(sessionExercises.sortOrder, sets.setNumber);

  type SetEntry = {
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
  };

  const grouped = new Map<
    number,
    {
      sessionExerciseId: number;
      exerciseId: number;
      name: string;
      kind: string;
      isAssisted: boolean;
      muscleGroup: string | null;
      muscleGroups: string[];
      hasVariants: boolean;
      variantId: number | null;
      variantName: string | null;
      sortOrder: number;
      locked: boolean;
      notes: string | null;
      guardianCategory: string | null;
      guardianCardId: number | null;
      sets: SetEntry[];
    }
  >();

  for (const row of exercisesWithSets) {
    if (!grouped.has(row.sessionExerciseId)) {
      const groups = resolveMuscleGroups(row.muscleGroups, row.muscleGroup);
      grouped.set(row.sessionExerciseId, {
        sessionExerciseId: row.sessionExerciseId,
        exerciseId: row.exerciseId,
        name: row.exerciseName,
        kind: row.kind ?? "muscu",
        isAssisted: row.isAssisted ?? false,
        muscleGroup: groups[0] ?? null,
        muscleGroups: groups,
        hasVariants: row.hasVariants ?? false,
        variantId: row.variantId ?? null,
        variantName: row.variantName ?? null,
        sortOrder: row.sortOrder ?? 0,
        locked: row.locked,
        notes: row.notes,
        guardianCategory: row.guardianCategory ?? null,
        guardianCardId: row.guardianCardId ?? null,
        sets: [],
      });
    }
    if (row.setId) {
      grouped.get(row.sessionExerciseId)!.sets.push({
        id: row.setId,
        setNumber: row.setNumber!,
        weightKg: row.weightKg,
        reps: row.reps,
        durationMinutes: row.durationMinutes,
        calories: row.calories,
        distanceKm: row.distanceKm,
        avgSpeedKmh: row.avgSpeedKmh,
        resistanceLevel: row.resistanceLevel,
        assistanceKg: row.assistanceKg,
      });
    }
  }

  const exerciseList = [...grouped.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const exerciseIds = [...new Set(exerciseList.map((e) => e.exerciseId))];
  // Records, paliers et derniere perf se calculent par (exercice, version) :
  // les plaques d'une salle ne valent pas pour une autre.
  const variantKey = (exerciseId: number, variantId: number | null) =>
    `${exerciseId}:${variantId ?? 0}`;
  const muscuPairs = [
    ...new Map(
      exerciseList
        .filter((e) => e.kind !== "cardio")
        .map((e) => [
          variantKey(e.exerciseId, e.variantId),
          { exerciseId: e.exerciseId, variantId: e.variantId },
        ]),
    ).values(),
  ];

  // Fetch last session's sets for each muscu exercise (previous performance).
  // Cardio doesn't surface a "last perf" panel.
  const lastPerf: Record<
    string,
    {
      date: string;
      // Rang de l'exercice dans la seance precedente (1 = premier fait) et
      // nombre total d'exercices de cette seance : "3e sur 6".
      position: number;
      totalExercises: number;
      sets: { weightKg: number; reps: number }[];
    }
  > = {};

  if (muscuPairs.length > 0) {
    const lastPerfRows = (await db.execute(sql`
      WITH wanted(exercise_id, variant_id) AS (
        VALUES ${sql.join(
          muscuPairs.map(
            (p) => sql`(${p.exerciseId}::int, ${p.variantId}::int)`,
          ),
          sql`, `,
        )}
      ),
      last_se AS (
        SELECT DISTINCT ON (se.exercise_id, se.variant_id)
          se.id AS se_id,
          se.exercise_id,
          se.variant_id,
          se.session_id,
          se.sort_order,
          s.date
        FROM session_exercises se
        JOIN sessions s ON s.id = se.session_id
        -- IS NOT DISTINCT FROM : NULL (exercice sans version) doit matcher NULL.
        JOIN wanted w ON w.exercise_id = se.exercise_id
                     AND se.variant_id IS NOT DISTINCT FROM w.variant_id
        WHERE s.user_id = ${auth.userId}
          AND se.session_id != ${sessionId}
          -- Derniere seance ou l'exercice a vraiment ete FAIT : sans ce filtre,
          -- un exercice ajoute puis laisse vide effacait la derniere perf.
          AND EXISTS (
            SELECT 1 FROM sets st2
            WHERE st2.session_exercise_id = se.id
              AND st2.weight_kg IS NOT NULL
          )
        ORDER BY se.exercise_id, se.variant_id, s.date DESC, s.created_at DESC
      ),
      pos AS (
        SELECT
          lse.exercise_id,
          lse.variant_id,
          (
            SELECT COUNT(*) FROM session_exercises se2
            WHERE se2.session_id = lse.session_id
              AND (COALESCE(se2.sort_order, 0), se2.id)
                  <= (COALESCE(lse.sort_order, 0), lse.se_id)
          )::int AS position,
          (
            SELECT COUNT(*) FROM session_exercises se3
            WHERE se3.session_id = lse.session_id
          )::int AS total_exercises
        FROM last_se lse
      )
      SELECT
        lse.exercise_id,
        lse.variant_id,
        lse.date,
        p.position,
        p.total_exercises,
        st.weight_kg,
        st.reps,
        st.set_number
      FROM last_se lse
      JOIN pos p ON p.exercise_id = lse.exercise_id
                AND p.variant_id IS NOT DISTINCT FROM lse.variant_id
      JOIN sets st ON st.session_exercise_id = lse.se_id
      WHERE st.weight_kg IS NOT NULL
      ORDER BY lse.exercise_id, st.set_number
    `)) as unknown as { rows?: any[] };

    const rows = (lastPerfRows.rows ?? lastPerfRows) as unknown as {
      exercise_id: number; variant_id: number | null; date: string;
      position: number; total_exercises: number;
      weight_kg: number; reps: number; set_number: number;
    }[];

    for (const row of rows) {
      const key = variantKey(row.exercise_id, row.variant_id);
      if (!lastPerf[key]) {
        lastPerf[key] = {
          date: row.date,
          position: Number(row.position),
          totalExercises: Number(row.total_exercises),
          sets: [],
        };
      }
      lastPerf[key].sets.push({
        weightKg: Number(row.weight_kg),
        reps: Number(row.reps),
      });
    }
  }

  // Compute rankings for each exercise (max weight & total volume across all user sessions)
  const rankings: Record<number, { weightRank: number | null; volumeRank: number | null }> = {};

  if (exerciseIds.length > 0) {
    const rankRows = (await db.execute(sql`
      WITH exercise_stats AS (
        SELECT
          se.id AS se_id,
          se.exercise_id,
          se.variant_id,
          COALESCE(MAX(st.weight_kg), 0) AS max_weight,
          COALESCE(SUM(st.weight_kg * st.reps), 0) AS total_volume
        FROM session_exercises se
        JOIN sessions s ON s.id = se.session_id
        LEFT JOIN sets st ON st.session_exercise_id = se.id
        WHERE se.exercise_id IN (${sql.join(exerciseIds.map(id => sql`${id}`), sql`, `)})
          AND s.user_id = ${auth.userId}
        GROUP BY se.id, se.exercise_id, se.variant_id
      ),
      ranked AS (
        SELECT
          se_id,
          exercise_id,
          RANK() OVER (PARTITION BY exercise_id, variant_id ORDER BY max_weight DESC) AS weight_rank,
          RANK() OVER (PARTITION BY exercise_id, variant_id ORDER BY total_volume DESC) AS volume_rank
        FROM exercise_stats
        WHERE max_weight > 0
      )
      SELECT * FROM ranked
      WHERE se_id IN (${sql.join(exerciseList.map(e => sql`${e.sessionExerciseId}`), sql`, `)})
    `)) as unknown as { rows?: { se_id: number; weight_rank: number; volume_rank: number }[] };

    const rows = (rankRows.rows ?? rankRows) as unknown as { se_id: number; weight_rank: number; volume_rank: number }[];
    for (const row of rows) {
      rankings[row.se_id] = {
        weightRank: Number(row.weight_rank),
        volumeRank: Number(row.volume_rank),
      };
    }
  }

  // Fetch known weights per exercise
  // Paliers ranges par (exercice, version) : la suggestion de poids doit
  // proposer les plaques de la salle du jour.
  const knownWeightsMap: Record<string, number[]> = {};
  if (exerciseIds.length > 0) {
    const weightRows = await db
      .select({
        exerciseId: exerciseWeights.exerciseId,
        variantId: exerciseWeights.variantId,
        weightKg: exerciseWeights.weightKg,
      })
      .from(exerciseWeights)
      .where(inArray(exerciseWeights.exerciseId, exerciseIds))
      .orderBy(asc(exerciseWeights.weightKg));
    for (const row of weightRows) {
      const key = variantKey(row.exerciseId, row.variantId);
      if (!knownWeightsMap[key]) knownWeightsMap[key] = [];
      knownWeightsMap[key].push(row.weightKg);
    }
  }

  // Mascottes des machines : filigrane derrière le bloc pendant la séance.
  // Séance CLOSE : on préfère la mémoire — le Gardien photographié à la
  // clôture — au gardien actuel de la machine.
  const mascots = await loadMascotsByExercise(exerciseIds);
  if (session.tokensGrantedAt) {
    const snaps = exerciseList
      .filter((e) => e.guardianCategory && e.guardianCardId)
      .map((e) => ({
        exerciseId: e.exerciseId,
        category: e.guardianCategory as "animal" | "pokemon",
        cardId: e.guardianCardId as number,
      }));
    const remembered = await loadMascotsFromSnapshots(snaps);
    for (const [exId, m] of remembered) mascots.set(exId, m);
  }

  // L'Échappée : tirages du cardio encore en attente de placement — pour
  // que la cérémonie se re-propose même après un rechargement.
  const cardioDraws = session.tokensGrantedAt
    ? await pendingCardioDraws(auth.userId, sessionId)
    : [];

  return Response.json({
    ...session,
    cardioDraws,
    exercises: exerciseList.map((e) => ({
      ...e,
      mascot: mascots.get(e.exerciseId) ?? null,
      record: rankings[e.sessionExerciseId]
        ? Math.min(
            rankings[e.sessionExerciseId].weightRank ?? 999,
            rankings[e.sessionExerciseId].volumeRank ?? 999
          )
        : null,
      lastPerf: lastPerf[variantKey(e.exerciseId, e.variantId)] || null,
      knownWeights: knownWeightsMap[variantKey(e.exerciseId, e.variantId)] || [],
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updates: Partial<typeof sessions.$inferInsert> = {};
  if (typeof body.date === "string" && body.date) updates.date = body.date;
  if ("bodyweightKg" in body) {
    const v = body.bodyweightKg;
    updates.bodyweightKg = v == null ? null : Number(v);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(sessions)
    .set(updates)
    .where(and(eq(sessions.id, parseInt(id)), eq(sessions.userId, auth.userId)))
    .returning();

  if (!updated) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  revalidatePath("/");
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, parseInt(id)), eq(sessions.userId, auth.userId)));

  revalidatePath("/");
  return Response.json({ ok: true });
}
