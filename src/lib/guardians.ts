import { db } from "@/lib/db";
import {
  animals,
  cardSkins,
  exercises,
  pokemon,
  sessionCardioDraws,
  sessionExercises,
    sets,
  userCards,
  userCharges,
  userMiracleUses,
  userPokemonCards,
  userShards,
  userSkins,
  users,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Rarity } from "@/lib/rarities";
import {
  DIRECTION_CAPS,
  ENERGY_BY_RARITY,
  cardioDrawCount,
  magnesieOf,
  powerShorts,
  FORGE_THRESHOLD,
  HAT_DIRECTIONS,
  POLARITY_POINTS,
  RECORD_MIN_HISTORY,
  SKIN_DIRECTIONS,
  SKIN_DROP_WEIGHTS,
  WHEEL_SPELLS,
  metierOf,
  miracleOf,
  prodigeOf,
  type Charges,
  type Direction,
  type MascotMode,
} from "@/lib/powers";
import { pickMascotSide } from "@/lib/mascots";

// ─── Résolution des Gardiens (v2) à la clôture de séance ────────────────────
// Une fois par séance, dans le bloc idempotent tokensGrantedAt de terminate.
// Trois étages : la Polarité (± tickets de sa famille, mode au choix du
// joueur), les Prodiges (légendaires, un par carte), les Miracles
// (mythiques, un par carte, limites hebdomadaires). On ouvre son pack après
// la séance : clôturer une nouvelle séance remet d'abord le chapeau à zéro.

export interface AwakenedGuardian {
  exerciseId: number;
  exerciseName: string;
  card: {
    category: "animal" | "pokemon";
    name: string;
    rarity: Rarity;
    imageUrl: string | null;
  };
  powerName: string;
  // Ce que l'éveil a produit, en toutes lettres : "+3 tickets Animal",
  // "1 jeton spécial offert", "rien cette semaine (déjà utilisé)"...
  detail: string;
  record: boolean; // record battu sur SA machine (badge + effets sur record)
  fragmentRarity: Rarity | null;
  // La carte porte la magnésie : ce qu'elle a déposé à cet éveil.
  magnesie?: number;
}

export interface GuardianResolution {
  guardians: AwakenedGuardian[];
  recordCount: number;
  charges: Charges;
  bonusTokens: number; // jetons normaux offerts (Faveur, Grâce, Lame Résolue)
  bonusSpecialTokens: number; // jetons spéciaux offerts (le Vœu)
  magnesieEarned: number; // la poudre déposée par les porteuses éveillées
}

// ─── Chargement et remise à zéro ────────────────────────────────────────────

export async function loadCharges(userId: number): Promise<Charges> {
  const rows = await db
    .select({ direction: userCharges.direction, points: userCharges.points })
    .from(userCharges)
    .where(eq(userCharges.userId, userId));

  const charges: Charges = {};
  for (const r of rows) {
    if (r.points > 0) charges[r.direction as Direction] = r.points;
  }
  return charges;
}

export async function saveCharges(userId: number, charges: Charges) {
  const now = new Date();
  for (const [direction, points] of Object.entries(charges)) {
    await db
      .insert(userCharges)
      .values({ userId, direction, points: points ?? 0, updatedAt: now })
      .onConflictDoUpdate({
        target: [userCharges.userId, userCharges.direction],
        set: { points: points ?? 0, updatedAt: now },
      });
  }
}

// La règle du pack : on ouvre après la séance. Clôturer une NOUVELLE séance
// remet le chapeau à zéro avant la nouvelle récolte — l'énergie de pack non
// dépensée est annulée. Les jauges d'atelier (Forge, Curée, Orpailleur)
// survivent. Pactes : Dialga (Seconde Éternelle) épargne le chapeau une
// fois ; Ouroboros posé → jamais de remise à zéro ; Celebi posé → la
// moitié survit.
const WIPE_DIRECTIONS: Direction[] = [
  ...HAT_DIRECTIONS,
  ...WHEEL_SPELLS,
  ...SKIN_DIRECTIONS,
  "no_basic",
  "hoopa_double",
  "leviathan_guard",
  "banquise",
];

async function resetHatForNewSession(userId: number, charges: Charges) {
  const hasEnergy = WIPE_DIRECTIONS.some((d) => (charges[d] ?? 0) > 0);
  if (!hasEnergy) return;

  const [ouro] = await db
    .select({ id: animals.id })
    .from(animals)
    .where(eq(animals.slug, "ouroboros"));
  const [celebi] = await db
    .select({ id: pokemon.id })
    .from(pokemon)
    .where(eq(pokemon.slug, "celebi"));
  const posted = await db
    .select({ a: exercises.mascotAnimalId, p: exercises.mascotPokemonId })
    .from(exercises)
    .where(eq(exercises.userId, userId));
  if (ouro && posted.some((r) => r.a === ouro.id)) return; // l'Éternel Retour

  // La Seconde Éternelle de Dialga : consommée seulement si elle sert —
  // sous la garde d'Ouroboros, elle reste en réserve.
  if ((charges.time_hold ?? 0) > 0) {
    charges.time_hold = 0;
    return;
  }

  // Le Pardon des Abysses : si le DERNIER pack ouvert était un Basique,
  // Léviathan épargne toute l'énergie de cette remise à zéro — une fois.
  if ((charges.leviathan_guard ?? 0) > 0) {
    const [u] = await db
      .select({ lastPackType: users.lastPackType })
      .from(users)
      .where(eq(users.id, userId));
    if (u?.lastPackType === "basic") {
      charges.leviathan_guard = 0;
      return;
    }
  }

  const half = !!celebi && posted.some((r) => r.p === celebi.id); // le Second Souffle
  // Le Blizzard Gardien : jusqu'à N TICKETS par direction du chapeau
  // survivent à la remise à zéro (les sorts, eux, meurent normalement).
  // Cumulable avec le Second Souffle — la meilleure protection l'emporte.
  const preserve = charges.banquise ?? 0;
  charges.banquise = 0;
  const hatSet = new Set<string>(HAT_DIRECTIONS);
  for (const d of WIPE_DIRECTIONS) {
    const pts = charges[d] ?? 0;
    if (pts <= 0) continue;
    const fromHalf = half ? Math.floor(pts / 2) : 0;
    const fromIce = hatSet.has(d) ? Math.min(pts, preserve) : 0;
    charges[d] = Math.max(fromHalf, fromIce);
  }
}


