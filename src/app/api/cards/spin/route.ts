import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { buildWheel, type Charges } from "@/lib/powers";
import { loadCharges } from "@/lib/guardians";

// Roue d'un jeton spécial : convertit en jetons normaux. La table de base
// (×1 à ×4) peut être transformée par les sorts des Gardiens : la Roue
// Pipée retire le ×1, le Festin des Songes le change en ×2, la Colère de
// Typhon ne laisse que ×3/×4, et le Pas de la Fortune ouvre le ×10.
function rollSpin(charges: Charges): number {
  const outcomes = buildWheel(charges);
  const total = outcomes.reduce((a, o) => a + o.weight, 0);
  let r = Math.random() * total;
  for (const o of outcomes) {
    r -= o.weight;
    if (r <= 0) return o.reward;
  }
  return outcomes[0]?.reward ?? 1;
}

// POST: spend 1 special token, roll the wheel, grant 1-4 normal tokens.
export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Atomic decrement of special tokens
  const [decremented] = await db
    .update(users)
    .set({ cardsSpecialTokens: sql`${users.cardsSpecialTokens} - 1` })
    .where(and(eq(users.id, auth.userId), sql`${users.cardsSpecialTokens} >= 1`))
    .returning({ specialTokens: users.cardsSpecialTokens });

  if (!decremented) {
    return Response.json({ error: "Pas de jeton spécial disponible" }, { status: 400 });
  }

  const charges = await loadCharges(auth.userId);
  const reward = rollSpin(charges);
  // Les sorts de roue tiennent jusqu'à la prochaine clôture : une roue
  // transformée le reste pour tous tes jetons spéciaux de la fournée.

  const [updatedUser] = await db
    .update(users)
    .set({ cardsTokens: sql`${users.cardsTokens} + ${reward}` })
    .where(eq(users.id, auth.userId))
    .returning({ tokens: users.cardsTokens });

  return Response.json({
    reward,
    tokens: updatedUser?.tokens ?? 0,
    specialTokens: decremented.specialTokens,
  });
}
