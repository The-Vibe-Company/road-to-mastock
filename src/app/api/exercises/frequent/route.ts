import { db } from "@/lib/db";
import { exercises, sessionExercises, sessions, sets } from "@/lib/db/schema";
import { eq, desc, asc, count, countDistinct, max } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { resolveMuscleGroups } from "@/lib/muscle-groups";
import { loadMascotsByExercise } from "@/lib/mascots";
import { UNBIND_PRICE } from "@/lib/powers";

// Classement des exercices deja faits, du plus frequent au moins frequent.
// `?limit=all` renvoie tout le classement (onglet Exercices de la home),
// sinon on garde le top 10 (raccourci du selecteur d'exercice).
export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam === "all" ? null : Number(limitParam) || 10;

  const query = db
    .select({
      id: exercises.id,
      name: exercises.name,
      kind: exercises.kind,
      isAssisted: exercises.isAssisted,
      muscleGroup: exercises.muscleGroup,
      muscleGroups: exercises.muscleGroups,
      hasVariants: exercises.hasVariants,
      mascotAssignedAt: exercises.mascotAssignedAt,
      mascotTriggers: exercises.mascotTriggers,
      useCount: countDistinct(sessionExercises.id),
      setCount: count(sets.id),
      lastDate: max(sessions.date),
    })
    .from(sessionExercises)
    .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessions.userId, auth.userId))
    .groupBy(exercises.id)
    .orderBy(
      desc(countDistinct(sessionExercises.id)),
      desc(count(sets.id)),
      asc(exercises.name),
    );

  const result = limit === null ? await query : await query.limit(limit);

  // Le Gardien en un coup d'œil : la carte postée sur chaque machine, avec
  // l'état de son lien — même règle que guardianBondStatus (30 jours depuis
  // la pose, grâce tant qu'aucun éveil n'a noué le lien).
  const mascots = await loadMascotsByExercise(result.map((r) => r.id));
  const now = Date.now();

  return Response.json(
    result.map((r) => {
      const groups = resolveMuscleGroups(r.muscleGroups, r.muscleGroup);
      const mascot = mascots.get(r.id) ?? null;
      let guardian: {
        name: string;
        rarity: string;
        imageUrl: string | null;
        unlockAt: string | null;
        unbindPrice: number;
      } | null = null;
      if (mascot) {
        const assignedAt = r.mascotAssignedAt ? new Date(r.mascotAssignedAt).getTime() : null;
        const unlockTime = assignedAt != null ? assignedAt + 30 * 86400000 : null;
        const locked =
          unlockTime != null && (r.mascotTriggers ?? 0) > 0 && now < unlockTime;
        guardian = {
          name: mascot.name,
          rarity: mascot.rarity,
          imageUrl: mascot.imageUrl,
          // Null = libre (grâce, lien expiré, ou pose antérieure à la règle).
          unlockAt: locked ? new Date(unlockTime!).toISOString().slice(0, 10) : null,
          unbindPrice: UNBIND_PRICE[mascot.rarity],
        };
      }
      return {
        id: r.id,
        name: r.name,
        kind: r.kind ?? "muscu",
        isAssisted: r.isAssisted ?? false,
        hasVariants: r.hasVariants ?? false,
        muscleGroup: groups[0] ?? null,
        muscleGroups: groups,
        useCount: r.useCount,
        setCount: r.setCount,
        lastDate: r.lastDate,
        guardian,
      };
    }),
  );
}
