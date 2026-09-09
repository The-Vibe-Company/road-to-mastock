import {
  pgTable,
  serial,
  text,
  integer,
  real,
  date,
  timestamp,
  boolean,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  accentColor: text("accent_color").default("orange"),
  // La Magnésie : la poudre qui délie les Gardiens, gagnée par les éveils
  // des cartes porteuses (~10 % du catalogue, tirées au sort).
  magnesie: integer("magnesie").notNull().default(0),
  theme: text("theme").default("dark"),
  cardsTokens: integer("cards_tokens").notNull().default(0),
  cardsSpecialTokens: integer("cards_special_tokens").notNull().default(0),
  // Le type du dernier pack ouvert — le Pardon des Abysses (Léviathan) le lit
  // à la clôture : un dernier pack Basique épargne l'énergie de la remise à zéro.
  lastPackType: text("last_pack_type"),
  // ── Privilèges des Talents cachés ──
  // Totem (aura de Typhon) : carte affichée à côté du nom chez les amis.
  totemCategory: text("totem_category"),
  totemCardId: integer("totem_card_id"),
  // Titre (aura du Dragon ancestral) : affiché sous le nom.
  title: text("title"),
  // Objectif hebdo (aura de Keldeo) : nombre de séances visé par semaine.
  weeklyGoal: integer("weekly_goal"),
  // Talents déjà présentés à la reconnexion (ids séparés par des virgules) :
  // l'annonce « tes cartes cachaient des pouvoirs » ne se répète pas.
  announcedTalents: text("announced_talents"),
  // Trophées déjà annoncés à la clôture de séance (ids séparés par des
  // virgules) — un trophée ne se célèbre qu'une fois.
  announcedTrophies: text("announced_trophies"),
  // L'Étendard (trophée) : la carte en bannière sur la home.
  bannerCategory: text("banner_category"),
  bannerCardId: integer("banner_card_id"),
  // Trônes : fond d'écran choisi par page (id de talent, null = aucun).
  wallpaperHome: text("wallpaper_home"),
  wallpaperSession: text("wallpaper_session"),
  wallpaperCollection: text("wallpaper_collection"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Catalogue de référence, sans propriétaire. Il n'est jamais affiché tel quel :
// il sert uniquement à pré-remplir le catalogue perso d'un nouvel inscrit.
export const exerciseCatalog = pgTable("exercise_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  kind: text("kind").notNull().default("muscu"),
  isAssisted: boolean("is_assisted").notNull().default(false),
  muscleGroup: text("muscle_group"),
  muscleGroups: text("muscle_groups").array(),
});

// Chaque exercice appartient à un utilisateur : le renommer n'affecte que lui.
// Deux utilisateurs peuvent avoir un exercice du même nom, d'où l'unicité sur
// (user_id, name) et non sur name seul.
export const exercises = pgTable(
  "exercises",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'muscu' | 'cardio'. Drives which set fields (weight/reps vs duration/calories/...) apply.
    kind: text("kind").notNull().default("muscu"),
    // Exercices à assistance (tractions/dips assistés) : l'utilisateur saisit
    // l'aide en kg, le poids effectif soulevé est session.bodyweightKg − assistance.
    isAssisted: boolean("is_assisted").notNull().default(false),
    muscleGroup: text("muscle_group"),
    muscleGroups: text("muscle_groups").array(),
    // Machine dont le réglage change d'une salle à l'autre (poulies, etc.) :
    // chaque séance de cet exercice est rattachée à une version, et records,
    // paliers et dernière perf sont calculés version par version.
    hasVariants: boolean("has_variants").notNull().default(false),
    // Mascotte de la machine : une carte possédée, affichée en filigrane
    // derrière le bloc pendant la séance. Au plus une des deux colonnes est
    // remplie ; les deux nulles = pas de mascotte. Pas de user_id ici non
    // plus : exercise_id désigne déjà un exercice possédé.
    mascotAnimalId: integer("mascot_animal_id").references(() => animals.id, {
      onDelete: "set null",
    }),
    mascotPokemonId: integer("mascot_pokemon_id").references(() => pokemon.id, {
      onDelete: "set null",
    }),
    // Nombre de fois où le gardien de cette machine s'est éveillé (série
    // faite + séance clôturée). Alimente la Fidélité des Domestiques et
    // certains talents. Remis à zéro quand la mascotte change de carte.
    mascotTriggers: integer("mascot_triggers").notNull().default(0),
    // Date de pose du gardien actuel. Un gardien posé est lié : pour en
    // changer il faut battre son record sur la machine (charge max ou
    // volume) depuis la pose, ou attendre 30 jours. Null = pas de lien
    // (pas de gardien, ou pose antérieure à la règle).
    mascotAssignedAt: timestamp("mascot_assigned_at", { withTimezone: true }),
    // Polarité du gardien (cartes sous légendaire uniquement) : 'attract'
    // ajoute des tickets du pack de sa famille, 'repel' en retire. Choisie
    // par le joueur, modifiable à tout moment.
    mascotMode: text("mascot_mode").notNull().default("attract"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.name)]
);

