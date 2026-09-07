import { db } from "@/lib/db";
import {
  animals,
  exercises,
  pokemon,
  userCards,
  userPokemonCards,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Rarity } from "@/lib/rarities";
import type { Mascot, MascotCategory } from "@/lib/mascot-types";

export type { Mascot, MascotCategory };

// Les deux colonnes sont exclusives, mais rien en base ne l'impose : si les
// deux sont remplies (bug ou écriture concurrente), l'animal l'emporte.
export function pickMascotSide(
  mascotAnimalId: number | null,
  mascotPokemonId: number | null,
): { category: MascotCategory; id: number } | null {
  if (mascotAnimalId != null) return { category: "animal", id: mascotAnimalId };
  if (mascotPokemonId != null) return { category: "pokemon", id: mascotPokemonId };
  return null;
}

// Résout en deux requêtes les mascottes d'un lot d'exercices, indexées par
// exerciseId. Une carte supprimée du catalogue ressort simplement absente.
// Deux métamorphoses s'appliquent au passage :
// - La Légende de la Carpe : Magicarpe posé 60 éveils devient un Léviator
//   rouge (l'image bascule, le client ajoute le filtre de teinte) ;
// - La Copie : Métamorph imite chaque jour une carte possédée différente.
export async function loadMascotsByExercise(
  exerciseIds: number[],
): Promise<Map<number, Mascot>> {
  const result = new Map<number, Mascot>();
  if (exerciseIds.length === 0) return result;

  const rows = await db
    .select({
      id: exercises.id,
      userId: exercises.userId,
      mascotAnimalId: exercises.mascotAnimalId,
      mascotPokemonId: exercises.mascotPokemonId,
      mascotTriggers: exercises.mascotTriggers,
    })
    .from(exercises)
    .where(inArray(exercises.id, exerciseIds));

  const animalIds = new Set<number>();
  const pokemonIds = new Set<number>();
  for (const row of rows) {
    const side = pickMascotSide(row.mascotAnimalId, row.mascotPokemonId);
    if (!side) continue;
    (side.category === "animal" ? animalIds : pokemonIds).add(side.id);
  }

  const animalRows = animalIds.size
    ? await db
        .select({
          id: animals.id,
          slug: animals.slug,
          name: animals.name,
          rarity: animals.rarity,
          imageUrl: animals.imageUrl,
          number: animals.cardNumber,
          subtype: animals.lineage,
        })
        .from(animals)
        .where(inArray(animals.id, [...animalIds]))
    : [];
  const pokemonRows = pokemonIds.size
    ? await db
        .select({
          id: pokemon.id,
          slug: pokemon.slug,
          name: pokemon.name,
          rarity: pokemon.rarity,
          imageUrl: pokemon.imageUrl,
          number: pokemon.pokedexNumber,
          subtype: pokemon.primaryType,
        })
        .from(pokemon)
        .where(inArray(pokemon.id, [...pokemonIds]))
    : [];

  const byAnimal = new Map(animalRows.map((r) => [r.id, r]));
  const byPokemon = new Map(pokemonRows.map((r) => [r.id, r]));

  for (const row of rows) {
    const side = pickMascotSide(row.mascotAnimalId, row.mascotPokemonId);
    if (!side) continue;
    const source =
      side.category === "animal" ? byAnimal.get(side.id) : byPokemon.get(side.id);
    if (!source) continue;
    const mascot: Mascot = {
      category: side.category,
      id: source.id,
      slug: source.slug,
      name: source.name,
      rarity: source.rarity as Rarity,
      imageUrl: source.imageUrl,
      number: source.number,
      subtype: source.subtype,
      evolved: false,
    };

    // La Légende de la Carpe : 60 éveils → Léviator rouge.
    if (source.slug === "magikarp" && row.mascotTriggers >= 60) {
      const [gyarados] = await db
        .select({ imageUrl: pokemon.imageUrl })
        .from(pokemon)
        .where(eq(pokemon.slug, "gyarados"));
      if (gyarados?.imageUrl) {
        mascot.imageUrl = gyarados.imageUrl;
        mascot.evolved = true;
      }
    }

    // La Copie : Métamorph imite une carte possédée, différente chaque jour.
    if (source.slug === "ditto") {
      const copy = await dailyDittoCopy(row.userId);
      if (copy) mascot.imageUrl = copy;
    }

    result.set(row.id, mascot);
  }

  return result;
}

