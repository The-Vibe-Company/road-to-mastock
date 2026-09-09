import { db } from "@/lib/db";
import { userSkins, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

// Le skin de bienvenue : à l'annonce de la feature, un skin NIVEAU 1
// offert sur une carte que le joueur possède (image déjà générée).
// Une seule fois par joueur — le flag ne se pose qu'en cas de succès,
// pour retenter tant qu'aucun skin éligible n'existe.
export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Non connecté" }, { status: 401 });

  const [me] = await db
    .select({ granted: users.skinGiftGranted })
    .from(users)
    .where(eq(users.id, auth.userId));
  if (!me || me.granted) return Response.json({ granted: false });

  const rows = (await db.execute(sql`
    SELECT cs.id, cs.name, cs.image_url, COALESCE(a.name, p.name) AS card_name
    FROM card_skins cs
    LEFT JOIN animals a ON cs.category = 'animal' AND a.id = cs.card_id
    LEFT JOIN pokemon p ON cs.category = 'pokemon' AND p.id = cs.card_id
    WHERE cs.level = 1 AND cs.status = 'done' AND cs.image_url IS NOT NULL
    AND (
      (cs.category = 'animal' AND cs.card_id IN (SELECT animal_id FROM user_cards WHERE user_id = ${auth.userId}))
      OR (cs.category = 'pokemon' AND cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards WHERE user_id = ${auth.userId}))
    )
    AND cs.id NOT IN (SELECT skin_id FROM user_skins WHERE user_id = ${auth.userId})
    ORDER BY random()
    LIMIT 1
  `)) as unknown as { rows?: Record<string, unknown>[] };
  const [pick] = ((rows.rows ?? rows) as unknown as {
    id: number; name: string; image_url: string | null; card_name: string;
  }[]);
  if (!pick) return Response.json({ granted: false });

  await db.insert(userSkins).values({ userId: auth.userId, skinId: pick.id }).onConflictDoNothing();
  await db.update(users).set({ skinGiftGranted: true }).where(eq(users.id, auth.userId));

  return Response.json({
    granted: true,
    skin: { level: 1, name: pick.name, imageUrl: pick.image_url, cardName: pick.card_name },
  });
}