// ─── Les Skins des gardiens ─────────────────────────────────────────────────
// Le skin équipé d'une carte ne compte que s'il est réellement possédé.
// Map "category:cardId" → niveau (1..5).
async function loadEquippedSkins(userId: number): Promise<Map<string, number>> {
  const rows = (await db.execute(sql`
    SELECT 'animal' AS category, uc.animal_id AS card_id, uc.equipped_skin_level AS level
    FROM user_cards uc
    JOIN card_skins cs ON cs.category = 'animal' AND cs.card_id = uc.animal_id AND cs.level = uc.equipped_skin_level
    JOIN user_skins us ON us.skin_id = cs.id AND us.user_id = uc.user_id
    WHERE uc.user_id = ${userId} AND uc.equipped_skin_level IS NOT NULL
    UNION ALL
    SELECT 'pokemon', up.pokemon_id, up.equipped_skin_level
    FROM user_pokemon_cards up
    JOIN card_skins cs ON cs.category = 'pokemon' AND cs.card_id = up.pokemon_id AND cs.level = up.equipped_skin_level
    JOIN user_skins us ON us.skin_id = cs.id AND us.user_id = up.user_id
    WHERE up.user_id = ${userId} AND up.equipped_skin_level IS NOT NULL
  `)) as unknown as { rows?: { category: string; card_id: number; level: number }[] };
  const list = (rows.rows ?? rows) as unknown as { category: string; card_id: number; level: number }[];
  return new Map(list.map((r) => [`${r.category}:${r.card_id}`, Number(r.level)]));
}

// Les skins du pack : 3 tirages AVANT la carte, sur tout le catalogue
// (cartes possédées ou non), jamais de doublon. Le niveau se mérite
// (poids 40/26/18/11/5) ; la carte visée est au hasard total. Un skin
// d'une carte non possédée reste MYSTÈRE : le serveur ne révèle que
// catégorie + rareté de la carte + niveau — l'identité tombera le jour
// où le joueur tire la carte.
export interface PackSkinDraw {
  level: number;
  category: "animal" | "pokemon";
  cardRarity: string;
  owned: boolean;
  // Présents uniquement si owned (révélé) :
  skinName?: string;
  cardName?: string;
  imageUrl?: string | null;
}

export async function drawPackSkins(userId: number, count = 3): Promise<PackSkinDraw[]> {
  const draws: PackSkinDraw[] = [];
  for (let i = 0; i < count; i++) {
    // Seuls les skins dont l'image est générée entrent dans le chapeau —
    // jamais de placeholder ; le pool grossit au fil de l'usine.
    const levelRows = (await db.execute(sql`
      SELECT cs.level, COUNT(*)::int AS n
      FROM card_skins cs
      WHERE cs.status = 'done' AND cs.image_url IS NOT NULL
      AND cs.id NOT IN (SELECT skin_id FROM user_skins WHERE user_id = ${userId})
      GROUP BY cs.level
    `)) as unknown as { rows?: { level: number }[] };
    const available = ((levelRows.rows ?? levelRows) as unknown as { level: number }[])
      .map((r) => Number(r.level));
    if (available.length === 0) break; // les 10 000 skins sont à lui
    const totalW = available.reduce((a, l) => a + (SKIN_DROP_WEIGHTS[l] ?? 1), 0);
    let roll = Math.random() * totalW;
    let chosenLevel = available[0];
    for (const l of available) {
      roll -= SKIN_DROP_WEIGHTS[l] ?? 1;
      if (roll <= 0) { chosenLevel = l; break; }
    }

    const rows = (await db.execute(sql`
      SELECT cs.id, cs.level, cs.name, cs.image_url, cs.category,
             COALESCE(a.name, p.name) AS card_name,
             COALESCE(a.rarity, p.rarity) AS card_rarity,
             (CASE WHEN cs.category = 'animal'
                   THEN cs.card_id IN (SELECT animal_id FROM user_cards WHERE user_id = ${userId})
                   ELSE cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards WHERE user_id = ${userId}) END) AS owned
      FROM card_skins cs
      LEFT JOIN animals a ON cs.category = 'animal' AND a.id = cs.card_id
      LEFT JOIN pokemon p ON cs.category = 'pokemon' AND p.id = cs.card_id
      WHERE cs.status = 'done' AND cs.image_url IS NOT NULL
      AND cs.id NOT IN (SELECT skin_id FROM user_skins WHERE user_id = ${userId})
      AND cs.level = ${chosenLevel}
      ORDER BY random()
      LIMIT 1
    `)) as unknown as { rows?: Record<string, unknown>[] };
    const [pick] = ((rows.rows ?? rows) as unknown as {
      id: number; level: number; name: string; image_url: string | null;
      category: "animal" | "pokemon"; card_name: string; card_rarity: string; owned: boolean;
    }[]);
    if (!pick) break;
    await db.insert(userSkins).values({ userId, skinId: pick.id }).onConflictDoNothing();
    const owned = Boolean(pick.owned);
    draws.push(
      owned
        ? {
            level: Number(pick.level), category: pick.category, cardRarity: pick.card_rarity,
            owned, skinName: pick.name, cardName: pick.card_name, imageUrl: pick.image_url,
          }
        : { level: Number(pick.level), category: pick.category, cardRarity: pick.card_rarity, owned },
    );
  }
  return draws;
}

// Les skins qui « attendaient » une carte : tirés en mystère avant de la
// posséder, révélés au moment où elle est obtenue.
export interface AwaitingSkin {
  level: number;
  name: string;
  imageUrl: string | null;
}

