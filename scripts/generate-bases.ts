// L'usine à cartes de base : repeint les 2000 cartes dans la DA unifiée
// (gaming 3D cartoon + socle gradué par rareté), en écrasant l'image en
// place (même URL) après avoir archivé l'originale dans cards/originals/.
//
//   npx tsx scripts/generate-bases.ts [--limit N] [--concurrency 4]
//
// Reprise sur simple relance : seuls les pending/retry repartent. Quand la
// file est vide, les blocked sont requeués (cycles longs, pause 20 min)
// jusqu'à MAX_CYCLES — les stars IP finissent par passer à l'usure.
//
// Échelle de retries (leçon Salamèche/Kyogre) :
//   animal   : low → low → high → high+angle
//   pokémon  : nommé+high → anonyme+high → anonyme+high+angle → anonyme+low
import { config } from "dotenv";
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
config({ path: ".env.local" });

const DA =
  "REPAINTED in a vibrant stylized 3D cartoon VIDEO-GAME art style (Clash Royale × Zelda): chunky appealing proportions, big expressive glossy eyes, smooth hand-painted textures, bold saturated colors, punchy lighting — NOT photorealistic. KEEP the character itself: same species, same face, same colors and markings, same personality. This BASE CARD drops the old uniform dress-up kits: REMOVE the generic accessories seen in the reference (eye bandanas, scarves, satchels, flowers, bell collars, necklaces) — keep only an item that is truly iconic for THIS character (a crown, an armor, a legendary weapon). IMPORTANT: if the reference wears a dark band or mask across the eyes, it is a COSTUME, NOT the animal's face — remove it completely and paint the species' TRUE natural facial fur and colors instead. THEN give the creature ONE small fun signature detail of your own invention that fits its personality, species or name — a quirky little prop or trait, unique to this creature, never the same from one card to another (or none, if the creature is more striking plain).";
const FIN = "The character is LARGE in frame and fills most of the canvas with its pedestal — tight heroic composition, minimal empty background around it. Full character visible, centered, square composition. No text, no borders, no card frame.";
const PEDESTALS: Record<string, string> = {
  common:
    "on a small plain round stone base with a tuft of grass — COMMON tier: simple rough stone pedestal, no ornaments, soft neutral studio gradient background, clean and iconic",
  uncommon:
    "on a mossy stone pedestal with copper accents — UNCOMMON tier: a soft green glow rising around the base, gentle studio gradient background",
  rare:
    "above a carved stone base engraved with glowing blue runes — RARE tier: subtle sapphire sparkles rising, soft studio gradient background",
  epic:
    "on a sculpted dark-violet base with amethyst crystals — EPIC tier: purple mist wisps curling around the pedestal, soft studio gradient background",
  legendary:
    "floating above an ornate golden engraved pedestal with tiny gems — LEGENDARY tier: golden light flecks floating, regal soft studio gradient background",
  mythic:
    "on a celestial crimson-and-gold pedestal with floating rock fragments and tiny embers orbiting — MYTHIC tier: a faint deep-RED constellation aura, dark crimson cosmic studio gradient background",
};
const ANGLE = " seen from a slightly different three-quarter angle,";
const MAX_ATTEMPTS = 4;
const MAX_CYCLES = 10;
const CACHE = "/tmp/rtm-base-refs";
const OUTDIR = "/tmp/rtm-base-out";

interface Row {
  id: number;
  category: "animal" | "pokemon";
  card_id: number;
  attempts: number;
  orig_url: string | null;
  name: string;
  slug: string;
  rarity: string;
  description: string | null;
  image_url: string;
}

function subjectFor(r: Row, attempt: number): { subject: string; fidelity: string } {
  if (r.category === "pokemon") {
    const proper = r.slug.charAt(0).toUpperCase() + r.slug.slice(1).replace(/-/g, " ");
    if (attempt === 0) return { subject: `${proper} the Pokémon character from the reference image,`, fidelity: "high" };
    if (attempt === 1) return { subject: `The creature character from the reference image (keep its exact design),`, fidelity: "high" };
    if (attempt === 2) return { subject: `The creature character from the reference image (keep its exact design),${ANGLE}`, fidelity: "high" };
    return { subject: `The creature character from the reference image (keep its exact design),`, fidelity: "low" };
  }
  const desc = (r.description ?? "").split(/[.!]/)[0]?.trim();
  const base = `The creature "${r.name}" from the reference image${desc ? ` (${desc})` : ""},`;
  if (attempt <= 1) return { subject: base, fidelity: "low" };
  if (attempt === 2) return { subject: base, fidelity: "high" };
  return { subject: `${base}${ANGLE}`, fidelity: "high" };
}

