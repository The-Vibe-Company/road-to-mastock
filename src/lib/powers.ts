import type { Rarity } from "@/lib/rarities";
import { PACK_TYPE_WEIGHTS, type PackType } from "@/lib/pack-types";

// ─── Les Gardiens, deuxième ère ─────────────────────────────────────────────
// Trois étages, trois logiques :
//   1. Commun → Épique : LA POLARITÉ. La carte influence le pack de sa
//      propre famille, et c'est le joueur qui choisit le sens — attirer ou
//      repousser. Points par rareté : 1 / 2 / 3 / 5.
//   2. Légendaire : LES PRODIGES. Un pouvoir unique par carte, écrit à la
//      main — 70 légendaires, 70 prodiges.
//   3. Mythique : LES MIRACLES. Un pouvoir unique par carte, écrit à la
//      main, borné par des limites hebdomadaires.
// Règle transverse : on ouvre son pack après la séance. Clôturer une
// nouvelle séance remet le chapeau à zéro avant la nouvelle récolte
// (sauf pactes : Dialga, Ouroboros, Celebi).

// ─── Directions d'énergie ───────────────────────────────────────────────────

export type Direction =
  // Le chapeau
  | "pack_animal"
  | "pack_pokemon"
  | "repel_animal"
  | "repel_pokemon"
  | "pack_basic"      // le Lest attractif : remplir le Basique (farm de communs)
  | "pack_premium"
  | "pack_mythic"
  | "mythic_sparks"   // l'Étincelle : dixièmes de ticket Mythique
  | "purge_basic"
  | "inner_pokemon"   // la Balance : penche le 75/25 des packs mixtes
  | "inner_animal"
  // La roue
  | "wheel_x3"
  // Jauges utilitaires
  | "forge"
  | "curee"
  | "orpailleur"
  | "banquise"
  // Sorts chargés à l'éveil — comme tout le chapeau, ils tiennent
  // jusqu'à la prochaine clôture (rien ne se consomme à l'ouverture)
  | "no_basic"        // tes packs refusent d'être Basiques (1 reroll/charge, par pack)
  | "wheel_no_x1"     // tes roues perdent leur ×1
  | "wheel_min2"      // tes roues : le ×1 devient ×2
  | "wheel_34"        // tes roues : ×3 ou ×4 seulement
  | "qilin_wheel"     // tes roues : ×2 / ×3 / ×4 / ×10
  | "hoopa_double"    // tes ouvertures piochent deux packs, gardent le meilleur
  | "leviathan_guard" // à la clôture : si ton dernier pack était Basique, l'énergie survit
  | "time_hold"       // Dialga : la prochaine remise à zéro épargne le chapeau
  // Les Skins : compte de gardiens skinnés éveillés, par niveau de skin.
  // Chaque niveau déforme le dé de rareté des packs jusqu'à la clôture.
  | "skin_l1" | "skin_l2" | "skin_l3" | "skin_l4" | "skin_l5";

export const DIRECTION_CAPS: Record<Direction, number> = {
  pack_animal: 30,
  pack_pokemon: 30,
  repel_animal: 30,
  repel_pokemon: 30,
  pack_basic: 30,
  pack_premium: 15,
  pack_mythic: 9,
  mythic_sparks: 30, // en dixièmes : +3,0 tickets Mythique au maximum
  purge_basic: 40,
  inner_pokemon: 15, // 1 point = 2 % de curseur, ±30 % au maximum
  inner_animal: 15,
  wheel_x3: 15,
  forge: 20,
  curee: 5,
  orpailleur: 1,
  banquise: 10,
  no_basic: 3,
  wheel_no_x1: 1,
  wheel_min2: 1,
  wheel_34: 1,
  qilin_wheel: 1,
  hoopa_double: 1,
  leviathan_guard: 1,
  time_hold: 1,
  skin_l1: 3, skin_l2: 3, skin_l3: 3, skin_l4: 3, skin_l5: 3,
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  pack_animal: "tickets Animal",
  pack_pokemon: "tickets Pokémon",
  repel_animal: "tickets Animal dévorés",
  repel_pokemon: "tickets Pokémon dévorés",
  pack_basic: "tickets Basique",
  pack_premium: "tickets Premium",
  pack_mythic: "tickets Mythique",
  mythic_sparks: "étincelles de Mythe",
  purge_basic: "tickets Basique dévorés",
  inner_pokemon: "curseur vers Pokémon",
  inner_animal: "curseur vers Animal",
  wheel_x3: "tickets ×3 (roue)",
  forge: "Forge",
  curee: "Curée",
  orpailleur: "Orpailleur",
  banquise: "Banquise",
  no_basic: "Ascension",
  wheel_no_x1: "Roue pipée",
  wheel_min2: "Festin des Songes",
  wheel_34: "Colère de Typhon",
  qilin_wheel: "Pas de la Fortune",
  hoopa_double: "Passe-Mondes",
  leviathan_guard: "Pardon des Abysses",
  time_hold: "Seconde Éternelle",
  skin_l1: "Skin niv. 1", skin_l2: "Skin niv. 2", skin_l3: "Skin niv. 3",
  skin_l4: "Skin niv. 4", skin_l5: "Skin niv. 5",
};

// ─── Étage 1 : la Polarité ──────────────────────────────────────────────────

export type MascotMode = "attract" | "repel";

// En points de pourcentage du chapeau : ±1 commun, ±2 peu commun,
// ±4 rare, ±6 épique. L'Étincelle les compte en dixièmes (0,1 → 0,6).
export const POLARITY_POINTS: Partial<Record<Rarity, number>> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 6,
};

// ── Les Métiers ─────────────────────────────────────────────────────────────
// Le métier vient de la nature de la carte ; la polarité — choisie par le
// joueur — décide du sens dans lequel elle l'exerce.
//   famille   : ± tickets du pack de sa famille
//   lest      : attractif remplit le Basique, répulsif le dévore
//   etincelle : attractif sème des dixièmes de Mythique, répulsif brûle le Basique
//   balance   : penche le curseur 75/25 des packs mixtes, vers sa famille
//               ou vers l'autre

export type Metier = "famille" | "lest" | "etincelle" | "balance";

const METIER_BY_TYPE: Record<string, Metier> = {
  water: "famille",
  normal: "famille",
  bug: "famille",
  grass: "famille",
  fire: "lest",
  rock: "lest",
  ground: "lest",
  fighting: "lest",
  steel: "lest",
  poison: "lest",
  dragon: "etincelle",
  ghost: "etincelle",
  dark: "etincelle",
  psychic: "balance",
  electric: "balance",
  ice: "balance",
  fairy: "balance",
  flying: "balance",
};

const METIER_BY_LINEAGE: Record<string, Metier> = {
  troupeaux: "famille",
  nuees: "famille",
  meutes: "famille",
  domestiques: "famille",
  colosses: "lest",
  abyssaux: "lest",
  anciens: "etincelle",
  felins: "balance",
  rapaces: "balance",
  polaires: "balance",
};

export function metierOf(
  category: "animal" | "pokemon",
  subtype: string | null,
): Metier {
  if (category === "pokemon") return METIER_BY_TYPE[subtype ?? ""] ?? "famille";
  return METIER_BY_LINEAGE[subtype ?? ""] ?? "famille";
}

// Rétro-compatibilité d'affichage (annonce, détail de carte).
export const ENERGY_BY_RARITY: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 6,
  legendary: 8,
  mythic: 13,
};

// ─── Étage 2 : les Prodiges (légendaires, un par carte) ─────────────────────
// Comme les Miracles : 70 légendaires, 70 pouvoirs uniques écrits à la main.
// La résolution est déclarative — chaque prodige décrit son effet, le moteur
// l'interprète.

export type ProdigeEffect =
  | { kind: "hat"; add: Partial<Record<Direction, number>>; detail: string }
  | { kind: "token"; chance: number; win: string; miss: string }
  | {
      kind: "fragment";
      rarity: Rarity;
      fragCategory: "animal" | "pokemon";
      count: number;
      needRecord?: boolean;
      detail: string;
      wait?: string;
    }
  | { kind: "weekpos"; position: number; add: Partial<Record<Direction, number>>; detail: string; wait: string }
  | { kind: "record"; add: Partial<Record<Direction, number>>; detail: string; wait: string }
  | { kind: "chaos"; pool: { add: Partial<Record<Direction, number>>; detail: string }[] }
  | { kind: "echo"; fallback: { add: Partial<Record<Direction, number>>; detail: string } };

export interface ProdigeDef {
  id: string; // le slug de la carte — sert aussi de clé hebdomadaire
  name: string;
  description: string;
  weekly?: boolean;
  effect: ProdigeEffect;
}