export async function skinsAwaitingFor(
  userId: number,
  category: "animal" | "pokemon",
  cardId: number,
): Promise<AwaitingSkin[]> {
  const rows = (await db.execute(sql`
    SELECT cs.level, cs.name, cs.image_url
    FROM user_skins us
    JOIN card_skins cs ON cs.id = us.skin_id
    WHERE us.user_id = ${userId} AND cs.category = ${category} AND cs.card_id = ${cardId}
    ORDER BY cs.level
  `)) as unknown as { rows?: { level: number; name: string; image_url: string | null }[] };
  return (((rows.rows ?? rows) as unknown as { level: number; name: string; image_url: string | null }[]) ?? [])
    .map((r) => ({ level: Number(r.level), name: r.name, imageUrl: r.image_url }));
}

// ─── Miracles hebdomadaires ─────────────────────────────────────────────────

function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

// Tente de consommer l'usage hebdomadaire d'un miracle. True = disponible.
async function claimWeekly(userId: number, miracle: string, sessionDate: string) {
  const rows = await db
    .insert(userMiracleUses)
    .values({ userId, miracle, isoWeek: isoWeekStart(sessionDate) })
    .onConflictDoNothing()
    .returning({ id: userMiracleUses.id });
  return rows.length > 0;
}


// ─── L'éveil à polarité, partagé ────────────────────────────────────────────
// Utilisé par les Gardiens posés (commun → épique) ET par les cartes tirées
// de l'Échappée du cardio. Applique le métier de la carte dans le sens
// choisi et raconte le geste.
export function applyPolarityAwakening(params: {
  category: "animal" | "pokemon";
  subtype: string | null;
  pts: number;
  repel: boolean;
  add: (d: Direction, n: number) => void;
}): { powerName: string; detail: string; direction: Direction; metier: ReturnType<typeof metierOf> } {
  const { category, subtype, pts, repel, add } = params;
  const family = category === "animal" ? "Animal" : "Pokémon";
  const metier = metierOf(category, subtype);
  let direction: Direction;
  let powerName = "";
  let detail = "";

  if (metier === "lest") {
    // Le Lest travaille le Basique dans les deux sens.
    direction = repel ? "purge_basic" : "pack_basic";
    add(direction, pts);
    powerName = repel ? "Le Lest — Répulsif" : "Le Lest — Attractif";
    detail = repel
      ? `${pts} ticket${pts > 1 ? "s" : ""} Basique dévoré${pts > 1 ? "s" : ""}`
      : `+${pts} ticket${pts > 1 ? "s" : ""} Basique`;
  } else if (metier === "etincelle") {
    // L'Étincelle sème du Mythique en dixièmes, ou brûle le Basique.
    if (repel) {
      direction = "purge_basic";
      add(direction, pts);
      powerName = "L'Étincelle — Répulsif";
      detail = `${pts} ticket${pts > 1 ? "s" : ""} Basique brûlé${pts > 1 ? "s" : ""}`;
    } else {
      direction = "mythic_sparks";
      add(direction, pts);
      powerName = "L'Étincelle";
      detail = `+${(pts / 10).toFixed(1).replace(".", ",")} ticket Mythique semé`;
    }
  } else if (metier === "balance") {
    // La Balance penche le curseur intérieur des packs mixtes.
    const ownSide: Direction = category === "animal" ? "inner_animal" : "inner_pokemon";
    const otherSide: Direction = category === "animal" ? "inner_pokemon" : "inner_animal";
    direction = repel ? otherSide : ownSide;
    add(direction, pts);
    const target = direction === "inner_animal" ? "les animaux" : "les Pokémon";
    powerName = repel ? "La Balance — Répulsif" : "La Balance — Attractif";
    detail = `curseur des packs mixtes : ${pts} % vers ${target}`;
  } else {
    // La Famille : le pack de sa famille, dans le sens choisi.
    direction = repel
      ? category === "animal" ? "repel_animal" : "repel_pokemon"
      : category === "animal" ? "pack_animal" : "pack_pokemon";
    add(direction, pts);
    powerName = repel ? "La Famille — Répulsif" : "La Famille — Attractif";
    detail = repel
      ? `${pts} ticket${pts > 1 ? "s" : ""} ${family} dévoré${pts > 1 ? "s" : ""}`
      : `+${pts} ticket${pts > 1 ? "s" : ""} ${family}`;
  }
  return { powerName, detail, direction, metier };
}

// ─── Résolution ─────────────────────────────────────────────────────────────

