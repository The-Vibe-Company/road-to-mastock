// Table de suivi de la régénération des 2000 cartes de base (DA unifiée).
// Idempotent : la table est créée si absente, le seed n'insère que les manquants.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS base_regen (
      id serial PRIMARY KEY,
      category text NOT NULL,
      card_id int NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts int NOT NULL DEFAULT 0,
      orig_url text,
      updated_at timestamptz DEFAULT now(),
      UNIQUE(category, card_id)
    )
  `);
  await sql.query(`
    INSERT INTO base_regen (category, card_id)
    SELECT 'animal', id FROM animals
    ON CONFLICT (category, card_id) DO NOTHING
  `);
  await sql.query(`
    INSERT INTO base_regen (category, card_id)
    SELECT 'pokemon', id FROM pokemon
    ON CONFLICT (category, card_id) DO NOTHING
  `);
  const [c] = await sql.query(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE status='pending')::int p FROM base_regen`) as { n: number; p: number }[];
  console.log(`base_regen: ${c.n} lignes, ${c.p} pending`);
}
main();

export {};