export const PRODIGES: Record<string, ProdigeDef> = {
  // ── Les 35 bêtes légendaires ──
  "animal:basilisk": {
    id: "basilisk",
    name: "Le Regard qui Fige",
    description:
      "À son éveil, le Basilic pétrifie la malchance elle-même : tes roues de la fortune perdent leur case ×1 jusqu'à la prochaine clôture.",
    effect: { kind: "hat", add: { wheel_no_x1: 1 }, detail: "tes roues perdent leur ×1" },
  },
  "animal:kraken": {
    id: "kraken",
    name: "Les Bras Sans Fin",
    description:
      "À son éveil, le Kraken tire les deux familles vers le fond : 6 tickets Animal et 6 tickets Pokémon coulent — le Premium et le Mythique pèsent d'autant plus lourd.",
    effect: { kind: "hat", add: { repel_animal: 6, repel_pokemon: 6 }, detail: "6 tickets Animal et 6 Pokémon engloutis" },
  },
  "animal:kelpie": {
    id: "kelpie",
    name: "Le Gué Traître",
    description:
      "Le cheval des eaux attire les siens vers la rive : à son éveil, +12 tickets « pack Animal » dans le chapeau.",
    effect: { kind: "hat", add: { pack_animal: 12 }, detail: "+12 tickets Animal" },
  },
  "animal:chupacabra": {
    id: "chupacabra",
    name: "La Saignée",
    description:
      "À son éveil, le Chupacabra saigne le chapeau : 8 tickets Basique disparaissent sans un bruit.",
    effect: { kind: "hat", add: { purge_basic: 8 }, detail: "8 tickets Basique saignés" },
  },
  "animal:nymph": {
    id: "nymph",
    name: "La Source Claire",
    description:
      "À son éveil, une chance sur quatre que la Nymphe fasse jaillir un jeton normal dans ta réserve.",
    effect: { kind: "token", chance: 0.25, win: "1 jeton jailli de la source", miss: "la source reste calme cette fois" },
  },
  "animal:banshee": {
    id: "banshee",
    name: "Le Cri d'Outre-Tombe",
    description:
      "La Banshee ne crie que lorsqu'un record meurt sur sa machine : alors son cri dévore 12 tickets Basique d'un coup.",
    effect: {
      kind: "record",
      add: { purge_basic: 12 },
      detail: "record — son cri dévore 12 tickets Basique",
      wait: "elle attend qu'un record tombe pour crier",
    },
  },
  "animal:phoenix": {
    id: "phoenix",
    name: "Les Cendres Fécondes",
    description:
      "À son éveil, quelque chose renaît des cendres : 0,7 ticket « pack Mythique » tombe dans le chapeau.",
    effect: { kind: "hat", add: { mythic_sparks: 7 }, detail: "+0,7 ticket Mythique né des cendres" },
  },
  "animal:sphinx": {
    id: "sphinx",
    name: "L'Énigme Résolue",
    description:
      "Le Sphinx ne récompense que ceux qui résolvent son énigme : bats ton record sur sa machine et il dépose un fragment peu commun à tes pieds.",
    effect: {
      kind: "fragment",
      rarity: "uncommon",
      fragCategory: "animal",
      count: 1,
      needRecord: true,
      detail: "énigme résolue — 1 fragment peu commun",
      wait: "il attend que tu résolves l'énigme : un record",
    },
  },
  "animal:siren": {
    id: "siren",
    name: "Le Chant des Écueils",
    description:
      "Son chant détourne les navires : à son éveil, le curseur des packs mixtes penche de 6 % vers les animaux.",
    effect: { kind: "hat", add: { inner_animal: 6 }, detail: "curseur des packs mixtes : 6 % vers les animaux" },
  },
  "animal:manticore": {
    id: "manticore",
    name: "La Triple Morsure",
    description:
      "Trois gueules, trois morsures : à son éveil, +4 tickets Animal, +4 Pokémon et +2 Premium, d'un seul mouvement.",
    effect: { kind: "hat", add: { pack_animal: 4, pack_pokemon: 4, pack_premium: 2 }, detail: "+4 Animal, +4 Pokémon, +2 Premium" },
  },
  "animal:cyclops": {
    id: "cyclops",
    name: "L'Œil Unique",
    description:
      "Le Cyclope ne voit qu'une seule porte, mais il la voit bien : à son éveil, +3 tickets « pack Premium ».",
    effect: { kind: "hat", add: { pack_premium: 3 }, detail: "+3 tickets Premium" },
  },
  "animal:griffin": {
    id: "griffin",
    name: "Le Serment du Ciel",
    description:
      "Gardien des trésors, il partage les siens : à son éveil, +2 tickets Premium et +1 ticket Mythique.",
    effect: { kind: "hat", add: { pack_premium: 2, pack_mythic: 1 }, detail: "+2 Premium et +1 Mythique" },
  },
  "animal:chimera": {
    id: "chimera",
    name: "Le Corps Impossible",
    description:
      "Trois bêtes en une seule, et jamais la même qui se réveille : à chaque éveil, l'une de ses têtes agit au hasard — +8 Animal, +8 Pokémon ou +3 Premium.",
    effect: {
      kind: "chaos",
      pool: [
        { add: { pack_animal: 8 }, detail: "la tête de lion : +8 tickets Animal" },
        { add: { pack_pokemon: 8 }, detail: "la tête de chèvre : +8 tickets Pokémon" },
        { add: { pack_premium: 3 }, detail: "la tête de serpent : +3 tickets Premium" },
      ],
    },
  },
  "animal:hippogriff": {
    id: "hippogriff",
    name: "La Monture Fière",
    description:
      "L'Hippogriffe ne se montre qu'à ceux qui reviennent : à la deuxième séance de ta semaine, +4 tickets Premium.",
    effect: {
      kind: "weekpos",
      position: 2,
      add: { pack_premium: 4 },
      detail: "2ᵉ séance de la semaine — +4 tickets Premium",
      wait: "il ne se montre qu'à la 2ᵉ séance de la semaine",
    },
  },
  "animal:sasquatch": {
    id: "sasquatch",
    name: "Le Pas Discret",
    description:
      "Personne ne le voit passer, et tes packs non plus : à son éveil, tes packs refusent d'être Basiques — un reroll par pack, jusqu'à la prochaine clôture.",
    effect: { kind: "hat", add: { no_basic: 1 }, detail: "tes packs refusent d'être Basiques" },
  },
  "animal:djinn": {
    id: "djinn",
    name: "Les Trois Volontés",
    description:
      "Le Djinn n'exauce que les vœux de fortune : à son éveil, +6 tickets sur la case ×3 de la roue.",
    effect: { kind: "hat", add: { wheel_x3: 6 }, detail: "+6 tickets sur la case ×3 de la roue" },
  },
  "animal:centaur": {
    id: "centaur",
    name: "La Flèche Juste",
    description:
      "L'archer ne manque jamais sa cible : à son éveil, +8 tickets Animal et 0,2 ticket Mythique en pointe de flèche.",
    effect: { kind: "hat", add: { pack_animal: 8, mythic_sparks: 2 }, detail: "+8 Animal et +0,2 Mythique" },
  },
  "animal:roc": {
    id: "roc",
    name: "L'Envergure",
    description:
      "Son ombre couvre les deux royaumes à la fois : à son éveil, +6 tickets Animal et +6 tickets Pokémon.",
    effect: { kind: "hat", add: { pack_animal: 6, pack_pokemon: 6 }, detail: "+6 Animal et +6 Pokémon" },
  },
  "animal:troll": {
    id: "troll",
    name: "Le Péage du Pont",
    description:
      "Nul ne traverse sans payer : à son éveil, le Troll prélève 5 tickets Basique et rend 2 tickets Premium en monnaie.",
    effect: { kind: "hat", add: { purge_basic: 5, pack_premium: 2 }, detail: "−5 Basique, +2 Premium en monnaie" },
  },
  "animal:behemoth": {
    id: "behemoth",
    name: "Le Poids du Monde",
    description:
      "Rien ne pèse plus lourd que lui : à son éveil, +15 tickets Basique — la plus grosse pelle à communs du jeu, pour nourrir Forge et fragments.",
    effect: { kind: "hat", add: { pack_basic: 15 }, detail: "+15 tickets Basique — la grande pelle" },
  },
  "animal:cerberus": {
    id: "cerberus",
    name: "Les Trois Gueules",
    description:
      "Le chien des enfers imite le plus fort de la meute : à son éveil, il répète le geste de tickets (Famille ou Lest) le plus puissant de la séance.",
    effect: { kind: "echo", fallback: { add: { pack_animal: 6 }, detail: "+6 tickets Animal (personne à imiter)" } },
  },
  "animal:fae": {
    id: "fae",
    name: "La Poussière de Fée",
    description:
      "Elle en laisse partout : à son éveil, 0,5 ticket Mythique et +3 sur la case ×3 de la roue, en scintillant.",
    effect: { kind: "hat", add: { mythic_sparks: 5, wheel_x3: 3 }, detail: "+0,5 Mythique et +3 sur la case ×3" },
  },
  "animal:thunderbird": {
    id: "thunderbird",
    name: "L'Orage Porteur",
    description:
      "Une fois par semaine, l'Oiseau-tonnerre charge la roue de son orage : +10 tickets sur la case ×3, d'un seul éclair.",
    weekly: true,
    effect: { kind: "hat", add: { wheel_x3: 10 }, detail: "+10 tickets sur la case ×3 — l'orage" },
  },
  "animal:yeti": {
    id: "yeti",
    name: "Le Blizzard Gardien",
    description:
      "À son éveil, le Yéti gèle ton énergie sur place : à la prochaine clôture, jusqu'à 10 tickets par direction survivront à la remise à zéro.",
    effect: { kind: "hat", add: { banquise: 10 }, detail: "tes tickets survivront à la prochaine clôture" },
  },
  "animal:golem": {
    id: "golem",
    name: "Le Socle Gravé",
    description:
      "Fait pour bâtir, jamais pour détruire : à son éveil, +8 dans la jauge de Forge. Jauge pleine (20), la Roue de la Forge t'offre un fragment au tirage.",
    effect: { kind: "hat", add: { forge: 8 }, detail: "+8 dans la jauge de Forge" },
  },
  "animal:naga": {
    id: "naga",
    name: "La Mue Précieuse",
    description:
      "Le serpent garde même sa vieille peau : à son éveil, 3 charges de Curée — tes prochains doublons rapportent chacun un fragment de plus.",
    effect: { kind: "hat", add: { curee: 3 }, detail: "3 charges de Curée stockées" },
  },
  "animal:ogre": {
    id: "ogre",
    name: "L'Appétit Simple",
    description:
      "L'Ogre mange ce qui traîne et garde le meilleur : à son éveil, 6 tickets Basique dévorés et +3 tickets Animal.",
    effect: { kind: "hat", add: { purge_basic: 6, pack_animal: 3 }, detail: "−6 Basique, +3 Animal" },
  },
  "animal:wendigo": {
    id: "wendigo",
    name: "La Faim d'Hiver",
    description:
      "Sa faim ne s'arrête jamais : à son éveil, 8 tickets Animal dévorés — et 0,3 ticket Mythique tombe de sa mâchoire.",
    effect: { kind: "hat", add: { repel_animal: 8, mythic_sparks: 3 }, detail: "−8 Animal, +0,3 Mythique" },
  },
  "animal:unicorn": {
    id: "unicorn",
    name: "La Corne Pure",
    description:
      "Elle purifie tout ce qu'elle touche : à son éveil, +2 tickets Premium, +2 sur la case ×3 et 0,2 ticket Mythique.",
    effect: { kind: "hat", add: { pack_premium: 2, wheel_x3: 2, mythic_sparks: 2 }, detail: "+2 Premium, +2 sur ×3, +0,2 Mythique" },
  },
  "animal:pegasus": {
    id: "pegasus",
    name: "Le Galop Céleste",
    description:
      "Pégase ouvre la semaine au galop : à ta première séance de la semaine, +5 tickets Premium.",
    effect: {
      kind: "weekpos",
      position: 1,
      add: { pack_premium: 5 },
      detail: "1ʳᵉ séance de la semaine — +5 tickets Premium",
      wait: "il n'ouvre que la première séance de la semaine",
    },
  },
  "animal:minotaur": {
    id: "minotaur",
    name: "Le Fil Rompu",
    description:
      "Au centre du labyrinthe, le Minotaure attend l'exploit : bats ton record sur sa machine et il t'ouvre la sortie — +6 tickets Premium.",
    effect: {
      kind: "record",
      add: { pack_premium: 6 },
      detail: "record — le fil rompu, +6 tickets Premium",
      wait: "il attend qu'un record rompe le fil",
    },
  },
  "animal:gorgon": {
    id: "gorgon",
    name: "Le Jardin de Pierre",
    description:
      "Chaque regard ajoute une statue au jardin : à son éveil, 10 tickets Pokémon pétrifiés — pour ceux qui préfèrent les bêtes.",
    effect: { kind: "hat", add: { repel_pokemon: 10 }, detail: "10 tickets Pokémon pétrifiés" },
  },
  "animal:jackalope": {
    id: "jackalope",
    name: "Le Bond Improbable",
    description:
      "Personne ne sait où il va retomber : à chaque éveil, un bond au hasard — +2 Mythique, +4 Premium ou +8 sur la case ×3.",
    effect: {
      kind: "chaos",
      pool: [
        { add: { pack_mythic: 2 }, detail: "bond miraculeux : +2 tickets Mythique" },
        { add: { pack_premium: 4 }, detail: "bond superbe : +4 tickets Premium" },
        { add: { wheel_x3: 8 }, detail: "bond joueur : +8 sur la case ×3" },
      ],
    },
  },
  "animal:mothman": {
    id: "mothman",
    name: "Le Présage Ailé",
    description:
      "On ne le voit qu'avant les grandes choses : à son éveil, tes packs refusent d'être Basiques, et 0,2 ticket Mythique tombe de ses ailes.",
    effect: { kind: "hat", add: { no_basic: 1, mythic_sparks: 2 }, detail: "refus de Basique + 0,2 Mythique" },
  },
  "animal:wyvern": {
    id: "wyvern",
    name: "Le Vol Rasant",
    description:
      "Elle frôle le mythe sans jamais s'y poser : à son éveil, +2 tickets « pack Mythique ». Rarissime, et ça se sent.",
    effect: { kind: "hat", add: { pack_mythic: 2 }, detail: "+2 tickets Mythique" },
  },

  // ── Les 35 Pokémon légendaires ──
  "pokemon:kyogre": {
    id: "kyogre",
    name: "La Marée Haute",
    description:
      "Quand Kyogre s'éveille, la mer monte : +10 tickets Pokémon, et le curseur des packs mixtes penche de 3 % vers les siens.",
    effect: { kind: "hat", add: { pack_pokemon: 10, inner_pokemon: 3 }, detail: "+10 Pokémon, curseur +3 %" },
  },
  "pokemon:cresselia": {
    id: "cresselia",
    name: "Le Croissant de Lune",
    description:
      "Une fois par semaine, son rêve se penche sur toi : une chance sur deux qu'un jeton normal apparaisse dans ta réserve.",
    weekly: true,
    effect: { kind: "token", chance: 0.5, win: "le rêve dépose 1 jeton", miss: "le rêve passe sans s'arrêter" },
  },
  "pokemon:solgaleo": {
    id: "solgaleo",
    name: "La Crinière Solaire",
    description:
      "L'émissaire du soleil éclaire la meilleure porte : à son éveil, +4 tickets « pack Premium ».",
    effect: { kind: "hat", add: { pack_premium: 4 }, detail: "+4 tickets Premium" },
  },
  "pokemon:mewtwo": {
    id: "mewtwo",
    name: "Le Clone Parfait",
    description:
      "Créé pour surpasser l'original : à son éveil, Mewtwo copie le geste de tickets (Famille ou Lest) le plus puissant de la séance — mêmes tickets, même direction.",
    effect: { kind: "echo", fallback: { add: { pack_pokemon: 6 }, detail: "+6 tickets Pokémon (personne à copier)" } },
  },
  "pokemon:suicune": {
    id: "suicune",
    name: "L'Eau Pure",
    description:
      "Suicune purifie tout ce qui stagne : à son éveil, 10 tickets Basique s'évaporent du chapeau.",
    effect: { kind: "hat", add: { purge_basic: 10 }, detail: "10 tickets Basique purifiés" },
  },
  "pokemon:zapdos": {
    id: "zapdos",
    name: "La Foudre Branchue",
    description:
      "L'éclair frappe toujours la roue : à son éveil, +8 tickets sur la case ×3.",
    effect: { kind: "hat", add: { wheel_x3: 8 }, detail: "+8 tickets sur la case ×3" },
  },
  "pokemon:ho-oh": {
    id: "ho-oh",
    name: "L'Arc-en-Ciel",
    description:
      "Là où il passe, un arc-en-ciel — mais jamais le même : à chaque éveil, une couleur au hasard : +6 Pokémon, +3 Premium ou +1 Mythique.",
    effect: {
      kind: "chaos",
      pool: [
        { add: { pack_pokemon: 6 }, detail: "couleur rouge : +6 tickets Pokémon" },
        { add: { pack_premium: 3 }, detail: "couleur or : +3 tickets Premium" },
        { add: { pack_mythic: 1 }, detail: "couleur sacrée : +1 ticket Mythique" },
      ],
    },
  },
  "pokemon:marshadow": {
    id: "marshadow",
    name: "L'Ombre du Poing",
    description:
      "Il vit dans l'ombre des exploits : bats ton record sur sa machine et il frappe — +12 tickets Pokémon.",
    effect: {
      kind: "record",
      add: { pack_pokemon: 12 },
      detail: "record — l'ombre frappe : +12 Pokémon",
      wait: "il attend un record pour sortir de l'ombre",
    },
  },
  "pokemon:reshiram": {
    id: "reshiram",
    name: "La Vérité Blanche",
    description:
      "La flamme de la vérité éclaire les hautes portes : à son éveil, +2 tickets Premium et +1 ticket Mythique.",
    effect: { kind: "hat", add: { pack_premium: 2, pack_mythic: 1 }, detail: "+2 Premium et +1 Mythique" },
  },
  "pokemon:lugia": {
    id: "lugia",
    name: "Le Gardien des Mers",
    description:
      "Il apaise les tempêtes avant qu'elles n'emportent tout : à son éveil, +4 tickets Pokémon, et jusqu'à 6 tickets par direction survivront à la prochaine clôture.",
    effect: { kind: "hat", add: { pack_pokemon: 4, banquise: 6 }, detail: "+4 Pokémon, 6 tickets gelés par direction" },
  },
  "pokemon:regice": {
    id: "regice",
    name: "Le Zéro Absolu",
    description:
      "Son froid fige la balance elle-même : à son éveil, le curseur des packs mixtes penche de 6 % vers les Pokémon.",
    effect: { kind: "hat", add: { inner_pokemon: 6 }, detail: "curseur des packs mixtes : 6 % vers les Pokémon" },
  },
  "pokemon:entei": {
    id: "entei",
    name: "Le Brasier Courant",
    description:
      "Entei court et tout brûle derrière lui : à son éveil, 6 tickets Basique partent en fumée et 0,2 ticket Mythique monte des braises.",
    effect: { kind: "hat", add: { purge_basic: 6, mythic_sparks: 2 }, detail: "−6 Basique, +0,2 Mythique" },
  },
  "pokemon:raikou": {
    id: "raikou",
    name: "Le Tonnerre Précoce",
    description:
      "Le tonnerre n'attend pas : à la première séance de ta semaine, +8 sur la case ×3 et +4 tickets Pokémon.",
    effect: {
      kind: "weekpos",
      position: 1,
      add: { wheel_x3: 8, pack_pokemon: 4 },
      detail: "1ʳᵉ séance de la semaine — +8 sur ×3, +4 Pokémon",
      wait: "le tonnerre ne gronde qu'à la première séance de la semaine",
    },
  },
  "pokemon:heatran": {
    id: "heatran",
    name: "Le Cœur de Lave",
    description:
      "Il dort dans les cratères et réchauffe la Forge : à son éveil, +5 dans la jauge de Forge et +2 tickets Premium.",
    effect: { kind: "hat", add: { forge: 5, pack_premium: 2 }, detail: "+5 Forge, +2 Premium" },
  },
  "pokemon:latios": {
    id: "latios",
    name: "Le Vol Fraternel",
    description:
      "Le frère vole vers la fortune : à son éveil, +8 tickets Pokémon et +2 sur la case ×3 de la roue. Sa sœur préfère le mythe.",
    effect: { kind: "hat", add: { pack_pokemon: 8, wheel_x3: 2 }, detail: "+8 Pokémon, +2 sur la case ×3" },
  },
  "pokemon:lunala": {
    id: "lunala",
    name: "L'Aile du Crépuscule",
    description:
      "Quand son aile couvre le ciel, la nuit choisit son camp : 6 tickets Animal avalés, +6 tickets Pokémon.",
    effect: { kind: "hat", add: { repel_animal: 6, pack_pokemon: 6 }, detail: "−6 Animal, +6 Pokémon" },
  },
  "pokemon:necrozma": {
    id: "necrozma",
    name: "La Lumière Volée",
    description:
      "Il vole la lumière pour la rendre plus pure : à son éveil, 4 tickets Pokémon dévorés — contre +2 Premium et +1 Mythique.",
    effect: { kind: "hat", add: { repel_pokemon: 4, pack_premium: 2, pack_mythic: 1 }, detail: "−4 Pokémon, +2 Premium, +1 Mythique" },
  },
  "pokemon:xerneas": {
    id: "xerneas",
    name: "L'Arbre de Vie",
    description:
      "À son éveil, deux chances sur cinq qu'un jeton normal pousse sur ses bois et tombe dans ta réserve.",
    effect: { kind: "token", chance: 0.4, win: "1 jeton a poussé sur ses bois", miss: "rien n'a fleuri cette fois" },
  },
  "pokemon:dialga": {
    id: "dialga",
    name: "La Seconde Éternelle",
    description:
      "Dialga suspend le temps du chapeau : la prochaine remise à zéro (ta prochaine séance) épargnera toute ton énergie non dépensée, une fois.",
    effect: { kind: "hat", add: { time_hold: 1 }, detail: "la prochaine remise à zéro épargnera ton chapeau" },
  },
  "pokemon:magearna": {
    id: "magearna",
    name: "Le Rouage Fidèle",
    description:
      "La machine à cœur d'âme huile tes ateliers : à son éveil, +4 dans la jauge de Forge et 2 charges de Curée.",
    effect: { kind: "hat", add: { forge: 4, curee: 2 }, detail: "+4 Forge et 2 charges de Curée" },
  },
  "pokemon:regirock": {
    id: "regirock",
    name: "Le Rempart",
    description:
      "Pierre sur pierre : à son éveil, +12 tickets Basique — le farm de communs, pour nourrir la Forge et la Curée.",
    effect: { kind: "hat", add: { pack_basic: 12 }, detail: "+12 tickets Basique — pierre sur pierre" },
  },
  "pokemon:zekrom": {
    id: "zekrom",
    name: "L'Idéal Noir",
    description:
      "La foudre de l'idéal vise haut : à son éveil, +1 ticket Mythique et +4 sur la case ×3 de la roue.",
    effect: { kind: "hat", add: { pack_mythic: 1, wheel_x3: 4 }, detail: "+1 Mythique, +4 sur la case ×3" },
  },
  "pokemon:zygarde-50": {
    id: "zygarde-50",
    name: "La Cellule Assemblée",
    description:
      "L'essaim veille sur l'équilibre du monde : à son éveil, +5 tickets Animal et +5 tickets Pokémon, sans préférence.",
    effect: { kind: "hat", add: { pack_animal: 5, pack_pokemon: 5 }, detail: "+5 Animal et +5 Pokémon" },
  },
  "pokemon:moltres": {
    id: "moltres",
    name: "Les Plumes Braises",
    description:
      "Chaque battement d'ailes sème des braises : à son éveil, 0,6 ticket « pack Mythique » tombe dans le chapeau.",
    effect: { kind: "hat", add: { mythic_sparks: 6 }, detail: "+0,6 ticket Mythique en braises" },
  },
  "pokemon:palkia": {
    id: "palkia",
    name: "L'Espace Déchiré",
    description:
      "Palkia courbe l'espace entre les packs : à son éveil, +3 tickets Premium, et le curseur des packs mixtes penche de 4 % vers les Pokémon.",
    effect: { kind: "hat", add: { pack_premium: 3, inner_pokemon: 4 }, detail: "+3 Premium, curseur +4 %" },
  },
  "pokemon:regigigas": {
    id: "regigigas",
    name: "La Traction du Titan",
    description:
      "Il a tiré les continents, il peut bien tirer ton chapeau : à son éveil, +6 tickets Basique et +3 tickets Premium.",
    effect: { kind: "hat", add: { pack_basic: 6, pack_premium: 3 }, detail: "+6 Basique et +3 Premium" },
  },
  "pokemon:yveltal": {
    id: "yveltal",
    name: "Le Rapace Funeste",
    description:
      "Là où passe son ombre, la vie s'éteint : à son éveil, 10 tickets Animal fauchés — pour ceux qui ne jurent que par les Pokémon.",
    effect: { kind: "hat", add: { repel_animal: 10 }, detail: "10 tickets Animal fauchés" },
  },
  "pokemon:articuno": {
    id: "articuno",
    name: "Le Givre Suspendu",
    description:
      "Son givre fige la pire case : tes roues perdent leur ×1, et +3 tickets Pokémon tombent en flocons.",
    effect: { kind: "hat", add: { wheel_no_x1: 1, pack_pokemon: 3 }, detail: "roue sans ×1, +3 Pokémon" },
  },
  "pokemon:giratina-altered": {
    id: "giratina-altered",
    name: "Le Monde Inversé",
    description:
      "Depuis sa dimension, tout se lit à l'envers : à son éveil, 8 tickets Basique basculent dans le vide et +1 ticket Mythique en ressort.",
    effect: { kind: "hat", add: { purge_basic: 8, pack_mythic: 1 }, detail: "−8 Basique, +1 Mythique" },
  },
  "pokemon:groudon": {
    id: "groudon",
    name: "La Terre Levée",
    description:
      "Quand Groudon s'éveille, les continents montent : +10 tickets Animal, et le curseur des packs mixtes penche de 3 % vers les bêtes.",
    effect: { kind: "hat", add: { pack_animal: 10, inner_animal: 3 }, detail: "+10 Animal, curseur +3 %" },
  },
  "pokemon:registeel": {
    id: "registeel",
    name: "L'Alliage Patient",
    description:
      "Le métal ne se presse jamais : à son éveil, +7 dans la jauge de Forge et +1 ticket Premium.",
    effect: { kind: "hat", add: { forge: 7, pack_premium: 1 }, detail: "+7 Forge, +1 Premium" },
  },
  "pokemon:latias": {
    id: "latias",
    name: "Le Vol Sororal",
    description:
      "La sœur vole vers le mythe : à son éveil, +8 tickets Pokémon et 0,2 ticket Mythique. Son frère préfère la roue.",
    effect: { kind: "hat", add: { pack_pokemon: 8, mythic_sparks: 2 }, detail: "+8 Pokémon, +0,2 Mythique" },
  },
  "pokemon:phione": {
    id: "phione",
    name: "La Goutte Voyageuse",
    description:
      "La plus humble des légendaires fait ce qu'elle peut : à son éveil, une chance sur cinq de déposer un jeton normal dans ta réserve.",
    effect: { kind: "token", chance: 0.2, win: "1 jeton porté par le courant", miss: "le courant est passé au large" },
  },
  "pokemon:kyurem": {
    id: "kyurem",
    name: "Le Vide Glacé",
    description:
      "Le dragon creux aspire tout ce qui est tiède : à son éveil, 4 tickets Basique, 4 Animal et 4 Pokémon gelés — il ne reste que le précieux.",
    effect: { kind: "hat", add: { purge_basic: 4, repel_animal: 4, repel_pokemon: 4 }, detail: "−4 Basique, −4 Animal, −4 Pokémon" },
  },
  "pokemon:rayquaza": {
    id: "rayquaza",
    name: "Le Seigneur du Ciel",
    description:
      "Au-dessus de tout, même des légendes : à son éveil, +2 tickets Mythique et +2 tickets Premium. L'apex des prodiges.",
    effect: { kind: "hat", add: { pack_mythic: 2, pack_premium: 2 }, detail: "+2 Mythique et +2 Premium" },
  },
};