export async function resolveGuardians(params: {
  userId: number;
  sessionId: number;
  sessionDate: string;
  weekPosition: number | null;
}): Promise<GuardianResolution> {
  const { userId, sessionId, sessionDate, weekPosition } = params;

  // 1. Machines gardées de la séance, avec au moins une série.
  const rows = await db
    .select({
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      mascotAnimalId: exercises.mascotAnimalId,
      mascotPokemonId: exercises.mascotPokemonId,
      mascotMode: exercises.mascotMode,
      variantId: sessionExercises.variantId,
      setCount: sql<number>`COUNT(${sets.id})::int`,
      volume: sql<number>`COALESCE(SUM(${sets.weightKg} * ${sets.reps}), 0)::float`,
      maxWeight: sql<number>`COALESCE(MAX(${sets.weightKg}), 0)::float`,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.sessionId, sessionId))
    .groupBy(exercises.id, sessionExercises.id);

  type Entry = {
    exerciseId: number;
    exerciseName: string;
    side: { category: "animal" | "pokemon"; id: number };
    mode: MascotMode;
    variantId: number | null;
    volume: number;
    maxWeight: number;
  };
  const byExercise = new Map<number, Entry>();
  for (const r of rows) {
    if (r.setCount === 0) continue;
    const side = pickMascotSide(r.mascotAnimalId, r.mascotPokemonId);
    if (!side) continue;
    const existing = byExercise.get(r.exerciseId);
    if (existing) {
      existing.volume += r.volume;
      existing.maxWeight = Math.max(existing.maxWeight, r.maxWeight);
    } else {
      byExercise.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        side,
        mode: (r.mascotMode as MascotMode) ?? "attract",
        variantId: r.variantId ?? null,
        volume: r.volume,
        maxWeight: r.maxWeight,
      });
    }
  }
  // Ordre stable (id d'exercice) : l'Écho et les plafonds ne doivent pas
  // dépendre de l'ordre de retour du SQL.
  const entries = [...byExercise.values()].sort((a, b) => a.exerciseId - b.exerciseId);
  const charges = await loadCharges(userId);
  // La remise à zéro frappe à CHAQUE clôture, gardiens ou pas : l'énergie
  // de la séance précédente est annulée avant la nouvelle récolte.
  await resetHatForNewSession(userId, charges);
  if (entries.length === 0) {
    await saveCharges(userId, charges);
    return { guardians: [], recordCount: 0, charges, bonusTokens: 0, bonusSpecialTokens: 0, magnesieEarned: 0 };
  }

  // 2. Cartes gardiennes.
  const animalIds = entries.filter((e) => e.side.category === "animal").map((e) => e.side.id);
  const pokemonIds = entries.filter((e) => e.side.category === "pokemon").map((e) => e.side.id);
  const animalRows = animalIds.length
    ? await db
        .select({ id: animals.id, slug: animals.slug, name: animals.name, rarity: animals.rarity, imageUrl: animals.imageUrl, subtype: animals.lineage })
        .from(animals)
        .where(inArray(animals.id, animalIds))
    : [];
  const pokemonRows = pokemonIds.length
    ? await db
        .select({ id: pokemon.id, slug: pokemon.slug, name: pokemon.name, rarity: pokemon.rarity, imageUrl: pokemon.imageUrl, subtype: pokemon.primaryType })
        .from(pokemon)
        .where(inArray(pokemon.id, pokemonIds))
    : [];
  const cardOf = (e: Entry) =>
    e.side.category === "animal"
      ? animalRows.find((a) => a.id === e.side.id)
      : pokemonRows.find((p) => p.id === e.side.id);

  // 3. Records par (exercice, version) — au moins 3 séances d'historique.
  const pairs = entries.map((e) => ({ exerciseId: e.exerciseId, variantId: e.variantId }));
  const historyRes = (await db.execute(sql`
    WITH wanted(exercise_id, variant_id) AS (
      VALUES ${sql.join(
        pairs.map((p) => sql`(${p.exerciseId}::int, ${p.variantId}::int)`),
        sql`, `,
      )}
    ),
    per_session AS (
      SELECT se.exercise_id, se.variant_id, se.session_id,
             MAX(st.weight_kg) AS maxw,
             SUM(st.weight_kg * st.reps) AS vol
      FROM session_exercises se
      JOIN sessions s ON s.id = se.session_id
      JOIN sets st ON st.session_exercise_id = se.id
      JOIN wanted w ON w.exercise_id = se.exercise_id
                   AND se.variant_id IS NOT DISTINCT FROM w.variant_id
      WHERE s.user_id = ${userId}
        AND se.session_id != ${sessionId}
        AND st.weight_kg IS NOT NULL
      GROUP BY se.exercise_id, se.variant_id, se.session_id
    )
    SELECT exercise_id, variant_id,
      COUNT(*)::int AS prior_sessions,
      COALESCE(MAX(maxw), 0)::float AS best_weight,
      COALESCE(MAX(vol), 0)::float AS best_volume
    FROM per_session
    GROUP BY exercise_id, variant_id
  `)) as unknown as { rows?: Record<string, unknown>[] };
  const histRows = (historyRes.rows ?? historyRes) as unknown as {
    exercise_id: number;
    variant_id: number | null;
    prior_sessions: number;
    best_weight: number;
    best_volume: number;
  }[];
  const histKey = (ex: number, v: number | null) => `${ex}:${v ?? 0}`;
  const history = new Map(histRows.map((h) => [histKey(h.exercise_id, h.variant_id), h]));

  // 4. Résolution. Les effets s'appliquent via un petit interprète : chaque
  // éveil produit des deltas de charges et/ou des gains immédiats.
  const guardians: AwakenedGuardian[] = [];
  let recordCount = 0;
  let bonusTokens = 0;
  let bonusSpecialTokens = 0;
  let magnesieEarned = 0;
  const deltas: Charges = {};
  const fragments: { rarity: Rarity; category: "animal" | "pokemon"; count: number }[] = [];
  const add = (d: Direction, n: number) => {
    deltas[d] = (deltas[d] ?? 0) + n;
  };

  // Arceus bénit les ± ; l'Écho imite le plus fort. Deux passes : d'abord
  // repérer Arceus et calculer les ± de base, puis appliquer.
  const arceusAwake = entries.some((e) => {
    const c = cardOf(e);
    return c?.slug === "arceus";
  });

  type Planned = {
    e: Entry;
    card: NonNullable<ReturnType<typeof cardOf>>;
    isRecord: boolean;
  };
  const planned: Planned[] = [];
  for (const e of entries) {
    const card = cardOf(e);
    if (!card) continue;
    const h = history.get(histKey(e.exerciseId, e.variantId));
    const isRecord =
      !!h &&
      h.prior_sessions >= RECORD_MIN_HISTORY &&
      (e.maxWeight > h.best_weight || e.volume > h.best_volume);
    if (isRecord) recordCount++;
    planned.push({ e, card, isRecord });
  }

  // Le geste ± le plus fort de la séance, pour l'Écho.
  let strongestPolarity: { direction: Direction; points: number } | null = null;

  // Les Skins : chaque gardien éveillé portant son skin équipé déforme le
  // dé de rareté des packs jusqu'à la prochaine clôture.
  const equippedSkins = await loadEquippedSkins(userId);

  for (const { e, card, isRecord } of planned) {
    const rarity = card.rarity as Rarity;
    const g: AwakenedGuardian = {
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      card: { category: e.side.category, name: card.name, rarity, imageUrl: card.imageUrl },
      powerName: "",
      detail: "",
      record: isRecord,
      fragmentRarity: null,
    };

    const skinLevel = equippedSkins.get(`${e.side.category}:${e.side.id}`);
    if (skinLevel) add(`skin_l${skinLevel}` as Direction, 1);

    if (rarity !== "legendary" && rarity !== "mythic") {
      // ── Étage 1 : la Polarité, selon le métier de la carte ──
      const pts = (POLARITY_POINTS[rarity] ?? 1) + (arceusAwake ? 1 : 0);
      const awakening = applyPolarityAwakening({
        category: e.side.category,
        subtype: card.subtype,
        pts,
        repel: e.mode === "repel",
        add,
      });
      g.powerName = awakening.powerName;
      g.detail = awakening.detail;
      const { direction, metier } = awakening;

      // L'Écho des meutes légendaires imite les gestes de Famille uniquement
      // — les curseurs et étincelles ne se copient pas.
      if (
        (metier === "famille" || metier === "lest") &&
        (!strongestPolarity || pts > strongestPolarity.points)
      ) {
        strongestPolarity = { direction, points: pts };
      }
    } else if (rarity === "legendary") {
      // ── Étage 2 : les Prodiges — un pouvoir unique par carte ──
      const prodige = prodigeOf(e.side.category, card.slug);
      if (!prodige) {
        g.powerName = "Prodige endormi";
        g.detail = "cette carte n'a pas encore reçu son prodige";
      } else {
        g.powerName = prodige.name;
        const weeklyOk = prodige.weekly
          ? await claimWeekly(userId, `prodige-${prodige.id}`, sessionDate)
          : true;
        if (!weeklyOk) {
          g.detail = "déjà accompli cette semaine";
        } else {
          const applyAdd = (adds: Partial<Record<Direction, number>>) => {
            for (const [d, n] of Object.entries(adds) as [Direction, number][]) add(d, n);
          };
          const fx = prodige.effect;
          switch (fx.kind) {
            case "hat":
              applyAdd(fx.add);
              g.detail = fx.detail;
              break;
            case "token":
              if (Math.random() < fx.chance) {
                bonusTokens += 1;
                g.detail = fx.win;
              } else {
                g.detail = fx.miss;
              }
              break;
            case "fragment":
              if (!fx.needRecord || isRecord) {
                fragments.push({ rarity: fx.rarity, category: fx.fragCategory, count: fx.count });
                g.fragmentRarity = fx.rarity;
                g.detail = fx.detail;
              } else {
                g.detail = fx.wait ?? "il attend son heure";
              }
              break;
            case "weekpos":
              if (weekPosition === fx.position) {
                applyAdd(fx.add);
                g.detail = fx.detail;
              } else {
                g.detail = fx.wait;
              }
              break;
            case "record":
              if (isRecord) {
                applyAdd(fx.add);
                g.detail = fx.detail;
              } else {
                g.detail = fx.wait;
              }
              break;
            case "chaos": {
              const pick = fx.pool[Math.floor(Math.random() * fx.pool.length)];
              applyAdd(pick.add);
              g.detail = pick.detail;
              break;
            }
            case "echo":
              if (strongestPolarity) {
                add(strongestPolarity.direction, strongestPolarity.points);
                g.detail = `imite le plus fort : ${strongestPolarity.points} tickets`;
              } else {
                applyAdd(fx.fallback.add);
                g.detail = fx.fallback.detail;
              }
              break;
          }
        }
      }
    } else {
      // ── Étage 3 : les Miracles ──
      const miracle = miracleOf(e.side.category, card.slug);
      if (!miracle) {
        g.powerName = "Miracle endormi";
        g.detail = "cette carte n'a pas encore reçu son miracle";
      } else {
        g.powerName = miracle.name;
        // Les hebdomadaires CONDITIONNELS (Qilin, Victini, Keldeo) ne
        // brûlent leur usage de la semaine que si leur condition est
        // remplie — sinon un éveil « à vide » rendrait le pouvoir
        // inatteignable (« déjà accompli » sans avoir rien donné).
        const weeklyCondition =
          miracle.id === "pas-fortune"
            ? weekPosition === 1
            : miracle.id === "victoire-ecrite"
              ? recordCount > 0
              : miracle.id === "lame-resolue"
                ? weekPosition === 4
                : true;
        const weeklyOk =
          miracle.weekly && weeklyCondition
            ? await claimWeekly(userId, miracle.id, sessionDate)
            : true;
        if (!weeklyOk) {
          g.detail = "déjà accompli cette semaine";
        } else {
          switch (miracle.id) {
            case "gueule":
              add("purge_basic", 6);
              g.detail = "6 tickets Basique dévorés";
              break;
            case "eternel-retour":
              g.detail = "ton énergie échappe à la remise à zéro, pour toujours";
              break;
            case "etreinte-monde":
              add("pack_animal", 3);
              add("pack_pokemon", 3);
              g.detail = "+3 tickets Animal et +3 Pokémon";
              break;
            case "festin-songes":
              add("wheel_min2", 1);
              g.detail = "ta prochaine roue : le ×1 devient ×2";
              break;
            case "tetes-sans-nombre":
              add("pack_animal", 3);
              add("pack_pokemon", 3);
              add("pack_premium", 3);
              g.detail = "+3 tickets Animal, Pokémon et Premium";
              break;
            case "mere-des-dragons":
              add("pack_mythic", 3);
              g.detail = "+3 tickets Mythique";
              break;
            case "pardon-abysses":
              add("leviathan_guard", 1);
              g.detail = "un pack Basique ne consommera pas tes tickets";
              break;
            case "ombre-des-ailes":
              add("no_basic", 2);
              g.detail = "ton prochain pack refuse d'être Basique (deux fois)";
              break;
            case "copeaux":
              fragments.push({ rarity: "common", category: "animal", count: 2 });
              g.detail = "2 fragments communs offerts";
              break;
            case "premier-feu":
              add("pack_premium", 5);
              g.detail = "+5 tickets Premium";
              break;
            case "huit-tetes":
              add("pack_animal", 2);
              add("pack_pokemon", 2);
              add("pack_premium", 2);
              add("wheel_x3", 2);
              g.detail = "+2 tickets sur quatre portes à la fois";
              break;
            case "colere-du-pere":
              add("wheel_34", 1);
              g.detail = "ta prochaine roue : ×3 ou ×4, rien d'autre";
              break;
            case "devoreur-soleil":
              add("purge_basic", 5);
              add("repel_animal", 3);
              g.detail = "5 Basique et 3 Animal dévorés";
              break;
            case "grace":
              bonusTokens += 1;
              g.detail = "1 jeton offert";
              break;
            case "pas-fortune":
              if (weekPosition === 1) {
                add("qilin_wheel", 1);
                g.detail = "ta prochaine roue : ×2 / ×3 / ×4 / ×10";
              } else {
                g.detail = "il n'accorde son pas qu'à la première séance de la semaine";
              }
              break;
            case "voeu":
              bonusSpecialTokens += 1;
              g.detail = "1 jeton spécial offert — la roue t'attend";
              break;
            case "origine":
              if (e.mode === "repel") {
                add("purge_basic", 13);
                g.detail = "13 tickets Basique dévorés";
              } else {
                add("pack_pokemon", 13);
                g.detail = "+13 tickets Pokémon";
              }
              break;
            case "passe-mondes":
              add("hoopa_double", 1);
              g.detail = "ta prochaine ouverture tirera deux packs, garde le meilleur";
              break;
            case "gratitude":
              fragments.push({ rarity: "uncommon", category: "pokemon", count: 1 });
              g.detail = "1 fragment peu commun offert";
              break;
            case "nuit-devorante":
              add("purge_basic", 4);
              add("repel_animal", 4);
              g.detail = "4 Basique et 4 Animal dévorés";
              break;
            case "chant-des-flots":
              add("pack_pokemon", 8);
              g.detail = "+8 tickets Pokémon";
              break;
            case "victoire-ecrite":
              if (recordCount > 0) {
                fragments.push({ rarity: "rare", category: "pokemon", count: 1 });
                g.fragmentRarity = "rare";
                g.detail = "record de la semaine gravé — 1 fragment rare";
              } else {
                g.detail = "il attend ton premier record de la semaine";
              }
              break;
            case "coeur-diamant":
              add("orpailleur", 1);
              g.detail = "ta prochaine conversion rapportera +1 jeton";
              break;
            case "forge-vivante":
              add("forge", FORGE_THRESHOLD);
              g.detail = "Forge remplie — la Roue de la Forge t'attend dans la Collection";
              break;
            case "second-souffle":
              g.detail = "la moitié de ton énergie survivra à chaque remise à zéro";
              break;
            case "adn-instable": {
              const roll = Math.random();
              const target: Direction =
                roll < 0.4 ? "pack_pokemon" : roll < 0.7 ? "pack_animal" : roll < 0.95 ? "pack_premium" : "pack_mythic";
              // Le Mythique est plafonné à 9 : on donne le plafond, et on
              // l'affiche tel quel plutôt que de promettre 13 fantômes.
              const amount = target === "pack_mythic" ? 9 : 13;
              add(target, amount);
              g.detail = `mutation : +${amount} vers ${target === "pack_mythic" ? "le Mythique ! (le plafond)" : target === "pack_premium" ? "le Premium" : target === "pack_animal" ? "l'Animal" : "le Pokémon"}`;
              break;
            }
            case "aria":
              add("wheel_x3", 6);
              g.detail = "+6 tickets sur la case ×3 de la roue";
              break;
            case "alpha-omega":
              g.detail = "chaque autre Gardien ± de la séance compte +1";
              break;
            case "lame-resolue":
              if (weekPosition === 4) {
                bonusTokens += 1;
                g.detail = "4ᵉ séance de la semaine — 1 jeton offert";
              } else {
                g.detail = "il salue la discipline à la 4ᵉ séance de la semaine";
              }
              break;
            case "vapeur-sacree":
              add("purge_basic", 4);
              add("pack_premium", 4);
              g.detail = "4 Basique transmutés en 4 Premium";
              break;
            default:
              g.detail = "miracle inconnu";
          }
        }
      }
    }
    // La Magnésie : si la carte est porteuse, elle dépose sa poudre en
    // plus de son pouvoir — quel que soit son étage.
    const dust = magnesieOf(e.side.category, card.slug, rarity);
    if (dust) {
      g.magnesie = dust;
      magnesieEarned += dust;
      g.detail = g.detail ? `${g.detail} · +${dust} magnésie` : `+${dust} magnésie`;
    }
    guardians.push(g);
  }

  // 5. Crédit des charges, avec plafonds.
  for (const [d, delta] of Object.entries(deltas) as [Direction, number][]) {
    charges[d] = Math.min(DIRECTION_CAPS[d], Math.max(0, (charges[d] ?? 0) + delta));
  }
  await saveCharges(userId, charges);

  // 6. Fragments offerts.
  for (const f of fragments) {
    await db
      .insert(userShards)
      .values({ userId, rarity: f.rarity, category: f.category, count: f.count })
      .onConflictDoUpdate({
        target: [userShards.userId, userShards.rarity, userShards.category],
        set: { count: sql`${userShards.count} + ${f.count}` },
      });
  }

  // 7. Jetons offerts (Faveur, Grâce, Lame Résolue, le Vœu).
  if (bonusTokens > 0) {
    await db
      .update(users)
      .set({ cardsTokens: sql`${users.cardsTokens} + ${bonusTokens}` })
      .where(eq(users.id, userId));
  }
  if (bonusSpecialTokens > 0) {
    await db
      .update(users)
      .set({ cardsSpecialTokens: sql`${users.cardsSpecialTokens} + ${bonusSpecialTokens}` })
      .where(eq(users.id, userId));
  }
  if (magnesieEarned > 0) {
    await db
      .update(users)
      .set({ magnesie: sql`${users.magnesie} + ${magnesieEarned}` })
      .where(eq(users.id, userId));
  }

  // 8. La mémoire : qui gardait quelle machine à CETTE clôture — pour que
  // l'historique montre le bon Gardien même après un changement de carte.
  for (const e of entries) {
    await db
      .update(sessionExercises)
      .set({
        guardianCategory: e.side.category,
        guardianCardId: e.side.id,
        guardianMode: e.mode,
      })
      .where(
        and(
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.exerciseId, e.exerciseId),
        ),
      );
  }

  // 9. Compteur d'éveils (talents évolutifs : la Légende de la Carpe...).
  const awakenedIds = guardians.map((g) => g.exerciseId);
  if (awakenedIds.length > 0) {
    await db
      .update(exercises)
      .set({ mascotTriggers: sql`${exercises.mascotTriggers} + 1` })
      .where(inArray(exercises.id, awakenedIds));
  }

  return { guardians, recordCount, charges, bonusTokens, bonusSpecialTokens, magnesieEarned };
}

