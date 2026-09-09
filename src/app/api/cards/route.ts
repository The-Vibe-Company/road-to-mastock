import { db } from "@/lib/db";
import {
  animals,
  cardSkins,
  pokemon,
  userCardNames,
  userCards,
  userPokemonCards,
  userShards,
  userSkins,
  users,
  exercises,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { RARITIES, type Rarity } from "@/lib/rarities";
import { loadCharges } from "@/lib/guardians";
import { buildPackHat, buildWheel, magnesieOf, skinRarityShiftTenths, PRODIGES, MIRACLES } from "@/lib/powers";
import { talentOf } from "@/lib/talents";

// La carte nourrit-elle la Forge ? Vrai si son prodige/miracle touche à la
// jauge (add.forge, forge-vivante…) — détecté sur la définition elle-même.
function forgeOf(category: Category, slug: string): boolean {
  const def = PRODIGES[`${category}:${slug}`] ?? MIRACLES[`${category}:${slug}`];
  return !!def && JSON.stringify(def).toLowerCase().includes("forge");
}

type Category = "animal" | "pokemon";

const EMPTY_RARITY_RECORD = (): Record<Rarity, number> => ({
  common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0,
});

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ownedAnimals = await db
    .select({
      id: userCards.animalId,
      count: userCards.count,
      equippedSkinLevel: userCards.equippedSkinLevel,
      firstObtainedAt: userCards.firstObtainedAt,
      slug: animals.slug,
      name: animals.name,
      rarity: animals.rarity,
      lineage: animals.lineage,
      cardNumber: animals.cardNumber,
      scientificName: animals.scientificName,
      imageUrl: animals.imageUrl,
      description: animals.description,
      flavor: animals.flavor,
      heightCm: animals.heightCm,
      weightKg: animals.weightKg,
      habitat: animals.habitat,
    })
    .from(userCards)
    .innerJoin(animals, eq(userCards.animalId, animals.id))
    .where(eq(userCards.userId, auth.userId));

  const ownedPokemon = await db
    .select({
      id: userPokemonCards.pokemonId,
      count: userPokemonCards.count,
      equippedSkinLevel: userPokemonCards.equippedSkinLevel,
      firstObtainedAt: userPokemonCards.firstObtainedAt,
      slug: pokemon.slug,
      name: pokemon.name,
      rarity: pokemon.rarity,
      pokedexNumber: pokemon.pokedexNumber,
      primaryType: pokemon.primaryType,
      secondaryType: pokemon.secondaryType,
      imageUrl: pokemon.imageUrl,
      flavor: pokemon.flavor,
      heightCm: pokemon.heightCm,
      weightKg: pokemon.weightKg,
      habitat: pokemon.habitat,
    })
    .from(userPokemonCards)
    .innerJoin(pokemon, eq(userPokemonCards.pokemonId, pokemon.id))
    .where(eq(userPokemonCards.userId, auth.userId));

  // Totals per category per rarity
  const animalTotals = await db.select({ rarity: animals.rarity }).from(animals);
  const pokemonTotals = await db.select({ rarity: pokemon.rarity }).from(pokemon);

  const animalTotalsByRarity = EMPTY_RARITY_RECORD();
  for (const a of animalTotals) {
    if (RARITIES.includes(a.rarity as Rarity)) animalTotalsByRarity[a.rarity as Rarity]++;
  }
  const pokemonTotalsByRarity = EMPTY_RARITY_RECORD();
  for (const p of pokemonTotals) {
    if (RARITIES.includes(p.rarity as Rarity)) pokemonTotalsByRarity[p.rarity as Rarity]++;
  }

  const shardRows = await db
    .select({ rarity: userShards.rarity, category: userShards.category, count: userShards.count })
    .from(userShards)
    .where(eq(userShards.userId, auth.userId));

  const shards: Record<Category, Record<Rarity, number>> = {
    animal: EMPTY_RARITY_RECORD(),
    pokemon: EMPTY_RARITY_RECORD(),
  };
  for (const s of shardRows) {
    if (
      RARITIES.includes(s.rarity as Rarity) &&
      (s.category === "animal" || s.category === "pokemon")
    ) {
      shards[s.category as Category][s.rarity as Rarity] = s.count;
    }
  }

  const [user] = await db
    .select({ tokens: users.cardsTokens, specialTokens: users.cardsSpecialTokens })
    .from(users)
    .where(eq(users.id, auth.userId));

  // Surnoms (Le Vœu) : affichés à la place du nom pour leur propriétaire.
  const nicknameRows = await db
    .select({ category: userCardNames.category, cardId: userCardNames.cardId, nickname: userCardNames.nickname })
    .from(userCardNames)
    .where(eq(userCardNames.userId, auth.userId));
  const nicknames = new Map(nicknameRows.map((n) => [`${n.category}:${n.cardId}`, n.nickname]));

  // Les Skins : les 5 slots de chaque carte possédée, avec possession et
  // équipement — le vestiaire de la fiche carte s'en nourrit.
  const skinRows = (await db.execute(sql`
    SELECT cs.category, cs.card_id, cs.level, cs.name, cs.image_url,
           (us.id IS NOT NULL) AS owned
    FROM card_skins cs
    LEFT JOIN user_skins us ON us.skin_id = cs.id AND us.user_id = ${auth.userId}
    WHERE (cs.category = 'animal' AND cs.card_id IN (SELECT animal_id FROM user_cards WHERE user_id = ${auth.userId}))
       OR (cs.category = 'pokemon' AND cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards WHERE user_id = ${auth.userId}))
    ORDER BY cs.level
  `)) as unknown as { rows?: Record<string, unknown>[] };
  const skinList = ((skinRows.rows ?? skinRows) as unknown as {
    category: string; card_id: number; level: number; name: string; image_url: string | null; owned: boolean;
  }[]);
  const skinsByCard = new Map<string, { level: number; name: string; imageUrl: string | null; owned: boolean }[]>();
  for (const r of skinList) {
    const key = `${r.category}:${r.card_id}`;
    if (!skinsByCard.has(key)) skinsByCard.set(key, []);
    // Un skin non possédé reste TOTALEMENT secret : ni nom ni image ne
    // quittent le serveur — même les DevTools ne spoilent rien.
    const owned = !!r.owned;
    skinsByCard.get(key)!.push(
      owned
        ? { level: Number(r.level), name: r.name, imageUrl: r.image_url, owned }
        : { level: Number(r.level), name: "", imageUrl: null, owned },
    );
  }

  // Énergie des Gardiens + aperçu du chapeau qu'elle produit.
  const charges = await loadCharges(auth.userId);
  const hat = buildPackHat(charges);
  const hatTotal = Object.values(hat).reduce((a, b) => a + b, 0);
  const wheel = buildWheel(charges);
  const wheelTotal = wheel.reduce((a, o) => a + o.weight, 0);

  // Qui garde quoi : le sélecteur grise les cartes déjà en poste ailleurs.
  const guardians = (
    await db
      .select({
        exerciseId: exercises.id,
        exerciseName: exercises.name,
        a: exercises.mascotAnimalId,
        p: exercises.mascotPokemonId,
      })
      .from(exercises)
      .where(eq(exercises.userId, auth.userId))
  )
    .filter((r) => r.a != null || r.p != null)
    .map((r) => ({
      category: r.a != null ? ("animal" as const) : ("pokemon" as const),
      cardId: (r.a ?? r.p) as number,
      exerciseId: r.exerciseId,
      exerciseName: r.exerciseName,
    }));
  const guardianSet = new Set(guardians.map((g) => `${g.category}:${g.cardId}`));

  // Les critères de la Collection : surnom + ce que la carte fait pour toi.
  // Le talent n'est révélé QUE sur une carte possédée — c'est le Grimoire.
  const enrich = <T extends { id: number; slug: string; rarity: string }>(
    cards: T[],
    category: Category,
  ) =>
    cards.map((c) => {
      const skins = skinsByCard.get(`${category}:${c.id}`) ?? [];
      const lvl = (c as { equippedSkinLevel?: number | null }).equippedSkinLevel ?? null;
      const equipped = lvl != null ? skins.find((sk) => sk.level === lvl && sk.owned && sk.imageUrl) : null;
      return {
      ...c,
      nickname: nicknames.get(`${category}:${c.id}`) ?? null,
      // Le skin équipé habille la carte partout — l'original reste à portée.
      imageUrl: equipped?.imageUrl ?? (c as { imageUrl?: string | null }).imageUrl ?? null,
      baseImageUrl: (c as { imageUrl?: string | null }).imageUrl ?? null,
      skins,
      traits: {
        magnesie: magnesieOf(category, c.slug, c.rarity as Rarity) != null,
        talent: talentOf(category, c.slug) != null,
        forge: forgeOf(category, c.slug),
        guardian: guardianSet.has(`${category}:${c.id}`),
      },
      };
    });

  // La réserve : les skins mystère (cartes non possédées), comptés par
  // catégorie × rareté de carte × niveau — sans jamais révéler la carte.
  const reserveRows = (await db.execute(sql`
    SELECT cs.category, COALESCE(a.rarity, p.rarity) AS rarity, cs.level, COUNT(*)::int AS n
    FROM user_skins us
    JOIN card_skins cs ON cs.id = us.skin_id
    LEFT JOIN animals a ON cs.category = 'animal' AND a.id = cs.card_id
    LEFT JOIN pokemon p ON cs.category = 'pokemon' AND p.id = cs.card_id
    WHERE us.user_id = ${auth.userId}
      AND NOT (CASE WHEN cs.category = 'animal'
                    THEN cs.card_id IN (SELECT animal_id FROM user_cards WHERE user_id = ${auth.userId})
                    ELSE cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards WHERE user_id = ${auth.userId}) END)
    GROUP BY cs.category, COALESCE(a.rarity, p.rarity), cs.level
    ORDER BY cs.level DESC, rarity
  `)) as unknown as { rows?: { category: string; rarity: string; level: number; n: number }[] };
  const skinReserve = (((reserveRows.rows ?? reserveRows) as unknown as { category: string; rarity: string; level: number; n: number }[]) ?? [])
    .map((r) => ({ category: r.category, rarity: r.rarity, level: Number(r.level), count: Number(r.n) }));

  // Le détail des mystères, un par un (sans identité de carte) — pour la
  // vue « Tous mes skins ».
  const mysteryRows = (await db.execute(sql`
    SELECT cs.category, COALESCE(a.rarity, p.rarity) AS rarity, cs.level
    FROM user_skins us
    JOIN card_skins cs ON cs.id = us.skin_id
    LEFT JOIN animals a ON cs.category = 'animal' AND a.id = cs.card_id
    LEFT JOIN pokemon p ON cs.category = 'pokemon' AND p.id = cs.card_id
    WHERE us.user_id = ${auth.userId}
      AND NOT (CASE WHEN cs.category = 'animal'
                    THEN cs.card_id IN (SELECT animal_id FROM user_cards WHERE user_id = ${auth.userId})
                    ELSE cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards WHERE user_id = ${auth.userId}) END)
    ORDER BY cs.level DESC, rarity
  `)) as unknown as { rows?: { category: string; rarity: string; level: number }[] };
  const mysterySkins = (((mysteryRows.rows ?? mysteryRows) as unknown as { category: string; rarity: string; level: number }[]) ?? [])
    .map((r) => ({ category: r.category, rarity: r.rarity, level: Number(r.level) }));

  return Response.json({
    charges,
    guardians,
    skinReserve,
    mysterySkins,
    odds: {
      hat: Object.fromEntries(
        Object.entries(hat).map(([k, w]) => [k, hatTotal > 0 ? Math.round((w / hatTotal) * 100) : 0]),
      ),
      wheel: Object.fromEntries(
        wheel.map((o) => [o.reward, Math.round((o.weight / wheelTotal) * 100)]),
      ),
      // La Balance : décalage du curseur animal/pokémon des packs mixtes,
      // en points de pourcentage (positif = vers les Pokémon).
      innerShift: (charges.inner_pokemon ?? 0) - (charges.inner_animal ?? 0),
      // Le dé de rareté déformé par les Skins équipés des gardiens éveillés
      // (dixièmes de point de % par rareté) — la roue d'ouverture l'affiche.
      rarityShift: skinRarityShiftTenths(charges),
    },
    animals: {
      cards: enrich(ownedAnimals, "animal"),
      totalsByRarity: animalTotalsByRarity,
      shards: shards.animal,
    },
    pokemon: {
      cards: enrich(ownedPokemon, "pokemon"),
      totalsByRarity: pokemonTotalsByRarity,
      shards: shards.pokemon,
    },
    tokens: user?.tokens ?? 0,
    specialTokens: user?.specialTokens ?? 0,
  });
}