// Versions d'un exercice — en pratique la salle ("Bercy", "Nation").
export const exerciseVariants = pgTable(
  "exercise_variants",
  {
    id: serial("id").primaryKey(),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.exerciseId, t.name)]
);

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull().defaultNow(),
  notes: text("notes"),
  // Poids de corps du jour, utilisé par les exos assistés
  // (weight_kg = bodyweight_kg - sets.assistance_kg).
  bodyweightKg: real("bodyweight_kg"),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  tokensGrantedAt: timestamp("tokens_granted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sessionExercises = pgTable("session_exercises", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  // Version utilisée ce jour-là. Null sur les exercices sans versions.
  variantId: integer("variant_id").references(() => exerciseVariants.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").default(0),
  // La mémoire des Gardiens : la carte qui gardait la machine au moment
  // de la clôture — l'historique ne réécrit pas le passé.
  guardianCategory: text("guardian_category"),
  guardianCardId: integer("guardian_card_id"),
  guardianMode: text("guardian_mode"),
  locked: boolean("locked").default(false).notNull(),
  notes: text("notes"),
});

export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  addresseeId: integer("addressee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Paliers de poids d'une machine. Pas de user_id : `exercise_id` désigne déjà
// un exercice possédé, donc les paliers sont per-user par construction.
export const exerciseWeights = pgTable(
  "exercise_weights",
  {
    id: serial("id").primaryKey(),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    // Les plaques diffèrent d'une salle à l'autre : les paliers sont donc
    // rattachés à la version quand l'exercice en a une.
    variantId: integer("variant_id").references(() => exerciseVariants.id, {
      onDelete: "cascade",
    }),
    weightKg: real("weight_kg").notNull(),
  },
  // Deux index : Postgres considère les NULL comme distincts, donc l'unicité
  // sur (exercice, version, poids) ne couvrirait pas les paliers sans version.
  (t) => [
    uniqueIndex("exercise_weights_exercise_variant_weight_idx").on(
      t.exerciseId,
      t.variantId,
      t.weightKg
    ),
    uniqueIndex("exercise_weights_exercise_weight_no_variant_idx")
      .on(t.exerciseId, t.weightKg)
      .where(sql`variant_id is null`),
  ]
);

export const sets = pgTable("sets", {
  id: serial("id").primaryKey(),
  sessionExerciseId: integer("session_exercise_id")
    .notNull()
    .references(() => sessionExercises.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  // Muscu fields — null on cardio sets.
  weightKg: real("weight_kg"),
  reps: integer("reps"),
  // Cardio fields — null on muscu sets. Always present together for cardio.
  durationMinutes: integer("duration_minutes"),
  calories: integer("calories"),
  // Per-machine cardio detail (all nullable, only relevant for some machines).
  distanceKm: real("distance_km"),
  avgSpeedKmh: real("avg_speed_kmh"),
  resistanceLevel: integer("resistance_level"),
  // Pour les exos assistés : aide en kg saisie. weight_kg est calculé côté
  // serveur comme session.bodyweight_kg - assistance_kg.
  assistanceKg: real("assistance_kg"),
});

export const animals = pgTable("animals", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  rarity: text("rarity").notNull(),
  // Lignée du gardien (felins, rapaces, meutes, troupeaux, nuees,
  // domestiques, colosses, abyssaux, polaires, anciens). Détermine le
  // pouvoir de la carte quand elle garde une machine. Assignée par script.
  lineage: text("lineage"),
  cardNumber: integer("card_number"),
  scientificName: text("scientific_name"),
  imageUrl: text("image_url"),
  description: text("description"),
  flavor: text("flavor"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  habitat: text("habitat"),
});

export const userCards = pgTable(
  "user_cards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    animalId: integer("animal_id")
      .notNull()
      .references(() => animals.id),
    count: integer("count").notNull().default(1),
    // Le skin équipé pour cette carte (niveau 1..5) — null : le classique.
    equippedSkinLevel: integer("equipped_skin_level"),
    firstObtainedAt: timestamp("first_obtained_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.animalId)],
);

export const userShards = pgTable(
  "user_shards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rarity: text("rarity").notNull(),
    category: text("category").notNull().default("animal"),
    count: integer("count").notNull().default(0),
  },
  (t) => [unique().on(t.userId, t.rarity, t.category)],
);

export const pokemon = pgTable("pokemon", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  rarity: text("rarity").notNull(),
  pokedexNumber: integer("pokedex_number"),
  primaryType: text("primary_type"),
  secondaryType: text("secondary_type"),
  imageUrl: text("image_url"),
  flavor: text("flavor"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  habitat: text("habitat"),
});

export const userPokemonCards = pgTable(
  "user_pokemon_cards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    count: integer("count").notNull().default(1),
    // Le skin équipé pour cette carte (niveau 1..5) — null : le classique.
    equippedSkinLevel: integer("equipped_skin_level"),
    firstObtainedAt: timestamp("first_obtained_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.pokemonId)],
);

// Énergie accumulée par les gardiens, par direction (pack_pokemon,
// wheel_x4, forge...). Créditée à la clôture de séance, consommée à
// l'ouverture d'un pack / roue / fusion / conversion. Les plafonds par
// direction sont appliqués côté code (src/lib/powers.ts).

// ─── Les Skins ──────────────────────────────────────────────────────────────
// Le catalogue : 5 skins par carte (niveau 1..5), concept unique nommé,
// image générée par vagues. `status` : pending → done | blocked.
export const cardSkins = pgTable(
  "card_skins",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull(), // animal | pokemon
    cardId: integer("card_id").notNull(),
    level: integer("level").notNull(), // 1 (petite vie) → 5 (apothéose)
    name: text("name").notNull(), // « Cuisine de Minuit »
    concept: text("concept").notNull(), // la scène, côté prompt
    imageUrl: text("image_url"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.category, t.cardId, t.level)],
);

// La possession : un skin gagné à la clôture (un par séance, sans doublon).
export const userSkins = pgTable(
  "user_skins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skinId: integer("skin_id")
      .notNull()
      .references(() => cardSkins.id, { onDelete: "cascade" }),
    obtainedAt: timestamp("obtained_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.skinId)],
);

export const userCharges = pgTable(
  "user_charges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    points: integer("points").notNull().default(0),
    // Horodatage du dernier crédit — informatif depuis la remise à zéro par séance.
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.direction)],
);

// Miracles à limite hebdomadaire (le Vœu de Jirachi, le Pas de Qilin...) :
// une ligne par (utilisateur, miracle, semaine ISO de la séance).
// L'Échappée : cartes tirées par le cardio (un tirage par quart d'heure
// entamé après le premier), en attente du choix attractif/répulsif.
export const sessionCardioDraws = pgTable("session_cardio_draws", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardCategory: text("card_category").notNull(), // 'animal' | 'pokemon'
  cardId: integer("card_id").notNull(),
  mode: text("mode"), // choisi à la résolution
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userMiracleUses = pgTable(
  "user_miracle_uses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    miracle: text("miracle").notNull(),
    isoWeek: date("iso_week").notNull(),
  },
  (t) => [unique().on(t.userId, t.miracle, t.isoWeek)],
);

// Surnoms de cartes (Le Vœu de Jirachi) : purement cosmétique, affiché à la
// place du nom dans la collection de son propriétaire.
export const userCardNames = pgTable(
  "user_card_names",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    cardId: integer("card_id").notNull(),
    nickname: text("nickname").notNull(),
  },
  (t) => [unique().on(t.userId, t.category, t.cardId)],
);