// ─── Le Gardien lié ─────────────────────────────────────────────────────────
// Depuis son premier éveil, un Gardien est lié à sa machine : pour le
// libérer, attendre 30 jours depuis la pose… ou payer sa magnésie. Rien
// d'autre — pas même un record.

export async function guardianBondStatus(
  exerciseId: number,
  userId: number,
): Promise<{ locked: boolean; unlockAt: string | null; grace: boolean }> {
  const [ex] = await db
    .select({
      assignedAt: exercises.mascotAssignedAt,
      mascotAnimalId: exercises.mascotAnimalId,
      mascotPokemonId: exercises.mascotPokemonId,
      mascotTriggers: exercises.mascotTriggers,
    })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)));

  // Pas de gardien, ou pose antérieure à la règle : libre.
  if (!ex || (!ex.mascotAnimalId && !ex.mascotPokemonId) || !ex.assignedAt) {
    return { locked: false, unlockAt: null, grace: false };
  }

  const assignedAt = new Date(ex.assignedAt);
  const unlockDate = new Date(assignedAt.getTime() + 30 * 86400000);
  const unlockAt = unlockDate.toISOString().slice(0, 10);

  // La période de grâce : le lien ne se noue qu'au premier éveil. Tant que
  // la carte n'a pas travaillé, on peut encore changer d'avis.
  if ((ex.mascotTriggers ?? 0) === 0) {
    return { locked: false, unlockAt, grace: true };
  }

  if (Date.now() >= unlockDate.getTime()) return { locked: false, unlockAt: null, grace: false };
  return { locked: true, unlockAt, grace: false };
}

