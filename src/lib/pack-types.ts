import type { Rarity } from "@/lib/rarities";

export type PackType = "basic" | "animal_only" | "pokemon_only" | "premium" | "mythic";

export const PACK_TYPES: PackType[] = [
  "basic",
  "animal_only",
  "pokemon_only",
  "premium",
  "mythic",
];

// Probability of rolling each pack type when spending 1 token.
// Sum = 1.0 (basic = 0.64 absorbs the rest).
export const PACK_TYPE_WEIGHTS: Record<PackType, number> = {
  basic:        64,
  animal_only:  15,
  pokemon_only: 15,
  premium:       5,
  mythic:        1,
};

export const PACK_LABELS: Record<PackType, string> = {
  basic:        "Pack Basique",
  animal_only:  "Pack Animal",
  pokemon_only: "Pack Pokémon",
  premium:      "Pack Premium",
  mythic:       "Pack Mythique",
};

export const PACK_DESCRIPTIONS: Record<PackType, string> = {
  basic:        "Tirage classique. 75% animal · 25% pokémon. Toutes raretés possibles.",
  animal_only:  "100% animal. Toutes raretés possibles.",
  pokemon_only: "100% pokémon. Toutes raretés possibles.",
  premium:      "Pas de communs. Garantie peu commun ou mieux. Odds boostées.",
  mythic:       "Le Saint Graal. Garantie légendaire ou mythique.",
};

// Rarity weights per pack type. Rolling a creature in a pack uses these.
// "premium" drops common entirely and boosts higher tiers.
// "mythic" only rolls legendary or mythic.
export const PACK_RARITY_WEIGHTS: Record<PackType, Record<Rarity, number>> = {
  basic:        { common: 50, uncommon: 25, rare: 15, epic:  6, legendary:  3, mythic:  1 },
  animal_only:  { common: 50, uncommon: 25, rare: 15, epic:  6, legendary:  3, mythic:  1 },
  pokemon_only: { common: 50, uncommon: 25, rare: 15, epic:  6, legendary:  3, mythic:  1 },
  premium:      { common:  0, uncommon: 50, rare: 30, epic: 12, legendary:  6, mythic:  2 },
  mythic:       { common:  0, uncommon:  0, rare:  0, epic:  0, legendary: 70, mythic: 30 },
};

// Category probability per pack type (animal vs pokemon).
// "animal_only" and "pokemon_only" are forced.
// "mythic" gives even chance — both kingdoms feel epic at this tier.
export const PACK_CATEGORY_PROB_POKEMON: Record<PackType, number> = {
  basic:        0.25,
  animal_only:  0.0,
  pokemon_only: 1.0,
  premium:      0.25,
  mythic:       0.5,
};

export function rollPackType(): PackType {
  const total = Object.values(PACK_TYPE_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const t of PACK_TYPES) {
    r -= PACK_TYPE_WEIGHTS[t];
    if (r <= 0) return t;
  }
  return "basic";
}

// Le dé de rareté, éventuellement déformé par les Skins des gardiens
// éveillés (shift en dixièmes de point de %, jamais sous zéro par rareté).
export function rollRarityForPack(
  packType: PackType,
  shiftTenths?: Partial<Record<Rarity, number>>,
): Rarity {
  const weights = PACK_RARITY_WEIGHTS[packType];
  const tenths: Record<Rarity, number> = {} as Record<Rarity, number>;
  for (const rarity of Object.keys(weights) as Rarity[]) {
    tenths[rarity] = Math.max(0, weights[rarity] * 10 + (shiftTenths?.[rarity] ?? 0));
  }
  const total = Object.values(tenths).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const rarity of Object.keys(tenths) as Rarity[]) {
    r -= tenths[rarity];
    if (r <= 0) return rarity;
  }
  return "common";
}

export function rollCategoryForPack(packType: PackType): "animal" | "pokemon" {
  return Math.random() < PACK_CATEGORY_PROB_POKEMON[packType] ? "pokemon" : "animal";
}
