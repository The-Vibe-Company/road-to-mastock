// Migration additive et idempotente : users.last_pack_type (text, nullable).
// Lu par le Pardon des Abysses à la clôture.
async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { neon } = await import("@neondatabase/serverless");
  const sqlc = neon(process.env.DATABASE_URL!);
  await sqlc`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pack_type text`;
  console.log("users.last_pack_type ok");
}
main();