// ─── L'Échappée ─────────────────────────────────────────────────────────────
// Sur les machines de cardio, chaque quart d'heure ENTAMÉ après le premier
// tire une carte au hasard dans la réserve — les cartes possédées qui ne
// gardent aucune machine. Le joueur les place ensuite en attractif ou
// répulsif dans la cérémonie de clôture : leur éveil s'applique alors.

export interface CardioDraw {
  drawId: number;
  card: {
    category: "animal" | "pokemon";
    name: string;
    rarity: Rarity;
    imageUrl: string | null;
  };
  // Ce que fera chaque sens, en trois mots — le joueur choisit en sachant.
  attract: string;
  repel: string;
}

// Appelé une seule fois, dans le bloc idempotent de terminate.
export async function drawCardioReserves(
  userId: number,
  sessionId: number,
): Promise<CardioDraw[]> {
  // Minutes de cardio par machine de la séance.
  const res = (await db.execute(sql`
    SELECT se.exercise_id, COALESCE(SUM(st.duration_minutes), 0)::int AS minutes
    FROM session_exercises se
    JOIN sets st ON st.session_exercise_id = se.id
    WHERE se.session_id = ${sessionId} AND st.duration_minutes IS NOT NULL
    GROUP BY se.exercise_id
  `)) as unknown as { rows?: { minutes: number }[] };
  const rows = ((res.rows ?? res) as unknown as { minutes: number }[]) ?? [];
  const wanted = rows.reduce((n, r) => n + cardioDrawCount(r.minutes), 0);
  if (wanted === 0) return [];

  // La réserve : cartes possédées qui ne gardent aucune machine.
  const posted = await db
    .select({ a: exercises.mascotAnimalId, p: exercises.mascotPokemonId })
    .from(exercises)
    .where(eq(exercises.userId, userId));
  const postedAnimals = new Set(posted.map((r) => r.a).filter((x): x is number => x != null));
  const postedPokemon = new Set(posted.map((r) => r.p).filter((x): x is number => x != null));

  const ownedAnimals = await db
    .select({ id: animals.id, name: animals.name, rarity: animals.rarity, imageUrl: animals.imageUrl, subtype: animals.lineage })
    .from(userCards)
    .innerJoin(animals, eq(userCards.animalId, animals.id))
    .where(eq(userCards.userId, userId));
  const ownedPokemon = await db
    .select({ id: pokemon.id, name: pokemon.name, rarity: pokemon.rarity, imageUrl: pokemon.imageUrl, subtype: pokemon.primaryType })
    .from(userPokemonCards)
    .innerJoin(pokemon, eq(userPokemonCards.pokemonId, pokemon.id))
    .where(eq(userPokemonCards.userId, userId));

  const pool: { category: "animal" | "pokemon"; id: number; name: string; rarity: Rarity; imageUrl: string | null; subtype: string | null }[] = [
    ...ownedAnimals
      .filter((c) => !postedAnimals.has(c.id))
      .map((c) => ({ category: "animal" as const, id: c.id, name: c.name, rarity: c.rarity as Rarity, imageUrl: c.imageUrl, subtype: c.subtype })),
    ...ownedPokemon
      .filter((c) => !postedPokemon.has(c.id))
      .map((c) => ({ category: "pokemon" as const, id: c.id, name: c.name, rarity: c.rarity as Rarity, imageUrl: c.imageUrl, subtype: c.subtype })),
  ];
  if (pool.length === 0) return [];

  // Mélange de Fisher-Yates, puis on prend ce que la réserve peut donner.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, Math.min(wanted, pool.length));

  const draws: CardioDraw[] = [];
  for (const c of picked) {
    const [row] = await db
      .insert(sessionCardioDraws)
      .values({ sessionId, userId, cardCategory: c.category, cardId: c.id })
      .returning({ id: sessionCardioDraws.id });
    const shorts = powerShorts(c.category, c.subtype, c.rarity);
    draws.push({
      drawId: row.id,
      card: { category: c.category, name: c.name, rarity: c.rarity, imageUrl: c.imageUrl },
      attract: shorts.attract,
      repel: shorts.repel,
    });
  }
  return draws;
}

