// Remplit le catalogue card_skins : 5 concepts nommés par carte (niveau
// 1..5), choisis dans des banques d'archétypes par niveau, filtrés par
// affinité (eau/air/terre) et seedés par slug — stable et re-runnable
// (ON CONFLICT DO NOTHING). Les images viennent après (generate-skins).
type Affinity = "water" | "air" | "any";

interface Archetype {
  name: string; // le nom FR du skin
  scene: string; // la scène, côté prompt EN
  needs?: Affinity; // réservé aux créatures compatibles
}

// ── Niveau 1 : la petite vie tranquille ──
const L1: Archetype[] = [
  { name: "Cuisine de Minuit", scene: "in its cozy little home kitchen at night, wearing a comfy apron and a chef hat, happily cooking a bubbling colorful soup, floating utensils and jars around, warm homely light" },
  { name: "Sieste au Soleil", scene: "taking a blissful nap in a hammock between two trees on a lazy sunny afternoon, a straw hat over its eyes, butterflies drifting by, peaceful garden" },
  { name: "Jardinier du Dimanche", scene: "proudly watering a small vegetable garden with a tiny watering can, wearing gardening gloves and a sun hat, flowers and vegetables thriving around it" },
  { name: "Coin du Feu", scene: "curled up in a big armchair by a crackling fireplace, reading a large storybook with tiny reading glasses, a mug of hot cocoa steaming beside it, cozy winter evening" },
  { name: "Grand Bain", scene: "relaxing in an overflowing bubble bath, a rubber duck on its head, shower cap, bathroom tiles and steam, delighted expression" },
  { name: "Petit Déj au Lit", scene: "having a huge joyful breakfast in a fluffy bed, tray piled with pancakes and fruit, morning sunlight through the curtains, crumbs everywhere" },
  { name: "Soir de Tricot", scene: "knitting an endless colorful scarf in a rocking chair, balls of yarn everywhere, a cat-shaped clock on the wall, warm lamplight" },
  { name: "Artiste du Dimanche", scene: "painting at an easel in a sunlit room, wearing a beret, paint splashes on its fur, a slightly wonky self-portrait on the canvas" },
  { name: "Pêche Tranquille", scene: "fishing peacefully from a small wooden pontoon at dawn, bucket of fish beside it, mist over the calm water, content little smile", needs: "water" },
  { name: "Ménage de Printemps", scene: "doing spring cleaning with a feather duster and polka-dot bandana, dust bunnies fleeing, sparkles on every polished surface, satisfied grin" },
  { name: "Soirée Jeux", scene: "playing a retro video game on a bean bag in a dim room, screen glow on its face, controller in paws, snacks scattered around, absorbed expression" },
  { name: "Marché du Matin", scene: "strolling through a cheerful morning market with a woven basket full of fruit and bread, chatting with stall keepers, sunny village square" },
];

// ── Niveau 2 : l'activité fun ──
const L2: Archetype[] = [
  { name: "Roi de la Rampe", scene: "doing a spectacular skateboard trick on a graffiti-covered halfpipe, cap turned backwards, motion blur and flying sparks, urban golden hour" },
  { name: "Session Surf", scene: "riding a huge turquoise wave on a surfboard, spray and sunlight, total joy, tropical shore in the distance", needs: "water" },
  { name: "Concert de Garage", scene: "shredding an electric guitar on a garage stage, amps and cables, colored spotlights, small crowd of cheering creatures" },
  { name: "Chasse au Trésor", scene: "digging up a treasure chest on a beach with an old map in one paw, gold coins spilling, seagulls circling, adventure grin" },
  { name: "Feu de Camp", scene: "roasting marshmallows over a campfire at night in a forest clearing, tent behind, starry sky, singing with a tiny guitar" },
  { name: "Photographe Sauvage", scene: "crouching with a big camera photographing butterflies in a meadow, safari vest and lens cap in its teeth, golden light" },
  { name: "Marchand de Glaces", scene: "running a cheerful ice cream cart in a summer park, juggling scoops of ice cream, delighted queue of small creatures" },
  { name: "Fièvre du Dancefloor", scene: "striking a disco pose on a glowing dance floor, mirror ball above, flared collar, colorful lights, crowd clapping" },
  { name: "Grand Prix", scene: "racing a go-kart through a curve, scarf flying, checkered flags and hay bales, determined face, dust cloud behind" },
  { name: "Festival des Cerfs-Volants", scene: "flying a giant colorful kite on a windy hill, almost lifted off the ground, laughing, clouds racing" },
  { name: "Boulanger Fou", scene: "in a bakery kneading dough with flour everywhere, tall baker hat, ovens glowing, absurd tower of croissants" },
  { name: "Plongeon Olympique", scene: "mid-air in a perfect dive from a high diving board, sparkling pool below, judges holding up 10s", needs: "water" },
];

