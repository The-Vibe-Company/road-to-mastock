import { db } from "@/lib/db";
import {
  animals,
  pokemon,
  userCardNames,
  userCards,
  userPokemonCards,
  userShards,
  users,
  exercises,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { RARITIES, type Rarity } from "@/lib/rarities";
import { loadCharges } from "@/lib/guardians";
import { buildPackHat, buildWheel } from "@/lib/powers";

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
  const withNick = <T extends { id: number }>(cards: T[], category: string) =>
    cards.map((c) => ({ ...c, nickname: nicknames.get(`${category}:${c.id}`) ?? null }));

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

  return Response.json({
    charges,
    guardians,
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
    },
    animals: {
      cards: withNick(ownedAnimals, "animal"),
      totalsByRarity: animalTotalsByRarity,
      shards: shards.animal,
    },
    pokemon: {
      cards: withNick(ownedPokemon, "pokemon"),
      totalsByRarity: pokemonTotalsByRarity,
      shards: shards.pokemon,
    },
    tokens: user?.tokens ?? 0,
    specialTokens: user?.specialTokens ?? 0,
  });
}