// Les tirages encore en attente de placement (pour re-proposer après reload).
export async function pendingCardioDraws(
  userId: number,
  sessionId: number,
): Promise<CardioDraw[]> {
  const rows = await db
    .select({
      id: sessionCardioDraws.id,
      category: sessionCardioDraws.cardCategory,
      cardId: sessionCardioDraws.cardId,
    })
    .from(sessionCardioDraws)
    .where(
      and(
        eq(sessionCardioDraws.sessionId, sessionId),
        eq(sessionCardioDraws.userId, userId),
        isNull(sessionCardioDraws.resolvedAt),
      ),
    );
  const draws: CardioDraw[] = [];
  for (const r of rows) {
    const card =
      r.category === "animal"
        ? (await db.select({ name: animals.name, rarity: animals.rarity, imageUrl: animals.imageUrl, subtype: animals.lineage }).from(animals).where(eq(animals.id, r.cardId)))[0]
        : (await db.select({ name: pokemon.name, rarity: pokemon.rarity, imageUrl: pokemon.imageUrl, subtype: pokemon.primaryType }).from(pokemon).where(eq(pokemon.id, r.cardId)))[0];
    if (!card) continue;
    const shorts = powerShorts(r.category as "animal" | "pokemon", card.subtype ?? null, card.rarity as Rarity);
    draws.push({
      drawId: r.id,
      card: { category: r.category as "animal" | "pokemon", name: card.name, rarity: card.rarity as Rarity, imageUrl: card.imageUrl },
      attract: shorts.attract,
      repel: shorts.repel,
    });
  }
  return draws;
}