// ─── La règle du jeu, en clair ──────────────────────────────────────────────
// Sous la phrase lyrique, l'encart mécanique : déclencheur, chiffres, cible.
// Pour les prodiges il est GÉNÉRÉ depuis les données d'effet — impossible
// de mentir au joueur.

const spark = (tenths: number) => (tenths / 10).toFixed(1).replace(".", ",");

function fmtAdd(d: Direction, n: number): string {
  switch (d) {
    case "pack_animal": return `+${n} tickets « pack Animal »`;
    case "pack_pokemon": return `+${n} tickets « pack Pokémon »`;
    case "repel_animal": return `−${n} tickets « pack Animal »`;
    case "repel_pokemon": return `−${n} tickets « pack Pokémon »`;
    case "pack_basic": return `+${n} tickets « pack Basique »`;
    case "purge_basic": return `−${n} tickets « pack Basique »`;
    case "pack_premium": return `+${n} tickets « pack Premium »`;
    case "pack_mythic": return `+${n} tickets « pack Mythique »`;
    case "mythic_sparks": return `+${spark(n)} ticket « pack Mythique »`;
    case "inner_pokemon": return `dans un pack Basique, la carte tirée est animale à 75 % / Pokémon à 25 % — ce curseur bouge de ${n} % vers les Pokémon`;
    case "inner_animal": return `dans un pack Basique, la carte tirée est animale à 75 % / Pokémon à 25 % — ce curseur bouge de ${n} % vers les animaux`;
    case "wheel_x3": return `+${n} tickets sur la case ×3 de la roue des jetons spéciaux`;
    case "forge": return `+${n} dans la jauge de Forge — visible sur la Collection ; pleine à 20, elle paie un tour de la Roue de la Forge : un fragment garanti, du commun (42 %) à l'épique (10 %)`;
    case "curee": return `Curée : chaque doublon tiré rapporte 1 fragment de plus, jusqu'à la prochaine clôture`;
    case "banquise": return `clôturer une séance balaie normalement le chapeau — là, jusqu'à ${n} tickets par direction survivront à la prochaine remise à zéro`;
    case "no_basic": return `tes packs refusent d'être Basiques (${n} reroll${n > 1 ? "s" : ""} par pack), jusqu'à la prochaine clôture`;
    case "wheel_no_x1": return "tes roues perdent leur case ×1, jusqu'à la prochaine clôture";
    case "time_hold": return "clôturer une séance remet normalement le chapeau à zéro — la prochaine remise à zéro est annulée, ton énergie survit (une fois)";
    default: return `+${n} ${DIRECTION_LABELS[d]}`;
  }
}