// ── Niveau 3 : le style assumé ──
const L3: Archetype[] = [
  { name: "Le Corsaire", scene: "as a pirate captain on the deck of a weathered ship, tricorne hat and captain coat, one paw on a cutlass, stormy sea and rigging, dramatic wind" },
  { name: "Voie du Sabre", scene: "as a samurai in ornate armor under a falling cherry blossom tree, katana drawn in a poised stance, temple gate in the mist" },
  { name: "L'Illusionniste", scene: "as a stage magician in a nocturnal circus, top hat and elegant cape, glowing playing cards floating in an arc, dramatic spotlights" },
  { name: "Détective Privé", scene: "as a noir detective in a trench coat under a streetlamp in the rain, fedora tilted, magnifying glass in paw, mysterious city night" },
  { name: "Chevalier d'Argent", scene: "as a noble knight in gleaming engraved armor, holding a banner, castle courtyard at dawn, cape flowing" },
  { name: "Nuit du Biker", scene: "as a biker leaning on a chrome motorcycle at sunset, leather jacket and shades, desert highway, cinematic backlight" },
  { name: "DJ des Ombres", scene: "as a DJ behind glowing turntables at a rooftop party, headphones on, neon skyline, hands raised crowd" },
  { name: "Le Dandy", scene: "as an impeccable dandy in a three-piece suit with a monocle and cane, grand staircase of an opera house, chandelier light" },
  { name: "Étoile du Rodéo", scene: "as a cowboy twirling a lasso on a wooden fence at golden hour, hat and poncho, tumbleweed and canyon" },
  { name: "Mission Orbitale", scene: "as an astronaut floating outside a space station, reflective visor showing Earth, tools drifting, deep blue space" },
  { name: "L'Alchimiste", scene: "as an alchemist in a cluttered workshop of glowing potions, rune-covered coat, holding a luminous vial, ancient books stacked" },
  { name: "Capitaine des Abysses", scene: "as a deep-sea submarine captain in a brass diving suit helmet under one arm, bioluminescent creatures outside the porthole", needs: "water" },
];

// ── Niveau 4 : le règne ──
const L4: Archetype[] = [
  { name: "Salle du Trône", scene: "seated on a magnificent throne in a grand hall, crown and royal mantle, banners bearing its silhouette, a court of small creatures bowing, epic scale" },
  { name: "Parade Triomphale", scene: "as a victorious general standing on a parade chariot in a celebrating city, confetti rain, legions saluting, golden armor, monumental avenue" },
  { name: "Gardien du Temple", scene: "as a colossal guardian statue come to life at the gates of an ancient mountain temple, glowing runes on its stone-armored body, pilgrims tiny below, torchlight" },
  { name: "Maître de la Grande Forge", scene: "as a legendary forge master hammering a giant glowing blade on an anvil, sparks like fireworks, rivers of molten metal, apprentice creatures watching in awe" },
  { name: "Roi du Festival", scene: "crowned king of a giant night festival held in its honor, fireworks spelling its silhouette, sea of lanterns, cheering crowd, grand stage" },
  { name: "Seigneur des Tempêtes", scene: "standing on a cliff commanding a dramatic storm, lightning striking around, cape whipping, waves crashing far below, unshaken and regal" },
  { name: "Protecteur de la Cité", scene: "as a giant protector standing over a city skyline at dusk, gently holding back storm clouds with one paw, citizens watching with gratitude from rooftops" },
  { name: "Champion de l'Arène", scene: "raising a championship belt in a colossal packed arena, spotlights crossing, its name in lights, thunderous ovation, confetti storm" },
  { name: "L'Amiral", scene: "as an admiral at the prow of a majestic flagship leading a fleet through golden mist, ceremonial uniform, cannons saluting", needs: "water" },
  { name: "Bibliothécaire Éternel", scene: "as the sovereign keeper of an infinite library, floating books orbiting like planets, staircases of knowledge spiraling into light, wise and mighty" },
];

