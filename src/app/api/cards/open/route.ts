import { db } from "@/lib/db";
import {
  animals,
  pokemon,
  userCards,
  userPokemonCards,
  userShards,
  users,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { rollRarityForPack, PACK_TYPES, PACK_CATEGORY_PROB_POKEMON, type PackType } from "@/lib/pack-types";
import { buildPackHat, innerPokemonProb, skinRarityShiftTenths, type Charges } from "@/lib/powers";
import { drawPackSkins, loadCharges, skinsAwaitingFor } from "@/lib/guardians";
import { talentOf } from "@/lib/talents";

// Hiérarchie de désirabilité des packs, pour le Passe-Mondes de Hoopa.
const PACK_RANK: Record<PackType, number> = {
  mythic: 5,
  premium: 4,
  pokemon_only: 3,
  basic: 2,
  animal_only: 1,
};

// Tirage du type de pack dans le chapeau chargé par les Gardiens, avec les
// sorts à un coup : l'Ascension refuse le Basique, le Passe-Mondes tire deux
// packs et garde le meilleur.
function rollPackTypeFromHat(charges: Charges): PackType {
  const hat = buildPackHat(charges);
  const total = Object.values(hat).reduce((a, b) => a + b, 0);
  const rollOnce = (): PackType => {
    if (total <= 0) return "basic";
    let r = Math.random() * total;
    for (const t of PACK_TYPES) {
      r -= hat[t];
      if (r <= 0) return t;
    }
    return "basic";
  };
  let pick = rollOnce();
  // L'Ascension / l'Ombre des Ailes : chaque charge retire un Basique.
  let rerolls = charges.no_basic ?? 0;
  while (pick === "basic" && rerolls > 0) {
    rerolls--;
    pick = rollOnce();
  }
  // Le Passe-Mondes : deux tirages, on garde le meilleur.
  if ((charges.hoopa_double ?? 0) > 0) {
    const second = rollOnce();
    if (PACK_RANK[second] > PACK_RANK[pick]) pick = second;
  }
  return pick;
}

// Debug knobs (leave unset in prod):
//   CARDS_DEBUG_FORCE_PACK_TYPE=basic|animal_only|pokemon_only|premium|mythic
//   CARDS_DEBUG_FORCE_ANIMAL_SLUG=<slug>
//   CARDS_DEBUG_FORCE_POKEMON_SLUG=<slug>
//   CARDS_DEBUG_FREE_TOKENS=true
const DEBUG_FORCE_PACK = process.env.CARDS_DEBUG_FORCE_PACK_TYPE as PackType | undefined;
const DEBUG_FORCE_ANIMAL = process.env.CARDS_DEBUG_FORCE_ANIMAL_SLUG;
const DEBUG_FORCE_POKEMON = process.env.CARDS_DEBUG_FORCE_POKEMON_SLUG;
const DEBUG_FREE_TOKENS = process.env.CARDS_DEBUG_FREE_TOKENS === "true";

// POST: spends 1 token to open a pack.
// 1. Roll pack type (64% basic / 15% animal-only / 15% pokemon-only / 5% premium / 1% mythic).
// 2. Roll category from pack type (forced for animal/pokemon-only, weighted otherwise).
// 3. Roll rarity from pack type (premium drops commons, mythic only legendary+).
// 4. Pick a random creature in (category, rarity).
// 5. Insert in user collection. If duplicate, also grant 1 fragment.
export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Spend 1 token (skip if debug free tokens)
  let tokensRemaining: number;
  if (DEBUG_FREE_TOKENS) {
    const [u] = await db
      .select({ tokens: users.cardsTokens })
      .from(users)
      .where(eq(users.id, auth.userId));
    tokensRemaining = u?.tokens ?? 0;
  } else {
    const [decremented] = await db
      .update(users)
      .set({ cardsTokens: sql`${users.cardsTokens} - 1` })
      .where(and(eq(users.id, auth.userId), sql`${users.cardsTokens} >= 1`))
      .returning({ tokens: users.cardsTokens });
    if (!decremented) {
      return Response.json({ error: "Pas de jeton disponible" }, { status: 400 });
    }
    tokensRemaining = decremented.tokens;
  }

  // Énergie des Gardiens : chargée aux clôtures de séance, et valable pour
  // TOUS les packs jusqu'à la prochaine clôture — rien ne se consomme ici,
  // c'est resetHatForNewSession qui remplace l'énergie à la séance suivante.
  const charges = await loadCharges(auth.userId);
  // Les odds de CE tirage, photographiées : la modale d'ouverture les
  // affiche — l'impact des cartes, noir sur blanc.
  const hatUsed = buildPackHat(charges);
  // Les Skins des gardiens éveillés : le dé de rareté est déformé jusqu'à
  // la prochaine clôture — visible dans oddsUsed comme le reste.
  const rarityShift = skinRarityShiftTenths(charges);
  const hatTotal = Object.values(hatUsed).reduce((a, b) => a + b, 0);
  const oddsUsed = {
    hat: Object.fromEntries(
      Object.entries(hatUsed).map(([k, w]) => [k, hatTotal > 0 ? Math.round((w / hatTotal) * 100) : 0]),
    ),
    innerShift: (charges.inner_pokemon ?? 0) - (charges.inner_animal ?? 0),
    // En dixièmes de point de % par rareté (ex. { common: -60, rare: 50 }).
    rarityShift,
  };
  // Les 3 skins du pack, tirés AVANT la carte — révélés si la carte visée
  // est possédée, mystères (catégorie + rareté + niveau) sinon.
  const packSkins = await drawPackSkins(auth.userId, 3);

  const packType: PackType = DEBUG_FORCE_PACK ?? rollPackTypeFromHat(charges);
  const category = DEBUG_FORCE_ANIMAL
    ? "animal"
    : DEBUG_FORCE_POKEMON
      ? "pokemon"
      : Math.random() < innerPokemonProb(PACK_CATEGORY_PROB_POKEMON[packType], charges)
        ? "pokemon"
        : "animal";
  const cureeCharges = charges.curee ?? 0;
  // Le Pardon des Abysses lira ce type à la clôture : un dernier pack
  // Basique épargne l'énergie de la remise à zéro.
  await db.update(users).set({ lastPackType: packType }).where(eq(users.id, auth.userId));

  if (category === "animal") {
    let picked;
    if (DEBUG_FORCE_ANIMAL) {
      [picked] = await db
        .select()
        .from(animals)
        .where(eq(animals.slug, DEBUG_FORCE_ANIMAL));
      if (!picked) {
        await refund(auth.userId);
        return Response.json(
          { error: `Debug slug not found: ${DEBUG_FORCE_ANIMAL}` },
          { status: 500 },
        );
      }
    } else {
      const rarity = rollRarityForPack(packType, rarityShift);
      const candidates = await db
        .select()
        .from(animals)
        .where(eq(animals.rarity, rarity));
      if (candidates.length === 0) {
        await refund(auth.userId);
        return Response.json({ error: `No animals for rarity ${rarity}` }, { status: 500 });
      }
      picked = candidates[Math.floor(Math.random() * candidates.length)];
    }
    const rarity = picked.rarity as
      | "common"
      | "uncommon"
      | "rare"
      | "epic"
      | "legendary"
      | "mythic";

    const [card] = await db
      .insert(userCards)
      .values({ userId: auth.userId, animalId: picked.id, count: 1 })
      .onConflictDoUpdate({
        target: [userCards.userId, userCards.animalId],
        set: { count: sql`${userCards.count} + 1` },
      })
      .returning();

    const isDuplicate = (card?.count ?? 1) > 1;
    let shardsGranted = 0;
    if (isDuplicate) {
      // La Curée : une charge stockée double le fragment du doublon.
      // La Curée tient jusqu'à la prochaine clôture : pas de décompte ici.
      const bonus = cureeCharges > 0 ? 1 : 0;
      shardsGranted = 1 + bonus;
      await db
        .insert(userShards)
        .values({ userId: auth.userId, rarity, category: "animal", count: shardsGranted })
        .onConflictDoUpdate({
          target: [userShards.userId, userShards.rarity, userShards.category],
          set: { count: sql`${userShards.count} + ${shardsGranted}` },
        });
    }

    // Talent caché : révélé à la première obtention de la carte.
    const talent = !isDuplicate ? talentOf("animal", picked.slug) : null;
    // Les skins mystère qui visaient cette carte se révèlent avec elle.
    const awaitingSkins = !isDuplicate ? await skinsAwaitingFor(auth.userId, "animal", picked.id) : [];

    return Response.json({
      packType,
      category,
      rarity,
      creature: { ...picked, kind: "animal" },
      isDuplicate,
      shardsGranted,
      skins: packSkins,
      awaitingSkins,
      talent: talent
        ? { id: talent.id, family: talent.family, name: talent.name, description: talent.description }
        : null,
      tokens: tokensRemaining,
      oddsUsed,
    });
  }

  // pokemon
  let picked;
  if (DEBUG_FORCE_POKEMON) {
    [picked] = await db
      .select()
      .from(pokemon)
      .where(eq(pokemon.slug, DEBUG_FORCE_POKEMON));
    if (!picked) {
      await refund(auth.userId);
      return Response.json(
        { error: `Debug slug not found: ${DEBUG_FORCE_POKEMON}` },
        { status: 500 },
      );
    }
  } else {
    const rarity = rollRarityForPack(packType, rarityShift);
    const candidates = await db
      .select()
      .from(pokemon)
      .where(eq(pokemon.rarity, rarity));
    if (candidates.length === 0) {
      await refund(auth.userId);
      return Response.json({ error: `No pokemon for rarity ${rarity}` }, { status: 500 });
    }
    picked = candidates[Math.floor(Math.random() * candidates.length)];
  }
  const rarity = picked.rarity as
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mythic";

  const [card] = await db
    .insert(userPokemonCards)
    .values({ userId: auth.userId, pokemonId: picked.id, count: 1 })
    .onConflictDoUpdate({
      target: [userPokemonCards.userId, userPokemonCards.pokemonId],
      set: { count: sql`${userPokemonCards.count} + 1` },
    })
    .returning();

  const isDuplicate = (card?.count ?? 1) > 1;
  let shardsGranted = 0;
  if (isDuplicate) {
    // La Curée tient jusqu'à la prochaine clôture : pas de décompte ici.
    const bonus = cureeCharges > 0 ? 1 : 0;
    shardsGranted = 1 + bonus;
    await db
      .insert(userShards)
      .values({ userId: auth.userId, rarity, category: "pokemon", count: shardsGranted })
      .onConflictDoUpdate({
        target: [userShards.userId, userShards.rarity, userShards.category],
        set: { count: sql`${userShards.count} + ${shardsGranted}` },
      });
  }

  const talent = !isDuplicate ? talentOf("pokemon", picked.slug) : null;
  // Les skins mystère qui visaient cette carte se révèlent avec elle.
  const awaitingSkins = !isDuplicate ? await skinsAwaitingFor(auth.userId, "pokemon", picked.id) : [];

  return Response.json({
    packType,
    category,
    rarity,
    creature: { ...picked, kind: "pokemon" },
    isDuplicate,
    shardsGranted,
    skins: packSkins,
    awaitingSkins,
    talent: talent
      ? { id: talent.id, family: talent.family, name: talent.name, description: talent.description }
      : null,
    tokens: tokensRemaining,
    oddsUsed,
  });
}

async function refund(userId: number) {
  if (DEBUG_FREE_TOKENS) return;
  await db
    .update(users)
    .set({ cardsTokens: sql`${users.cardsTokens} + 1` })
    .where(eq(users.id, userId));
}