function fmtAdds(add: Partial<Record<Direction, number>>): string {
  return (Object.entries(add) as [Direction, number][])
    .map(([d, n]) => fmtAdd(d, n))
    .join(" · ");
}

const FRAG_LABELS: Partial<Record<Rarity, string>> = {
  common: "commun", uncommon: "peu commun", rare: "rare", epic: "épique",
};

// Le déclencheur commun, rappelé en tête d'encart : une légendaire ou une
// mythique n'agit que posée en Gardien, sur une machine travaillée.
export const AWAKEN_REMINDER =
  "Pose-la en Gardien sur une machine : elle s'éveille quand tu y fais une série et clôtures la séance.";

function capitalize(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function prodigeRules(p: ProdigeDef): string {
  return capitalize(rawProdigeRules(p));
}

function rawProdigeRules(p: ProdigeDef): string {
  const fx = p.effect;
  const weekly = p.weekly ? "Une fois par semaine — " : "";
  switch (fx.kind) {
    case "hat":
      return `${weekly}à chaque éveil : ${fmtAdds(fx.add)}.`;
    case "token":
      return `${weekly}à chaque éveil : ${Math.round(fx.chance * 100)} % de chance de gagner 1 jeton normal.`;
    case "fragment":
      return fx.needRecord
        ? `Record battu sur sa machine (charge max ou volume) : +${fx.count} fragment ${FRAG_LABELS[fx.rarity]}. Sinon : rien.`
        : `${weekly}à chaque éveil : +${fx.count} fragment${fx.count > 1 ? "s" : ""} ${FRAG_LABELS[fx.rarity]}${fx.count > 1 ? "s" : ""}.`;
    case "weekpos":
      return `À la ${fx.position === 1 ? "1ʳᵉ" : `${fx.position}ᵉ`} séance de ta semaine : ${fmtAdds(fx.add)}. Sinon : rien.`;
    case "record":
      return `Record battu sur sa machine (charge max ou volume) : ${fmtAdds(fx.add)}. Sinon : rien.`;
    case "chaos":
      return `À chaque éveil, UN seul effet au hasard : ${fx.pool.map((o) => fmtAdds(o.add)).join("  /  ")}.`;
    case "echo":
      return `À chaque éveil : copie le geste de tickets le plus fort de la séance (métiers Famille et Lest — mêmes tickets, même direction). Personne à copier : ${fmtAdds(fx.fallback.add)}.`;
  }
}

export function prodigeOf(
  category: "animal" | "pokemon",
  slug: string,
): ProdigeDef | null {
  return PRODIGES[`${category}:${slug}`] ?? null;
}

// ─── Étage 3 : les Miracles (mythiques, un par carte) ───────────────────────

export interface Miracle {
  id: string;
  name: string;
  description: string;
  // L'encart mécanique : déclencheur, chiffres, cible — écrit d'après le
  // code de résolution, pour que le joueur sache EXACTEMENT quoi.
  rules: string;
  // Limité à une fois par semaine ISO (les dons de jetons, les sorts de roue).
  weekly?: boolean;
}

export const MIRACLES: Record<string, Miracle> = {
  // ── Les 15 bêtes primordiales ──
  "animal:fenrir": {
    id: "gueule",
    name: "La Gueule du Loup",
    description:
      "À son éveil, Fenrir referme sa gueule sur le chapeau et dévore 6 tickets Basique. Ce qu'il mange ne revient pas — le reste du chapeau pèse d'autant plus lourd.",
    rules:
      "À chaque éveil : −6 tickets « pack Basique » dans le chapeau.",
  },
  "animal:ouroboros": {
    id: "eternel-retour",
    name: "L'Éternel Retour",
    description:
      "Tant qu'Ouroboros garde une machine, ton énergie ne connaît pas la fin : la remise à zéro du chapeau à chaque nouvelle séance ne te concerne plus — tout s'accumule.",
    rules:
      "Tant qu'il est posé en Gardien (peu importe la machine) : la remise à zéro du chapeau à chaque clôture de séance est annulée — ton énergie s'accumule de séance en séance, sans fin.",
  },
  "animal:world-serpent": {
    id: "etreinte-monde",
    name: "L'Étreinte du Monde",
    description:
      "Le serpent enserre les deux royaumes à la fois : à son éveil, +3 tickets Animal et +3 tickets Pokémon, sans choisir.",
    rules:
      "À chaque éveil : +3 tickets « pack Animal » · +3 tickets « pack Pokémon ».",
  },
  "animal:baku": {
    id: "festin-songes",
    name: "Le Festin des Songes",
    description:
      "Une fois par semaine, Baku dévore ton pire cauchemar : sur tes roues, la case ×1 devient une case ×2 jusqu'à la prochaine clôture. Tu ne peux plus mal tomber.",
    rules:
      "Une fois par semaine — à l'éveil : tes roues des jetons spéciaux remplacent leur case ×1 par une case ×2, jusqu'à la prochaine clôture. Impossible de repartir avec un seul jeton.",
    weekly: true,
  },
  "animal:hydra-primordial": {
    id: "tetes-sans-nombre",
    name: "Les Têtes Sans Nombre",
    description:
      "Chaque tête souffle sur une porte différente : à son éveil, +3 tickets Animal, +3 Pokémon et +3 Premium, d'un seul mouvement.",
    rules:
      "À chaque éveil : +3 tickets « pack Animal » · +3 « pack Pokémon » · +3 « pack Premium ».",
  },
  "animal:tiamat": {
    id: "mere-des-dragons",
    name: "La Mère des Dragons",
    description:
      "À son éveil, Tiamat dépose 3 tickets « pack Mythique » dans le chapeau. Personne d'autre au monde n'en donne autant.",
    rules:
      "À chaque éveil : +3 tickets « pack Mythique » (il part de 1 sur 100). Le plus gros don de Mythique du jeu.",
  },
  "animal:leviathan": {
    id: "pardon-abysses",
    name: "Le Pardon des Abysses",
    description:
      "Une fois par semaine, Léviathan pardonne la malchance : si ton dernier pack ouvert était un Basique, ton énergie survit entière à la clôture suivante.",
    rules:
      "Une fois par semaine — à l'éveil : à la prochaine clôture, si le DERNIER pack que tu as ouvert était un Basique, le chapeau n'est PAS remis à zéro — toute ton énergie survit.",
    weekly: true,
  },
  "animal:ziz": {
    id: "ombre-des-ailes",
    name: "L'Ombre des Ailes",
    description:
      "Une fois par semaine, l'oiseau-monde couvre le chapeau de son aile : tes packs refusent d'être Basiques — jusqu'à deux rerolls par pack, jusqu'à la prochaine clôture.",
    rules:
      "Une fois par semaine — à l'éveil : tes packs refusent d'être Basiques (jusqu'à deux relances par pack), jusqu'à la prochaine clôture.",
    weekly: true,
  },
  "animal:nidhogg": {
    id: "copeaux",
    name: "Les Copeaux du Rongeur",
    description:
      "Níðhöggr ronge les racines du monde et te laisse les copeaux : à chaque éveil, 2 fragments communs tombent dans ta réserve.",
    rules:
      "À chaque éveil : +2 fragments communs (animaux) dans ta réserve.",
  },
  "animal:ancient-dragon": {
    id: "premier-feu",
    name: "Le Premier Feu",
    description:
      "Le feu d'avant les feux : à son éveil, +5 tickets « pack Premium ». Le Sceau des légendaires, en plus ardent.",
    rules:
      "À chaque éveil : +5 tickets « pack Premium » (il part de 5 sur 100).",
  },
  "animal:orochi": {
    id: "huit-tetes",
    name: "Les Huit Têtes",
    description:
      "Chaque tête réclame sa part : à son éveil, +2 tickets Animal, +2 Pokémon, +2 Premium et +2 sur la case ×3 de la roue. Partout à la fois.",
    rules:
      "À chaque éveil : +2 tickets « pack Animal » · +2 « pack Pokémon » · +2 « pack Premium » · +2 sur la case ×3 de la roue.",
  },
  "animal:typhon": {
    id: "colere-du-pere",
    name: "La Colère du Père",
    description:
      "Une fois par semaine, le père des monstres secoue la roue : tes roues ne peuvent tomber que sur ×3 ou ×4, jusqu'à la prochaine clôture. La colère paie toujours.",
    rules:
      "Une fois par semaine — à l'éveil : tes roues des jetons spéciaux ne peuvent tomber que sur ×3 ou ×4, jusqu'à la prochaine clôture.",
    weekly: true,
  },
  "animal:apophis": {
    id: "devoreur-soleil",
    name: "Le Dévoreur de Soleil",
    description:
      "À son éveil, Apophis avale la lumière : 5 tickets Basique et 3 tickets Animal disparaissent du chapeau. Il ne reste que l'essentiel.",
    rules:
      "À chaque éveil : −5 tickets « pack Basique » · −3 tickets « pack Animal ».",
  },
  "animal:bahamut": {
    id: "grace",
    name: "La Grâce",
    description:
      "Une fois par semaine, le juge céleste te trouve digne : son éveil dépose un jeton normal dans ta réserve. Un pack offert, simplement.",
    rules:
      "Une fois par semaine — à l'éveil : +1 jeton normal, garanti.",
    weekly: true,
  },
  "animal:qilin": {
    id: "pas-fortune",
    name: "Le Pas de la Fortune",
    description:
      "Si c'est ta première séance de la semaine, le Qilin bénit tes roues : elles tournent sur ×2, ×3, ×4… ou ×10 jusqu'à la prochaine clôture. La chance marche dans ses pas.",
    rules:
      "Une fois par semaine — si c'est la 1ʳᵉ séance de ta semaine : tes roues tournent sur ×2 / ×3 / ×4 / ×10 au lieu de ×1 à ×4, jusqu'à la prochaine clôture. Sinon : rien.",
    weekly: true,
  },

  // ── Les 15 fabuleux ──
  "pokemon:jirachi": {
    id: "voeu",
    name: "Le Vœu",
    description:
      "Une fois par semaine, Jirachi ouvre les yeux et exauce un vœu : un jeton spécial apparaît dans ta réserve. La roue de la fortune t'attend.",
    rules:
      "Une fois par semaine — à l'éveil : +1 jeton spécial (un tour de roue gratuit).",
    weekly: true,
  },
  "pokemon:mew": {
    id: "origine",
    name: "L'Origine",
    description:
      "Mew épouse ta volonté, choisie sur sa machine : en mode attractif, il appelle 13 tickets Pokémon ; en mode répulsif, il dévore 13 tickets Basique.",
    rules:
      "À chaque éveil, selon la polarité que TU choisis sur sa fiche de machine : Attractif → +13 tickets « pack Pokémon » ; Répulsif → −13 tickets « pack Basique ».",
  },
  "pokemon:hoopa": {
    id: "passe-mondes",
    name: "Le Passe-Mondes",
    description:
      "Une fois par semaine, Hoopa ouvre deux anneaux à la fois : chacune de tes ouvertures tire deux packs et garde le meilleur, jusqu'à la prochaine clôture.",
    rules:
      "Une fois par semaine — à l'éveil : chaque ouverture tire DEUX packs et te donne le meilleur des deux, jusqu'à la prochaine clôture.",
    weekly: true,
  },
  "pokemon:shaymin-land": {
    id: "gratitude",
    name: "La Gratitude",
    description:
      "Shaymin remercie chaque effort : à son éveil, un fragment peu commun fleurit dans ta réserve. Petit, constant, fidèle.",
    rules:
      "À chaque éveil : +1 fragment peu commun (Pokémon) dans ta réserve.",
  },
  "pokemon:darkrai": {
    id: "nuit-devorante",
    name: "La Nuit Dévorante",
    description:
      "À son éveil, la nuit tombe sur le chapeau : 4 tickets Basique et 4 tickets Animal sombrent. Ce qui reste brille plus fort.",
    rules:
      "À chaque éveil : −4 tickets « pack Basique » · −4 tickets « pack Animal ».",
  },
  "pokemon:manaphy": {
    id: "chant-des-flots",
    name: "Le Chant des Flots",
    description:
      "Le cœur de l'océan appelle les siens : à son éveil, +8 tickets « pack Pokémon ». L'appel le plus puissant du jeu.",
    rules:
      "À chaque éveil : +8 tickets « pack Pokémon » (il part de 15 sur 100).",
  },
  "pokemon:victini": {
    id: "victoire-ecrite",
    name: "La Victoire Écrite",
    description:
      "La première fois de la semaine que tu bats un record — n'importe où —, Victini grave l'exploit : un fragment rare rejoint ta réserve.",
    rules:
      "Une fois par semaine — au premier record battu (charge max ou volume, n'importe quelle machine gardée) : +1 fragment rare (Pokémon).",
    weekly: true,
  },
  "pokemon:diancie": {
    id: "coeur-diamant",
    name: "Le Cœur de Diamant",
    description:
      "À son éveil, Diancie polit tes fragments : ta prochaine conversion de fragments rapporte un jeton de plus.",
    rules:
      "À chaque éveil : ta prochaine conversion de fragments en jetons rapporte +1 jeton.",
  },
  "pokemon:genesect": {
    id: "forge-vivante",
    name: "La Forge Vivante",
    description:
      "À son éveil, la machine de guerre remplit la Forge d'un coup : la Roue de la Forge est payée, un fragment t'attend au tirage, sans attendre.",
    rules:
      "À chaque éveil : remplit la jauge de Forge d'un coup (20/20) — un tour de la Roue de la Forge payé : un fragment garanti, sa rareté au tirage. La jauge est visible sur la Collection.",
  },
  "pokemon:celebi": {
    id: "second-souffle",
    name: "Le Second Souffle",
    description:
      "Tant que Celebi garde une machine, le temps te pardonne : à chaque nouvelle séance, la moitié de ton énergie non dépensée survit à la remise à zéro au lieu de tout perdre.",
    rules:
      "Tant qu'il est posé en Gardien (peu importe la machine) : à chaque remise à zéro du chapeau (clôture d'une nouvelle séance), la moitié de ton énergie non dépensée survit au lieu de tout perdre.",
  },
  "pokemon:deoxys-normal": {
    id: "adn-instable",
    name: "L'ADN Instable",
    description:
      "À son éveil, ses tickets mutent vers un pack tiré au sort : souvent Pokémon ou Animal, parfois Premium… et une fois sur vingt, le Mythique porté à son plafond.",
    rules:
      "À chaque éveil : +13 tickets vers UN pack au hasard — 40 % Pokémon, 30 % Animal, 25 % Premium — et 5 % Mythique (+9, son plafond).",
  },
  "pokemon:meloetta-aria": {
    id: "aria",
    name: "L'Aria",
    description:
      "Son chant charme la roue : à son éveil, +6 tickets sur la case ×3. La fortune aime la musique.",
    rules:
      "À chaque éveil : +6 tickets sur la case ×3 de la roue des jetons spéciaux.",
  },
  "pokemon:arceus": {
    id: "alpha-omega",
    name: "L'Alpha et l'Oméga",
    description:
      "Le créateur bénit sa garde : chaque autre Gardien attractif ou répulsif éveillé dans la même séance compte 1 point de plus.",
    rules:
      "À chaque éveil : chaque autre Gardien à polarité (commun → épique) éveillé dans la même séance gagne +1 ticket sur son geste.",
  },
  "pokemon:keldeo-ordinary": {
    id: "lame-resolue",
    name: "La Lame Résolue",
    description:
      "À la quatrième séance de ta semaine, Keldeo salue ta discipline : un jeton normal rejoint ta réserve. L'assiduité est une arme.",
    rules:
      "Une fois par semaine — si c'est la 4ᵉ séance de ta semaine : +1 jeton normal. Sinon : rien.",
    weekly: true,
  },
  "pokemon:volcanion": {
    id: "vapeur-sacree",
    name: "La Vapeur Sacrée",
    description:
      "À son éveil, Volcanion transmute la matière : 4 tickets Basique s'évaporent, 4 tickets Premium se condensent à leur place.",
    rules:
      "À chaque éveil : −4 tickets « pack Basique » · +4 tickets « pack Premium ».",
  },
};

export function miracleOf(
  category: "animal" | "pokemon",
  slug: string,
): Miracle | null {
  return MIRACLES[`${category}:${slug}`] ?? null;
}

// Les deux sens d'un métier, pour l'affichage en deux lignes : le delta en
// badge, l'effet en toutes lettres, et l'exemple chiffré avant → après.
export interface PolaritySide {
  delta: string;
  text: string;
  example: string;
}

const pct = (num: number, den: number, decimals = 1) =>
  `${((num / den) * 100).toFixed(decimals).replace(".", ",")} %`;


export function polarityBreakdown(
  category: "animal" | "pokemon",
  rarity: Rarity,
  subtype: string | null,
): { name: string; attract: PolaritySide; repel: PolaritySide } | null {
  if (rarity === "legendary" || rarity === "mythic") return null;
  const pts = POLARITY_POINTS[rarity] ?? 1;
  const family = category === "animal" ? "Animal" : "Pokémon";
  const base = 15; // poids de départ des packs Animal et Pokémon
  const metier = metierOf(category, subtype);

  if (metier === "lest") {
    return {
      name: "Le Lest",
      attract: {
        delta: `+${pts}`,
        text: `ticket${pts > 1 ? "s" : ""} Basique — pour farmer du commun`,
        example: `Pack Basique : 64,0 % → ${pct(64 + pts, 100 + pts)}`,
      },
      repel: {
        delta: `−${pts}`,
        text: `ticket${pts > 1 ? "s" : ""} Basique dévoré${pts > 1 ? "s" : ""} — tout le reste monte`,
        example: `Pack Basique : 64,0 % → ${pct(64 - pts, 100 - pts)}`,
      },
    };
  }
  if (metier === "etincelle") {
    const spark = (pts / 10).toFixed(1).replace(".", ",");
    return {
      name: "L'Étincelle",
      attract: {
        delta: `+${spark}`,
        text: "ticket Mythique semé — minuscule, mais ça s'accumule",
        example: `Pack Mythique : 1,00 % → ${pct(1 + pts / 10, 100 + pts / 10, 2)}`,
      },
      repel: {
        delta: `−${pts}`,
        text: `ticket${pts > 1 ? "s" : ""} Basique brûlé${pts > 1 ? "s" : ""}`,
        example: `Pack Basique : 64,0 % → ${pct(64 - pts, 100 - pts)}`,
      },
    };
  }
  if (metier === "balance") {
    const shift = pts;
    const ownShare = category === "animal" ? 75 : 25;
    const ownLabel = category === "animal" ? "Animaux" : "Pokémon";
    return {
      name: "La Balance",
      attract: {
        delta: `+${shift} %`,
        text: `de curseur vers ${category === "animal" ? "les animaux" : "les Pokémon"} dans les packs mixtes`,
        example: `${ownLabel} dans un pack mixte : ${ownShare} % → ${ownShare + shift} %`,
      },
      repel: {
        delta: `−${shift} %`,
        text: `de curseur : les packs mixtes penchent vers ${category === "animal" ? "les Pokémon" : "les animaux"}`,
        example: `${ownLabel} dans un pack mixte : ${ownShare} % → ${ownShare - shift} %`,
      },
    };
  }
  return {
    name: "La Famille",
    attract: {
      delta: `+${pts}`,
      text: `ticket${pts > 1 ? "s" : ""} « pack ${family} » à chaque éveil`,
      example: `Pack ${family} : 15,0 % → ${pct(base + pts, 100 + pts)}`,
    },
    repel: {
      delta: `−${pts}`,
      text: `ticket${pts > 1 ? "s" : ""} « pack ${family} » dévoré${pts > 1 ? "s" : ""}`,
      example: `Pack ${family} : 15,0 % → ${pct(base - pts, 100 - pts)}`,
    },
  };
}

// ─── Affichage : les étiquettes courtes (listes serrées) ────────────────────
// Pour le sélecteur de Gardien et les tirages de l'Échappée : ce que fait
// la carte, en trois mots. Les grandes cartes tirées par l'Échappée pèsent
// leur rang en Famille (±8 légendaire, ±13 mythique).
export function powerShorts(
  category: "animal" | "pokemon",
  subtype: string | null,
  rarity: Rarity,
): { tiny: string; attract: string; repel: string } {
  const family = category === "animal" ? "Animal" : "Pokémon";
  if (rarity === "legendary" || rarity === "mythic") {
    const pts = ENERGY_BY_RARITY[rarity];
    return {
      tiny: `±${pts} ${family}`,
      attract: `+${pts} ${family}`,
      repel: `−${pts} ${family}`,
    };
  }
  const pts = POLARITY_POINTS[rarity] ?? 1;
  const metier = metierOf(category, subtype);
  if (metier === "lest") {
    return {
      tiny: `±${pts} Basique`,
      attract: `+${pts} Basique`,
      repel: `−${pts} Basique`,
    };
  }
  if (metier === "etincelle") {
    const sparkTxt = (pts / 10).toFixed(1).replace(".", ",");
    return {
      tiny: `+${sparkTxt} Myth / −${pts} Bas`,
      attract: `+${sparkTxt} Mythique`,
      repel: `−${pts} Basique`,
    };
  }
  if (metier === "balance") {
    const own = category === "animal" ? "Animaux" : "Pokémon";
    const other = category === "animal" ? "Pokémon" : "Animaux";
    return {
      tiny: `±${pts} % curseur`,
      attract: `+${pts} % ${own}`,
      repel: `+${pts} % ${other}`,
    };
  }
  return {
    tiny: `±${pts} ${family}`,
    attract: `+${pts} ${family}`,
    repel: `−${pts} ${family}`,
  };
}

// ─── Affichage : le pouvoir d'une carte, en toutes lettres ──────────────────

export function powerLabel(
  category: "animal" | "pokemon",
  rarity: Rarity,
  subtype: string | null,
  slug?: string,
  mode?: MascotMode | null,
): { name: string; description: string; rules?: string } {
  if (rarity === "mythic" && slug) {
    const m = miracleOf(category, slug);
    if (m) return { name: m.name, description: m.description, rules: m.rules };
  }
  if (rarity === "legendary" || rarity === "mythic") {
    const p = slug ? prodigeOf(category, slug) : null;
    if (p) return { name: p.name, description: p.description, rules: prodigeRules(p) };
    return { name: "Prodige endormi", description: "Cette carte n'a pas encore reçu son prodige." };
  }
  const pts = POLARITY_POINTS[rarity] ?? 1;
  const family = category === "animal" ? "Animal" : "Pokémon";
  const other = category === "animal" ? "les animaux" : "les Pokémon";
  const metier = metierOf(category, subtype);

  if (metier === "lest") {
    if (mode === "attract")
      return { name: "Le Lest — Attractif", description: `À chaque éveil, ajoute ${pts} ticket${pts > 1 ? "s" : ""} « Basique » — pour farmer du commun.` };
    if (mode === "repel")
      return { name: "Le Lest — Répulsif", description: `À chaque éveil, dévore ${pts} ticket${pts > 1 ? "s" : ""} « Basique » — le chapeau s'allège, le reste monte.` };
    return { name: "Le Lest", description: `Il travaille le Basique : attractif il en ajoute ${pts}, répulsif il en dévore ${pts}. À toi de choisir à la pose.` };
  }
  if (metier === "etincelle") {
    const spark = (pts / 10).toFixed(1).replace(".", ",");
    if (mode === "attract")
      return { name: "L'Étincelle — Attractif", description: `À chaque éveil, sème ${spark} ticket « Mythique » dans le chapeau. Minuscule, mais ça s'accumule.` };
    if (mode === "repel")
      return { name: "L'Étincelle — Répulsif", description: `À chaque éveil, brûle ${pts} ticket${pts > 1 ? "s" : ""} « Basique ».` };
    return { name: "L'Étincelle", description: `Attractif, il sème ${spark} ticket « Mythique » par éveil ; répulsif, il brûle ${pts} Basique. À toi de choisir.` };
  }
  if (metier === "balance") {
    const shift = pts;
    if (mode === "attract")
      return { name: "La Balance — Attractif", description: `À chaque éveil, penche le tirage intérieur des packs mixtes de ${shift} % vers ${category === "animal" ? "les animaux" : "les Pokémon"}.` };
    if (mode === "repel")
      return { name: "La Balance — Répulsif", description: `À chaque éveil, penche le tirage intérieur des packs mixtes de ${shift} % vers ${category === "animal" ? "les Pokémon" : "les animaux"}.` };
    return { name: "La Balance", description: `Il penche le 75/25 des packs mixtes de ${shift} % — vers ${other} en attractif, vers l'autre famille en répulsif.` };
  }
  if (mode === "attract") {
    return {
      name: "La Famille — Attractif",
      description: `À chaque éveil, ajoute ${pts} ticket${pts > 1 ? "s" : ""} « pack ${family} » dans le chapeau.`,
    };
  }
  if (mode === "repel") {
    return {
      name: "La Famille — Répulsif",
      description: `À chaque éveil, dévore ${pts} ticket${pts > 1 ? "s" : ""} « pack ${family} » du chapeau.`,
    };
  }
  return {
    name: "La Famille",
    description: `À toi de choisir à la pose : attirer ou repousser ${pts} ticket${pts > 1 ? "s" : ""} du pack ${family} à chaque éveil.`,
  };
}

// ─── Le chapeau et la roue ──────────────────────────────────────────────────

export type Charges = Partial<Record<Direction, number>>;

// Plus de plancher : la répulsion peut vider un pack jusqu'à zéro. Le choix
// du joueur est souverain.
export function buildPackHat(charges: Charges): Record<PackType, number> {
  const c = (d: Direction) => charges[d] ?? 0;
  return {
    basic: Math.max(0, PACK_TYPE_WEIGHTS.basic + c("pack_basic") - c("purge_basic")),
    animal_only: Math.max(0, PACK_TYPE_WEIGHTS.animal_only + c("pack_animal") - c("repel_animal")),
    pokemon_only: Math.max(0, PACK_TYPE_WEIGHTS.pokemon_only + c("pack_pokemon") - c("repel_pokemon")),
    premium: PACK_TYPE_WEIGHTS.premium + c("pack_premium"),
    // Les étincelles comptent en dixièmes : le poids peut être fractionnaire,
    // le tirage s'en accommode très bien.
    mythic: PACK_TYPE_WEIGHTS.mythic + c("pack_mythic") + c("mythic_sparks") / 10,
  };
}

// La Balance : le tirage intérieur animal/pokémon des packs mixtes.
// 1 point = 1 % de curseur, borné pour qu'aucune famille ne disparaisse.
export function innerPokemonProb(base: number, charges: Charges): number {
  if (base <= 0 || base >= 1) return base; // packs forcés : pas de curseur
  const shift = ((charges.inner_pokemon ?? 0) - (charges.inner_animal ?? 0)) / 100;
  return Math.min(0.95, Math.max(0.05, base + shift));
}


// ─── Les Skins : le dé de rareté déformé ────────────────────────────────────
// Un gardien qui s'éveille avec son skin équipé déforme le tirage de rareté
// des packs jusqu'à la prochaine clôture. Barème PAR NIVEAU, en dixièmes de
// point de % (le niveau 5 touche au mythique par demi-point). Sommes nulles.
export const SKIN_DIRECTIONS = ["skin_l1", "skin_l2", "skin_l3", "skin_l4", "skin_l5"] as const;

export const SKIN_SHIFT_TENTHS: Record<number, Partial<Record<Rarity, number>>> = {
  1: { common: -20, uncommon: 20 },
  2: { common: -40, uncommon: 20, rare: 20 },
  3: { common: -60, uncommon: -10, rare: 50, epic: 20 },
  4: { common: -90, uncommon: -20, rare: 60, epic: 40, legendary: 10 },
  5: { common: -120, uncommon: -45, rare: 80, epic: 60, legendary: 20, mythic: 5 },
};


// Le tirage du skin de séance : le niveau se mérite. Poids de drop —
// un niveau 5 tombe environ une séance sur vingt.
export const SKIN_DROP_WEIGHTS: Record<number, number> = {
  1: 40, 2: 26, 3: 18, 4: 11, 5: 5,
};

// Le cumul est plafonné : jamais plus de −20 points de % sur le commun —
// au-delà, tout le shift est réduit proportionnellement.
const SKIN_COMMON_FLOOR_TENTHS = -200;

export function skinRarityShiftTenths(charges: Charges): Partial<Record<Rarity, number>> {
  const total: Partial<Record<Rarity, number>> = {};
  for (let level = 1; level <= 5; level++) {
    const count = charges[`skin_l${level}` as Direction] ?? 0;
    if (count <= 0) continue;
    for (const [r, t] of Object.entries(SKIN_SHIFT_TENTHS[level]) as [Rarity, number][]) {
      total[r] = (total[r] ?? 0) + t * count;
    }
  }
  const commonDrop = total.common ?? 0;
  if (commonDrop < SKIN_COMMON_FLOOR_TENTHS) {
    const scale = SKIN_COMMON_FLOOR_TENTHS / commonDrop;
    for (const r of Object.keys(total) as Rarity[]) {
      total[r] = Math.round((total[r] ?? 0) * scale);
    }
  }
  return total;
}

// La roue de base : 1 jeton spécial → 1 à 4 jetons normaux. Les sorts des
// Prodiges et Miracles la transforment (une seule transformation à la fois,
// la plus puissante l'emporte : Qilin > Typhon > Baku > Roue pipée).
export const WHEEL_BASE: { reward: number; weight: number }[] = [
  { reward: 1, weight: 20 },
  { reward: 2, weight: 60 },
  { reward: 3, weight: 19 },
  { reward: 4, weight: 1 },
];

export function buildWheel(charges: Charges): { reward: number; weight: number }[] {
  const x3 = charges.wheel_x3 ?? 0;
  if ((charges.qilin_wheel ?? 0) > 0) {
    return [
      { reward: 2, weight: 20 },
      { reward: 3, weight: 60 + x3 },
      { reward: 4, weight: 19 },
      { reward: 10, weight: 1 },
    ];
  }
  if ((charges.wheel_34 ?? 0) > 0) {
    return [
      { reward: 3, weight: 80 + x3 },
      { reward: 4, weight: 20 },
    ];
  }
  if ((charges.wheel_min2 ?? 0) > 0) {
    return [
      { reward: 2, weight: 80 },
      { reward: 3, weight: 19 + x3 },
      { reward: 4, weight: 1 },
    ];
  }
  if ((charges.wheel_no_x1 ?? 0) > 0) {
    return [
      { reward: 2, weight: 60 },
      { reward: 3, weight: 19 + x3 },
      { reward: 4, weight: 1 },
    ];
  }
  return WHEEL_BASE.map((o) => ({
    reward: o.reward,
    weight: o.reward === 3 ? o.weight + x3 : o.weight,
  }));
}

// Directions consommées à l'ouverture d'un pack.
export const HAT_DIRECTIONS: Direction[] = [
  "pack_animal",
  "pack_pokemon",
  "repel_animal",
  "repel_pokemon",
  "pack_basic",
  "pack_premium",
  "pack_mythic",
  "mythic_sparks",
  "purge_basic",
  "inner_pokemon",
  "inner_animal",
];

// Sorts de roue, consommés au prochain tour.
export const WHEEL_SPELLS: Direction[] = [
  "wheel_x3",
  "wheel_no_x1",
  "wheel_min2",
  "wheel_34",
  "qilin_wheel",
];

export const FORGE_THRESHOLD = 20;

// ─── La Roue de la Forge ────────────────────────────────────────────────────
// La fusion coûte TOUJOURS 3 fragments. La jauge de Forge sert à autre
// chose : pleine (10 points), elle paie un tour de la Roue de la Forge —
// un fragment garanti, dont la rareté se joue aux pourcentages.
export const FORGE_WHEEL_COST = 20;

// Pas de fragment légendaire ni mythique : la Roue s'arrête à l'épique.
export const FORGE_WHEEL_ODDS: Partial<Record<Rarity, number>> = {
  common: 42,
  uncommon: 30,
  rare: 18,
  epic: 10,
};

// Tirage pur (injectable pour les tests) : renvoie la rareté gagnée.
export function drawForgeFragment(rand: () => number = Math.random): Rarity {
  const entries = Object.entries(FORGE_WHEEL_ODDS) as [Rarity, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let roll = rand() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll < 0) return rarity;
  }
  return "common";
}

