import { db } from "@/lib/db";
import { cardSkins, userCards, userPokemonCards, userSkins } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

// Le vestiaire : équiper un skin possédé sur une carte possédée (level
// null = revenir au classique). Le skin équipé habille la carte partout.
export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { category, cardId, level } = (await request.json()) as {
    category?: "animal" | "pokemon";
    cardId?: number;
    level?: number | null;
  };
  if ((category !== "animal" && category !== "pokemon") || typeof cardId !== "number") {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (level != null) {
    if (typeof level !== "number" || level < 1 || level > 5) {
      return Response.json({ error: "Niveau invalide" }, { status: 400 });
    }
    // Le skin doit être possédé.
    const [skin] = await db
      .select({ id: cardSkins.id })
      .from(cardSkins)
      .where(and(eq(cardSkins.category, category), eq(cardSkins.cardId, cardId), eq(cardSkins.level, level)));
    if (!skin) return Response.json({ error: "Skin inconnu" }, { status: 404 });
    const [owned] = await db
      .select({ id: userSkins.id })
      .from(userSkins)
      .where(and(eq(userSkins.userId, auth.userId), eq(userSkins.skinId, skin.id)));
    if (!owned) return Response.json({ error: "Skin non possédé" }, { status: 403 });
  }
  const table = category === "animal" ? userCards : userPokemonCards;
  const cardCol = category === "animal" ? userCards.animalId : userPokemonCards.pokemonId;
  const res = await db
    .update(table)
    .set({ equippedSkinLevel: level ?? null })
    .where(and(eq(table.userId, auth.userId), eq(cardCol, cardId)))
    .returning({ id: table.id });
  if (res.length === 0) return Response.json({ error: "Carte non possédée" }, { status: 404 });
  return Response.json({ ok: true, equipped: level ?? null });
}