function genOnce(prompt: string, out: string, ref: string, fidelity: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "python3",
      ["scripts/gen-image.py", prompt, "-o", out, "-a", "1:1", "--input-image", ref, "--input-fidelity", fidelity],
      { timeout: 620000 },
      (err, _stdout, stderr) => {
        if (err) return reject(new Error(String(stderr || err.message).slice(-220)));
        if (!existsSync(out)) return reject(new Error("pas de fichier produit"));
        resolve();
      },
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string, dflt: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const limit = Number(opt("limit", "100000"));
  let concurrency = Number(opt("concurrency", "4"));
  const maxC = Number(opt("max-concurrency", "7"));
  if (!process.env.AZURE_OPENAI_API_KEY) throw new Error("AZURE_OPENAI_API_KEY manquant");
  const { neon } = await import("@neondatabase/serverless");
  const sqlc = neon(process.env.DATABASE_URL!);
  const { put } = await import("@vercel/blob");
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUTDIR, { recursive: true });

  let done = 0;
  let blocked = 0;
  let consecFails = 0;
  let okStreak = 0;
  const t0 = Date.now();

  const load = async (): Promise<Row[]> =>
    (await sqlc.query(`
      SELECT br.id, br.category, br.card_id, br.attempts, br.orig_url,
             COALESCE(a.name, p.name) AS name,
             COALESCE(a.slug, p.slug) AS slug,
             COALESCE(a.rarity, p.rarity) AS rarity,
             a.description,
             COALESCE(a.image_url, p.image_url) AS image_url,
             (CASE WHEN br.category='animal' THEN br.card_id IN (SELECT animal_id FROM user_cards)
                   ELSE br.card_id IN (SELECT pokemon_id FROM user_pokemon_cards) END) AS owned
      FROM base_regen br
      LEFT JOIN animals a ON br.category='animal' AND a.id = br.card_id
      LEFT JOIN pokemon p ON br.category='pokemon' AND p.id = br.card_id
      WHERE br.status IN ('pending','retry')
      ORDER BY owned DESC,
               CASE COALESCE(a.rarity, p.rarity)
                 WHEN 'mythic' THEN 0 WHEN 'legendary' THEN 1 WHEN 'epic' THEN 2
                 WHEN 'rare' THEN 3 WHEN 'uncommon' THEN 4 ELSE 5 END,
               br.id
      LIMIT ${limit}
    `)) as unknown as Row[];

  let queue: Row[] = await load();
  console.log(`usine bases: ${queue.length} cartes en file (concurrence ${concurrency})`);

  const work = async (): Promise<void> => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      const attempt = row.attempts;
      try {
        // 1. Archive de l'originale (une seule fois) — elle sert aussi de référence.
        const refPath = `${CACHE}/${row.category}-${row.slug}.png`;
        if (!row.orig_url) {
          const res = await fetch(row.image_url);
          if (!res.ok) throw new Error(`fetch original HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          writeFileSync(refPath, buf);
          const arch = await put(`cards/originals/${row.category}/${row.slug}.png`, buf, {
            access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true,
          });
          await sqlc`UPDATE base_regen SET orig_url = ${arch.url} WHERE id = ${row.id}`;
          row.orig_url = arch.url;
        } else if (!existsSync(refPath)) {
          const res = await fetch(row.orig_url);
          if (!res.ok) throw new Error(`fetch archive HTTP ${res.status}`);
          writeFileSync(refPath, Buffer.from(await res.arrayBuffer()));
        }
        // 2. Génération.
        const { subject, fidelity } = subjectFor(row, attempt);
        const prompt = `${subject} ${DA} This is its BASE CARD: the character alone ${PEDESTALS[row.rarity] ?? PEDESTALS.common}. ${FIN}`;
        const out = `${OUTDIR}/${row.category}-${row.slug}.png`;
        await genOnce(prompt, out, refPath, fidelity);
        // 3. Écrasement en place — même chemin ; l'URL en base gagne un
        // ?v=timestamp pour percer les caches navigateur/CDN (30 jours).
        const pathname = new URL(row.image_url).pathname.slice(1);
        const blob = await put(pathname, readFileSync(out), {
          access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true,
        });
        const versioned = `${blob.url}?v=${Date.now()}`;
        if (row.category === "animal") {
          await sqlc`UPDATE animals SET image_url = ${versioned} WHERE id = ${row.card_id}`;
        } else {
          await sqlc`UPDATE pokemon SET image_url = ${versioned} WHERE id = ${row.card_id}`;
        }
        await sqlc`UPDATE base_regen SET status = 'done', attempts = ${attempt + 1}, updated_at = NOW() WHERE id = ${row.id}`;
        done++; okStreak++; consecFails = 0;
        if (okStreak >= 10 && concurrency < maxC) {
          concurrency++; okStreak = 0;
          console.log(`⇧ concurrence → ${concurrency}`);
        }
        const rate = done / ((Date.now() - t0) / 60000);
        console.log(`done ${row.category}/${row.slug} [${row.rarity}] (${done} ok, ${rate.toFixed(1)}/min)`);
        if (done % 25 === 0) console.log(`JALON: ${done} bases régénérées, ${queue.length} restantes`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Un bloc de modération est un problème d'image, pas de capacité :
        // il ne doit pas déclencher le disjoncteur de saturation.
        const isModeration = /moderation/i.test(msg);
        // Un 429 de quota n'est pas un essai : l'image n'a jamais été générée.
        const isRateLimit = /pricing tier|rate limit|429/i.test(msg);
        if (!isModeration) consecFails++;
        okStreak = 0;
        const next = isRateLimit ? attempt : attempt + 1;
        if (next >= MAX_ATTEMPTS && !isRateLimit) {
          await sqlc`UPDATE base_regen SET status = 'blocked', attempts = ${next}, updated_at = NOW() WHERE id = ${row.id}`;
          blocked++;
          console.log(`BLOQUÉ ${row.category}/${row.slug} après ${next} essais — ${msg.slice(0, 90)}`);
        } else {
          await sqlc`UPDATE base_regen SET status = 'retry', attempts = ${next}, updated_at = NOW() WHERE id = ${row.id}`;
          queue.push({ ...row, attempts: next });
          console.log(`retry ${row.category}/${row.slug} (essai ${next}) — ${msg.slice(0, 90)}`);
        }
        if (consecFails >= 3) {
          concurrency = 1;
          console.log(`⇩ saturation — concurrence → 1, pause 90s`);
          await new Promise((r) => setTimeout(r, 90000));
          consecFails = 0;
        } else {
          await new Promise((r) => setTimeout(r, 15000));
        }
      }
      await new Promise((r) => setTimeout(r, 3000));
      if (workerCount > concurrency) { workerCount--; return; }
    }
  };

  let workerCount = 0;
  let runners: Promise<void>[] = [];
  const spawn = () => { workerCount++; runners.push(work()); };

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    if (queue.length === 0) queue = await load();
    if (queue.length === 0) {
      const [b] = (await sqlc.query(`SELECT COUNT(*)::int n FROM base_regen WHERE status='blocked'`)) as unknown as { n: number }[];
      if (b.n === 0) break;
      console.log(`CYCLE ${cycle}: requeue de ${b.n} bloquées après pause 20 min`);
      await new Promise((r) => setTimeout(r, 1200000));
      await sqlc.query(`UPDATE base_regen SET status='retry', attempts=0 WHERE status='blocked'`);
      blocked = 0;
      queue = await load();
    }
    runners = [];
    workerCount = 0;
    const n = Math.min(concurrency, queue.length);
    for (let i = 0; i < n; i++) { spawn(); await new Promise((r) => setTimeout(r, 5000)); }
    const supervisor = setInterval(() => {
      if (queue.length > 0 && workerCount < concurrency) spawn();
    }, 5000);
    await Promise.all(runners);
    clearInterval(supervisor);
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`TERMINÉ: ${done} régénérées, ${blocked} bloquées, en ${mins} min`);
}
main();

export {};
