// Le flag du skin de bienvenue : offert une fois par joueur à l'annonce.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS skin_gift_granted boolean NOT NULL DEFAULT false`);
  console.log("users.skin_gift_granted ok");
}
main();

export {};
