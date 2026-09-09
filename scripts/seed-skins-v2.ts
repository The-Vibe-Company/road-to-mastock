// Re-seed des 10 000 concepts de skins depuis les lots écrits par les agents
// rédacteurs (out-NN.json). Les lignes card_skins sont mises à jour EN PLACE
// (ids stables), remises à pending sans image — sauf les gardiens d'Ectoplasma
// validés à la calibration : n2 « Farceur d'Halloween » et n3 « L'Illusionniste ».
//
//   npx tsx scripts/seed-skins-v2.ts <dossier-des-out-NN.json>
import { config } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
config({ path: ".env.local" });

interface Concept {
  category: "animal" | "pokemon";
  card_id: number;
  level: number;
  name: string;
  concept: string;
}

const KEEPERS = new Set(["pokemon:55:2", "pokemon:55:3"]);

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: seed-skins-v2.ts <dossier>");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const all: Concept[] = [];
  const files = readdirSync(dir)
    .filter((f) => /^out-.*\.json$/.test(f) && !f.includes("before"))
    .sort();
  for (const f of files) {
    const arr = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Concept[];
    all.push(...arr);
    console.log(`${f}: ${arr.length} concepts`);
  }

  // Validation : 5 niveaux exacts par carte, EXPRESSION présente, noms dédupliqués.
  const byCard = new Map<string, Concept[]>();
  for (const c of all) {
    const k = `${c.category}:${c.card_id}`;
    if (!byCard.has(k)) byCard.set(k, []);
    byCard.get(k)!.push(c);
  }
  let bad = 0;
  for (const [k, list] of byCard) {
    const levels = new Set(list.map((c) => c.level));
    if (list.length !== 5 || levels.size !== 5) {
      console.log(`⚠ ${k}: ${list.length} concepts, niveaux ${[...levels].join(",")}`);
      bad++;
    }
    const seen = new Set<string>();
    for (const c of list) {
      if (!/EXPRESSION/i.test(c.concept)) c.concept += " EXPRESSION: lively unique expression fitting the scene.";
      let name = c.name.trim().slice(0, 80);
      while (seen.has(name.toLowerCase())) name = `${name} ★`;
      seen.add(name.toLowerCase());
      c.name = name;
    }
  }
  console.log(`${byCard.size} cartes, ${all.length} concepts, ${bad} cartes incomplètes`);
  if (bad > 0 && !process.argv.includes("--force")) throw new Error("cartes incomplètes — corrige ou --force");

  // Purge des user_skins de test qui ne pointent pas sur les gardiens.
  await sql.query(`DELETE FROM user_skins WHERE skin_id NOT IN (SELECT id FROM card_skins WHERE category='pokemon' AND card_id=55 AND level IN (2,3))`);

  // Mise à jour en place, par paquets.
  let updated = 0;
  let skipped = 0;
  const rows = all.filter((c) => {
    if (KEEPERS.has(`${c.category}:${c.card_id}:${c.level}`)) { skipped++; return false; }
    return true;
  });
  const CHUNK = 250;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = slice
      .map((_, j) => `($${j * 5 + 1}, $${j * 5 + 2}::int, $${j * 5 + 3}::int, $${j * 5 + 4}, $${j * 5 + 5})`)
      .join(",");
    const params = slice.flatMap((c) => [c.category, c.card_id, c.level, c.name, c.concept]);
    await sql.query(
      `UPDATE card_skins cs SET name = v.name, concept = v.concept,
         status = 'pending', attempts = 0, image_url = NULL, updated_at = NOW()
       FROM (VALUES ${values}) AS v(category, card_id, level, name, concept)
       WHERE cs.category = v.category AND cs.card_id = v.card_id AND cs.level = v.level`,
      params,
    );
    updated += slice.length;
    if (updated % 2000 < CHUNK) console.log(`  ${updated}/${rows.length}...`);
  }
  const [check] = (await sql.query(`SELECT COUNT(*)::int n FROM card_skins WHERE status='pending'`)) as { n: number }[];
  console.log(`TERMINÉ: ${updated} mis à jour, ${skipped} gardiens préservés, ${check.n} pending en base`);
}
main();

export {};