// ── Niveau 5 : l'apothéose ──
const L5: Archetype[] = [
  { name: "Forme Constellation", scene: "as a vast constellation come alive in the night sky, body drawn in stars and nebula lines, shooting stars trailing from its movements, cosmic wonder" },
  { name: "Esprit de la Forêt", scene: "as a mountain-sized forest spirit, moss and glowing flowers growing on its body, ancient trees like fur, fireflies orbiting, mystical dawn light" },
  { name: "Avatar de la Flamme", scene: "as a majestic elemental avatar of living flame and gold, rising from a volcanic caldera, embers spiraling like galaxies, radiant and serene" },
  { name: "Gardien Céleste", scene: "as a celestial guardian with golden rings and halos rotating around its body, floating above a sea of clouds at sunrise, rays of divine light" },
  { name: "Cœur de Cristal", scene: "as a translucent crystalline titan, body refracting rainbows, standing in a canyon of giant amethysts under auroras, breathtaking purity" },
  { name: "Aurore Vivante", scene: "as a living aurora borealis, immense and luminous, flowing across a polar sky above frozen peaks, colors rippling through its translucent form" },
  { name: "Marée Éternelle", scene: "as a titanic spirit of the ocean rising from the deep, body of living water and moonlight, whales swimming through its silhouette, sublime", needs: "water" },
  { name: "Souffle du Ciel", scene: "as an immense sky spirit gliding among cathedral clouds, wings or fins of wind and light stretching to the horizon, sun rays crowning it", needs: "air" },
  { name: "Éclipse Couronnée", scene: "as a cosmic sovereign silhouetted against a total solar eclipse, corona of light forming its crown, stardust cape drifting into space, awe and majesty" },
  { name: "Jardin des Étoiles", scene: "as a colossal serene gardener of stars, planting tiny glowing suns in a field of night, galaxies blooming like flowers where it walks" },
];

const BANKS: Archetype[][] = [L1, L2, L3, L4, L5];

function djb2(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h;
}

function affinities(habitat: string | null, type: string | null): Set<Affinity> {
  const s = `${habitat ?? ""} ${type ?? ""}`.toLowerCase();
  const out = new Set<Affinity>(["any"]);
  if (/water|mer|océan|ocean|riviè|lac|marin|aquatique|abysse|récif|fleuve|étang|plage/.test(s)) out.add("water");
  if (/flying|vol|ciel|montagne|air|nuage|falaise/.test(s)) out.add("air");
  return out;
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { neon } = await import("@neondatabase/serverless");
  const sqlc = neon(process.env.DATABASE_URL!);

  const animals = await sqlc`SELECT id, slug, name, habitat, lineage FROM animals`;
  const pokemon = await sqlc`SELECT id, slug, name, habitat, primary_type FROM pokemon`;
  const cards = [
    ...animals.map((a: Record<string, unknown>) => ({ category: "animal", id: a.id as number, slug: a.slug as string, habitat: a.habitat as string | null, type: a.lineage as string | null })),
    ...pokemon.map((p: Record<string, unknown>) => ({ category: "pokemon", id: p.id as number, slug: p.slug as string, habitat: p.habitat as string | null, type: p.primary_type as string | null })),
  ];

  let inserted = 0;
  for (const card of cards) {
    const aff = affinities(card.habitat, card.type);
    const seed = djb2(`${card.category}:${card.slug}`);
    for (let level = 1; level <= 5; level++) {
      const bank = BANKS[level - 1].filter((a) => !a.needs || aff.has(a.needs));
      const pick = bank[(seed + level * 7919) % bank.length];
      const rows = await sqlc`
        INSERT INTO card_skins (category, card_id, level, name, concept)
        VALUES (${card.category}, ${card.id}, ${level}, ${pick.name}, ${pick.scene})
        ON CONFLICT (category, card_id, level) DO NOTHING RETURNING id`;
      inserted += rows.length;
    }
  }
  const [total] = await sqlc`SELECT COUNT(*)::int AS n FROM card_skins`;
  console.log(`insérés: ${inserted} · total catalogue: ${total.n}`);
}
main();

export {};