export interface DraftAwakening {
  card: { category: "animal" | "pokemon"; name: string; rarity: Rarity; imageUrl: string | null };
  powerName: string;
  detail: string;
  magnesie?: number;
}

// Le placement : chaque carte tirée s'éveille dans le sens choisi. Les
// grandes cartes (légendaire, mythique) pèsent leur rang — ±8 et ±13 —
// via le métier Famille : l'Échappée est un geste de tickets, pas un
// second éveil de prodige.
export async function resolveCardioDraft(
  userId: number,
  sessionId: number,
  choices: { drawId: number; mode: MascotMode }[],
): Promise<{ awakenings: DraftAwakening[]; charges: Charges; magnesieEarned: number }> {
  const awakenings: DraftAwakening[] = [];
  const deltas: Charges = {};
  let magnesieEarned = 0;
  const add = (d: Direction, n: number) => {
    deltas[d] = (deltas[d] ?? 0) + n;
  };

  for (const choice of choices) {
    if (choice.mode !== "attract" && choice.mode !== "repel") continue;
    // Claim d'abord : chaque tirage ne se résout qu'une seule fois.
    const claimed = await db
      .update(sessionCardioDraws)
      .set({ mode: choice.mode, resolvedAt: new Date() })
      .where(
        and(
          eq(sessionCardioDraws.id, choice.drawId),
          eq(sessionCardioDraws.sessionId, sessionId),
          eq(sessionCardioDraws.userId, userId),
          isNull(sessionCardioDraws.resolvedAt),
        ),
      )
      .returning({ category: sessionCardioDraws.cardCategory, cardId: sessionCardioDraws.cardId });
    if (claimed.length === 0) continue;

    const { category, cardId } = claimed[0];
    const card =
      category === "animal"
        ? (await db.select({ name: animals.name, slug: animals.slug, rarity: animals.rarity, imageUrl: animals.imageUrl, subtype: animals.lineage }).from(animals).where(eq(animals.id, cardId)))[0]
        : (await db.select({ name: pokemon.name, slug: pokemon.slug, rarity: pokemon.rarity, imageUrl: pokemon.imageUrl, subtype: pokemon.primaryType }).from(pokemon).where(eq(pokemon.id, cardId)))[0];
    if (!card) continue;

    const rarity = card.rarity as Rarity;
    const big = rarity === "legendary" || rarity === "mythic";
    const pts = big ? ENERGY_BY_RARITY[rarity] : (POLARITY_POINTS[rarity] ?? 1);
    const a = applyPolarityAwakening({
      category: category as "animal" | "pokemon",
      // Les grandes cartes pèsent en Famille, les autres suivent leur métier.
      subtype: big ? null : (card.subtype ?? null),
      pts,
      repel: choice.mode === "repel",
      add,
    });
    const dust = magnesieOf(category as "animal" | "pokemon", card.slug, rarity);
    if (dust) magnesieEarned += dust;
    awakenings.push({
      card: { category: category as "animal" | "pokemon", name: card.name, rarity, imageUrl: card.imageUrl },
      powerName: `L'Échappée — ${a.powerName}`,
      detail: dust ? `${a.detail} · +${dust} magnésie` : a.detail,
      magnesie: dust ?? undefined,
    });
  }

  const charges = await loadCharges(userId);
  for (const [d, delta] of Object.entries(deltas) as [Direction, number][]) {
    charges[d] = Math.min(DIRECTION_CAPS[d], Math.max(0, (charges[d] ?? 0) + delta));
  }
  await saveCharges(userId, charges);
  if (magnesieEarned > 0) {
    await db
      .update(users)
      .set({ magnesie: sql`${users.magnesie} + ${magnesieEarned}` })
      .where(eq(users.id, userId));
  }
  return { awakenings, charges, magnesieEarned };
}
