import { db } from "@/lib/db";
import { animals, userCards } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

// Les deux pactes requalifiés par l'énergie persistante (le chapeau tient
// jusqu'à la clôture) : le Blizzard Gardien (Yéti) et le Pardon des
// Abysses (Léviathan) agissent désormais À LA CLÔTURE. Cette route dit
// lesquelles de ces cartes l'utilisateur possède — l'annonce ne dérange
// que les joueurs concernés.
const PACT_SLUGS = ["yeti", "leviathan"] as const;

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      slug: animals.slug,
      name: animals.name,
      rarity: animals.rarity,
      imageUrl: animals.imageUrl,
    })
    .from(userCards)
    .innerJoin(animals, eq(userCards.animalId, animals.id))
    .where(and(eq(userCards.userId, auth.userId), inArray(animals.slug, [...PACT_SLUGS])));

  return Response.json({ cards: rows });
}
