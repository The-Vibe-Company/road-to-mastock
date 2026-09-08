// Migration additive et idempotente : le catalogue des skins, la possession,
// et le skin équipé par carte.
async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { neon } = await import("@neondatabase/serverless");
  const sqlc = neon(process.env.DATABASE_URL!);
  await sqlc`CREATE TABLE IF NOT EXISTS card_skins (
    id serial PRIMARY KEY,
    category text NOT NULL,
    card_id integer NOT NULL,
    level integer NOT NULL,
    name text NOT NULL,
    concept text NOT NULL,
    image_url text,
    status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    UNIQUE (category, card_id, level)
  )`;
  await sqlc`CREATE TABLE IF NOT EXISTS user_skins (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skin_id integer NOT NULL REFERENCES card_skins(id) ON DELETE CASCADE,
    obtained_at timestamptz DEFAULT now(),
    UNIQUE (user_id, skin_id)
  )`;
  await sqlc`ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS equipped_skin_level integer`;
  await sqlc`ALTER TABLE user_pokemon_cards ADD COLUMN IF NOT EXISTS equipped_skin_level integer`;
  console.log("migration skins ok");
}
main();

export {};