// Carte imitée par Métamorph aujourd'hui : déterministe par jour, piochée
// dans la collection du propriétaire (Métamorph lui-même exclu).
async function dailyDittoCopy(userId: number): Promise<string | null> {
  const rows = await db
    .select({ imageUrl: pokemon.imageUrl, slug: pokemon.slug })
    .from(userPokemonCards)
    .innerJoin(pokemon, eq(userPokemonCards.pokemonId, pokemon.id))
    .where(eq(userPokemonCards.userId, userId));
  const candidates = rows.filter((r) => r.slug !== "ditto" && r.imageUrl);
  if (candidates.length === 0) return null;
  const day = Math.floor(Date.now() / 86400000);
  return candidates[day % candidates.length].imageUrl;
}

// On ne décore qu'avec une carte qu'on possède : sinon il suffirait de
// connaître un id pour s'offrir un mythique en fond d'écran.
export async function ownsCard(
  userId: number,
  category: MascotCategory,
  cardId: number,
): Promise<boolean> {
  if (category === "animal") {
    const [row] = await db
      .select({ id: userCards.id })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), eq(userCards.animalId, cardId)));
    return !!row;
  }
  const [row] = await db
    .select({ id: userPokemonCards.id })
    .from(userPokemonCards)
    .where(
      and(
        eq(userPokemonCards.userId, userId),
        eq(userPokemonCards.pokemonId, cardId),
      ),
    );
  return !!row;
}

// ─── La mémoire des Gardiens ────────────────────────────────────────────────
// Reconstruit les mascottes depuis les photographies prises à la clôture
// (session_exercises.guardian_*) : l'historique montre le Gardien de
// l'époque, pas celui d'aujourd'hui.
export async function loadMascotsFromSnapshots(
  snapshots: { exerciseId: number; category: "animal" | "pokemon"; cardId: number }[],
): Promise<Map<number, Mascot>> {
  const result = new Map<number, Mascot>();
  if (snapshots.length === 0) return result;

  const animalIds = [...new Set(snapshots.filter((s) => s.category === "animal").map((s) => s.cardId))];
  const pokemonIds = [...new Set(snapshots.filter((s) => s.category === "pokemon").map((s) => s.cardId))];
  const animalRows = animalIds.length
    ? await db
        .select({ id: animals.id, slug: animals.slug, name: animals.name, rarity: animals.rarity, imageUrl: animals.imageUrl, number: animals.cardNumber, subtype: animals.lineage })
        .from(animals)
        .where(inArray(animals.id, animalIds))
    : [];
  const pokemonRows = pokemonIds.length
    ? await db
        .select({ id: pokemon.id, slug: pokemon.slug, name: pokemon.name, rarity: pokemon.rarity, imageUrl: pokemon.imageUrl, number: pokemon.pokedexNumber, subtype: pokemon.primaryType })
        .from(pokemon)
        .where(inArray(pokemon.id, pokemonIds))
    : [];
  const byAnimal = new Map(animalRows.map((r) => [r.id, r]));
  const byPokemon = new Map(pokemonRows.map((r) => [r.id, r]));

  for (const snap of snapshots) {
    const source = snap.category === "animal" ? byAnimal.get(snap.cardId) : byPokemon.get(snap.cardId);
    if (!source) continue;
    result.set(snap.exerciseId, {
      category: snap.category,
      id: source.id,
      slug: source.slug,
      name: source.name,
      rarity: source.rarity as Rarity,
      imageUrl: source.imageUrl,
      number: source.number,
      subtype: source.subtype,
      evolved: false,
    });
  }
  return result;
}