// Le Gardien lié : record battu depuis la pose, ou 30 jours d'attente.
export const GUARDIAN_BOND_DAYS = 30;

// ─── La Magnésie ────────────────────────────────────────────────────────────
// La poudre qui délie. Environ 10 % des cartes du catalogue la portent —
// tirées au sort une fois pour toutes (hachage stable du slug, personne ne
// choisit). Quand une porteuse s'éveille (Gardienne posée ou renfort de
// l'Échappée), elle dépose sa magnésie EN PLUS de son pouvoir.
// Elle sert à une seule chose : délier un Gardien lié sans attendre les
// 30 jours ni battre de record — au prix du rang de la carte libérée.

export const MAGNESIE_YIELD: Record<Rarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
  mythic: 8,
};

// Le prix du déliement, selon la rareté du Gardien qu'on libère.
export const UNBIND_PRICE: Record<Rarity, number> = {
  common: 4,
  uncommon: 6,
  rare: 9,
  epic: 12,
  legendary: 16,
  mythic: 20,
};

// Hachage djb2 : stable pour toujours, indépendant de la base.
function slugHash(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

// La carte porte-t-elle la magnésie ? ~10 % du catalogue, à jamais fixe.
export function magnesieOf(
  category: "animal" | "pokemon",
  slug: string,
  rarity: Rarity,
): number | null {
  return slugHash(`${category}:${slug}`) % 10 === 0 ? MAGNESIE_YIELD[rarity] : null;
}

// L'Échappée : sur une machine de cardio, chaque quart d'heure ENTAMÉ
// après le premier tire une carte au hasard dans la réserve (les cartes
// possédées non associées à une machine), à placer en attractif ou
// répulsif à la clôture.
//   14 min → 0 · 16 min → 1 · 29 min → 1 · 31 min → 2 · 61 min → 4
export function cardioDrawCount(minutes: number): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.max(0, Math.ceil(minutes / 15) - 1);
}

// Nombre minimal de séances d'historique sur une machine pour qu'un record
// y compte (badge, Gardiens à record : Banshee, Sphinx, Marshadow…) : sans
// ce verrou, la première séance est un record automatique.
export const RECORD_MIN_HISTORY = 3;

export function clampCharge(direction: Direction, points: number): number {
  return Math.max(0, Math.min(DIRECTION_CAPS[direction], points));
}
