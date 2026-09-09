// Récupère la dernière base et le dernier skin générés (nom, rareté/niveau,
// URL), télécharge les deux dans /tmp/rtm-qc-{base,skin}.png et imprime une
// ligne de légende par image pour le QC du point d'étape.
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const [base] = (await sql.query(`
    SELECT COALESCE(a.name, p.name) AS name, COALESCE(a.rarity, p.rarity) AS rarity,
           COALESCE(a.image_url, p.image_url) AS url, br.updated_at
    FROM base_regen br
    LEFT JOIN animals a ON br.category='animal' AND a.id = br.card_id
    LEFT JOIN pokemon p ON br.category='pokemon' AND p.id = br.card_id
    WHERE br.status = 'done' AND br.updated_at < NOW() - INTERVAL '90 seconds'
    ORDER BY br.updated_at DESC LIMIT 1
  `)) as unknown as { name: string; rarity: string; url: string; updated_at: string }[];
  const [skin] = (await sql.query(`
    SELECT cs.name AS skin_name, cs.level, cs.image_url AS url,
           COALESCE(a.name, p.name) AS card_name
    FROM card_skins cs
    LEFT JOIN animals a ON cs.category='animal' AND a.id = cs.card_id
    LEFT JOIN pokemon p ON cs.category='pokemon' AND p.id = cs.card_id
    WHERE cs.status = 'done' AND cs.image_url IS NOT NULL
      AND cs.updated_at < NOW() - INTERVAL '90 seconds'
    ORDER BY cs.updated_at DESC LIMIT 1
  `)) as unknown as { skin_name: string; level: number; url: string; card_name: string }[];

  if (base) {
    const res = await fetch(`${base.url}?v=${Date.now()}`);
    writeFileSync("/tmp/rtm-qc-base.png", Buffer.from(await res.arrayBuffer()));
    console.log(`BASE: ${base.name} (${base.rarity})`);
  } else console.log("BASE: aucune");
  if (skin) {
    const res = await fetch(`${skin.url}?v=${Date.now()}`);
    writeFileSync("/tmp/rtm-qc-skin.png", Buffer.from(await res.arrayBuffer()));
    console.log(`SKIN: ${skin.card_name} — « ${skin.skin_name} » (n${skin.level})`);
  } else console.log("SKIN: aucun");
}
main();

export {};
