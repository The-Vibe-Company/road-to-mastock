import { db } from "@/lib/db";
import {
  sessions,
  sessionExercises,
  sets,
  users,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { drawCardioReserves, resolveGuardians, type CardioDraw, type GuardianResolution } from "@/lib/guardians";
import { claimNewTrophies, sessionTrophyProgress, type TrophyProgressStep } from "@/lib/trophies-server";
import { TROPHIES } from "@/lib/trophies";
import { revalidatePath } from "next/cache";

async function sessionHasSets(sessionId: number) {
  const [row] = await db
    .select({ c: sql<number>`COUNT(${sets.id})::int` })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.sessionId, sessionId));
  return (row?.c ?? 0) > 0;
}

// POST: mark session as terminated. Grants 1 token if not already granted
// for this session (idempotent across re-terminate cycles).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sessionId = parseInt(id);

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, auth.userId)));
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  if (!(await sessionHasSets(sessionId))) {
    return Response.json(
      { error: "Termine au moins une série avant de clôturer" },
      { status: 400 },
    );
  }

  let tokenGranted = false;
  let specialTokenGranted = false;
  // Résolution des Gardiens : uniquement au premier octroi de jetons, donc
  // rouvrir/reclôturer ne rejoue rien.
  let guardianResult: GuardianResolution | null = null;
  // Trophées gagnés par CETTE clôture — célébrés une seule fois.
  let newTrophies: string[] = [];
  // L'Échappée : cartes tirées par le cardio, à placer dans la cérémonie.
  let cardioDraws: CardioDraw[] = [];
  // L'avancée : ce que la séance a fait progresser vers les trophées.
  let trophyProgress: TrophyProgressStep[] = [];
  // 1ʳᵉ et 4ᵉ séance terminée de la semaine ISO (basée sur sessions.date,
  // pas la date de termination) → jeton spécial à la place du jeton normal.
  // Sessions 2/3/5+ de la semaine → jeton normal classique.
  let weekPosition: number | null = null;

  if (!session.tokensGrantedAt) {
    // LA RÈGLE DU JOUR : une seule clôture (donc un seul jeton) par jour.
    // Une autre séance datée du même jour a déjà été clôturée → refus net.
    const dayRes = (await db.execute(sql`
      SELECT id FROM sessions
      WHERE user_id = ${auth.userId}
        AND date = ${session.date}
        AND id != ${sessionId}
        AND tokens_granted_at IS NOT NULL
      LIMIT 1
    `)) as unknown as { rows?: { id: number }[] };
    const alreadyClosed = (((dayRes.rows ?? dayRes) as unknown as { id: number }[]) ?? []).length > 0;
    if (alreadyClosed) {
      return Response.json(
        {
          error:
            "Une seule clôture par jour — celle de cette journée est déjà passée. Fusionne tes séries dans la séance du jour, ou change la date de celle-ci.",
        },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(sessions)
      .set({
        terminatedAt: new Date(),
        tokensGrantedAt: new Date(),
      })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, auth.userId),
          sql`${sessions.tokensGrantedAt} IS NULL`,
        ),
      )
      .returning();
    if (updated) {
      try {
      // Compte les AUTRES sessions ayant déjà reçu un jeton et dont la
      // DATE de séance (pas la date de termination) tombe dans la même
      // semaine ISO que la session courante. Ainsi, terminer en batch
      // 5 sessions de 5 semaines distinctes donne 5 specials, pas 1.
      const countRes = (await db.execute(sql`
        SELECT COUNT(*)::int AS "countBefore"
        FROM sessions
        WHERE user_id = ${auth.userId}
          AND tokens_granted_at IS NOT NULL
          AND id != ${sessionId}
          AND DATE_TRUNC('week', date::timestamp) = DATE_TRUNC('week', ${session.date}::timestamp)
      `)) as unknown as { rows?: { countBefore: number }[] };
      const rows = (countRes.rows ?? countRes) as unknown as { countBefore: number }[];
      const previousThisWeek = Number(rows[0]?.countBefore ?? 0);
      weekPosition = previousThisWeek + 1;

      guardianResult = await resolveGuardians({
        userId: auth.userId,
        sessionId,
        sessionDate: session.date,
        weekPosition,
      });
      newTrophies = await claimNewTrophies(auth.userId);
      trophyProgress = await sessionTrophyProgress(auth.userId, sessionId);
      cardioDraws = await drawCardioReserves(auth.userId, sessionId);
      // Les skins se gagnent désormais à l'ouverture des packs (3 par pack).

      const isSpecialPosition = weekPosition === 1 || weekPosition === 4;
      if (isSpecialPosition) {
        await db
          .update(users)
          .set({ cardsSpecialTokens: sql`${users.cardsSpecialTokens} + 1` })
          .where(eq(users.id, auth.userId));
        specialTokenGranted = true;
      } else {
        await db
          .update(users)
          .set({ cardsTokens: sql`${users.cardsTokens} + 1` })
          .where(eq(users.id, auth.userId));
        tokenGranted = true;
      }
      } catch (err) {
        // Le claim tokensGrantedAt est déjà posé : sans réparation, un
        // échec ici perdrait définitivement gardiens, jeton et trophées
        // (le retry sauterait le bloc). On rend le claim, puis on relance
        // l'erreur — la reclôture rejouera tout proprement.
        await db
          .update(sessions)
          .set({ terminatedAt: null, tokensGrantedAt: null })
          .where(and(eq(sessions.id, sessionId), eq(sessions.userId, auth.userId)));
        throw err;
      }
    } else {
      await db
        .update(sessions)
        .set({ terminatedAt: new Date() })
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, auth.userId)));
    }
  } else {
    await db
      .update(sessions)
      .set({ terminatedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, auth.userId)));
  }

  const [user] = await db
    .select({ tokens: users.cardsTokens, specialTokens: users.cardsSpecialTokens })
    .from(users)
    .where(eq(users.id, auth.userId));

  revalidatePath("/");
  return Response.json({
    terminated: true,
    tokenGranted,
    specialTokenGranted,
    weekPosition,
    tokens: user?.tokens ?? 0,
    specialTokens: user?.specialTokens ?? 0,
    guardians: guardianResult?.guardians ?? [],
    recordCount: guardianResult?.recordCount ?? 0,
    charges: guardianResult?.charges ?? null,
    bonusTokens: guardianResult?.bonusTokens ?? 0,
    bonusSpecialTokens: guardianResult?.bonusSpecialTokens ?? 0,
    newTrophies: newTrophies
      .map((id) => TROPHIES.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => ({ id: t!.id, name: t!.name, rewardLabel: t!.rewardLabel })),
    cardioDraws,
    trophyProgress,
  });
}

// DELETE: undo termination (does NOT take back the token).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sessionId = parseInt(id);

  const [updated] = await db
    .update(sessions)
    .set({ terminatedAt: null })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, auth.userId)))
    .returning();

  if (!updated) return Response.json({ error: "Session not found" }, { status: 404 });
  revalidatePath("/");
  return Response.json({ terminated: false });
}
