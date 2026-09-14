// Export des perfs d'Antoine en un gros JSON (lecture seule).
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const pattern = `%${(process.argv[3] ?? "antoine").toLowerCase()}%`;
  const users = (await sql.query(
    "SELECT id, name, email, created_at FROM users WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 ORDER BY (SELECT COUNT(*) FROM sessions s WHERE s.user_id = users.id) DESC LIMIT 5",
    [pattern],
  )) as { rows?: unknown[] } | unknown[];
  const list = (Array.isArray(users) ? users : users.rows ?? []) as {
    id: number; name: string; email: string; created_at: string;
  }[];
  if (list.length === 0) throw new Error("Aucun utilisateur antoine trouvé");
  const user = list[0];

  const q = async (text: string, params: unknown[] = []) => {
    const r = (await sql.query(text, params)) as { rows?: unknown[] } | unknown[];
    return (Array.isArray(r) ? r : r.rows ?? []) as Record<string, unknown>[];
  };

  const sessions = await q(
    `SELECT s.id, s.date, s.notes, s.bodyweight_kg, s.terminated_at
     FROM sessions s WHERE s.user_id = $1 ORDER BY s.date ASC, s.id ASC`,
    [user.id],
  );

  const rows = await q(
    `SELECT s.id AS session_id, se.id AS se_id, se.sort_order,
            e.id AS exercise_id, e.name AS exercise, e.kind, e.muscle_group,
            v.name AS variant,
            st.set_number, st.weight_kg, st.reps, st.duration_minutes,
            st.calories, st.distance_km, st.avg_speed_kmh
     FROM sessions s
     JOIN session_exercises se ON se.session_id = s.id
     JOIN exercises e ON e.id = se.exercise_id
     LEFT JOIN exercise_variants v ON v.id = se.variant_id
     LEFT JOIN sets st ON st.session_exercise_id = se.id
     WHERE s.user_id = $1
     ORDER BY s.date ASC, s.id ASC, se.sort_order ASC, se.id ASC, st.set_number ASC`,
    [user.id],
  );

  type SetRow = { setNumber: number; weightKg: number | null; reps: number | null;
    durationMinutes: number | null; calories: number | null; distanceKm: number | null; avgSpeedKmh: number | null };
  const bySession = new Map<number, Map<number, { exercise: string; kind: string; muscleGroup: string | null; variant: string | null; sortOrder: number; sets: SetRow[] }>>();
  for (const r of rows) {
    const sid = r.session_id as number;
    if (!bySession.has(sid)) bySession.set(sid, new Map());
    const m = bySession.get(sid)!;
    const seId = r.se_id as number;
    if (!m.has(seId)) {
      m.set(seId, {
        exercise: r.exercise as string, kind: r.kind as string,
        muscleGroup: (r.muscle_group as string) ?? null,
        variant: (r.variant as string) ?? null,
        sortOrder: (r.sort_order as number) ?? 0, sets: [],
      });
    }
    if (r.set_number != null) {
      m.get(seId)!.sets.push({
        setNumber: r.set_number as number,
        weightKg: r.weight_kg as number | null, reps: r.reps as number | null,
        durationMinutes: r.duration_minutes as number | null,
        calories: r.calories as number | null,
        distanceKm: r.distance_km as number | null,
        avgSpeedKmh: r.avg_speed_kmh as number | null,
      });
    }
  }

  // Récap perf par exercice : volume, meilleure série, 1RM estimé (Epley), historique des maxs.
  const perExercise = new Map<string, {
    exercise: string; muscleGroup: string | null; sessions: number; sets: number; reps: number;
    volumeKg: number; maxWeightKg: number | null; bestSet: { date: string; weightKg: number; reps: number } | null;
    estimated1RM: number | null; history: { date: string; topWeightKg: number | null; topReps: number | null; volumeKg: number }[];
  }>();
  const sessionDates = new Map(sessions.map((s) => [s.id as number, String(s.date)]));
  for (const [sid, m] of bySession) {
    const date = sessionDates.get(sid) ?? "?";
    for (const se of m.values()) {
      if (!perExercise.has(se.exercise)) {
        perExercise.set(se.exercise, {
          exercise: se.exercise, muscleGroup: se.muscleGroup, sessions: 0, sets: 0, reps: 0,
          volumeKg: 0, maxWeightKg: null, bestSet: null, estimated1RM: null, history: [],
        });
      }
      const agg = perExercise.get(se.exercise)!;
      agg.sessions++;
      let topW: number | null = null; let topR: number | null = null; let vol = 0;
      for (const st of se.sets) {
        agg.sets++;
        agg.reps += st.reps ?? 0;
        const v = (st.weightKg ?? 0) * (st.reps ?? 0);
        vol += v; agg.volumeKg += v;
        if (st.weightKg != null && (agg.maxWeightKg == null || st.weightKg > agg.maxWeightKg)) agg.maxWeightKg = st.weightKg;
        if (st.weightKg != null && (topW == null || st.weightKg > topW)) { topW = st.weightKg; topR = st.reps; }
        if (st.weightKg != null && st.reps != null) {
          const oneRM = st.weightKg * (1 + st.reps / 30);
          if (agg.estimated1RM == null || oneRM > agg.estimated1RM) {
            agg.estimated1RM = Math.round(oneRM * 10) / 10;
            agg.bestSet = { date, weightKg: st.weightKg, reps: st.reps };
          }
        }
      }
      agg.history.push({ date, topWeightKg: topW, topReps: topR, volumeKg: Math.round(vol) });
    }
  }

  const sessionsOut = sessions.map((s) => ({
    id: s.id, date: s.date, notes: s.notes ?? null,
    bodyweightKg: s.bodyweight_kg ?? null, terminatedAt: s.terminated_at ?? null,
    exercises: [...(bySession.get(s.id as number)?.values() ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const totalSets = sessionsOut.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  const totalVolume = Math.round([...perExercise.values()].reduce((n, e) => n + e.volumeKg, 0));

  const out = {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.created_at },
    stats: {
      sessionCount: sessionsOut.length,
      exerciseCount: perExercise.size,
      setCount: totalSets,
      totalVolumeKg: totalVolume,
      firstSession: sessionsOut[0]?.date ?? null,
      lastSession: sessionsOut[sessionsOut.length - 1]?.date ?? null,
    },
    perfByExercise: [...perExercise.values()].sort((a, b) => b.volumeKg - a.volumeKg)
      .map((e) => ({ ...e, volumeKg: Math.round(e.volumeKg) })),
    sessions: sessionsOut,
  };

  const { writeFileSync } = await import("node:fs");
  const path = process.argv[2] ?? "/tmp/perf-antoine.json";
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`OK → ${path} (${sessionsOut.length} séances, ${totalSets} séries, ${perExercise.size} exercices)`);
}
main();
