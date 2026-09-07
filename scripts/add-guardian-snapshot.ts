import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { config } from "dotenv";

config({ path: ".env.local" });

// La mémoire des Gardiens : qui gardait la machine au moment de la
// clôture — photographié sur session_exercises. Idempotent.
async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));
  await db.execute(sql`ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS guardian_category text`);
  await db.execute(sql`ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS guardian_card_id integer`);
  await db.execute(sql`ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS guardian_mode text`);
  console.log("colonnes de mémoire prêtes");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
