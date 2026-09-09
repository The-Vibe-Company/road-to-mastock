// L'usine à skins v2 — mode ÉDITION avec la NOUVELLE carte de base en
// référence (déjà dans la DA unifiée) : même personnage que la base, tenue
// par défaut retirée, socle remplacé par la scène, expression imposée par
// le concept, richesse croissante n1→n5. Un skin n'est généré que quand la
// base de sa carte est refaite (base_regen.status = 'done').
//
//   npx tsx scripts/generate-skins-v2.ts [--wave owned|all] [--limit N] [--concurrency 4]
//
// Reprise sur relance (pending/retry seuls), cycles longs pour les bloqués.
import { config } from "dotenv";
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
config({ path: ".env.local" });

const DA_SKIN =
  "Same vibrant stylized 3D cartoon VIDEO-GAME art style as the reference (Clash Royale × Zelda): chunky appealing proportions, big expressive glossy eyes, smooth hand-painted textures, bold saturated colors, punchy lighting — NOT photorealistic. The ENTIRE scene — background, props, foliage, sky, water — must be painted in that same chunky stylized hand-painted game-art style: simplified shapes, saturated colors, painterly lighting. NO photorealistic background, NO photographic depth-of-field, NO realistic nature photography. KEEP the character recognizable: same species, same face, same colors and markings — but DO NOT copy the reference's default expression, use the EXPRESSION written in the scene. REMOVE its default gear — this skin has a new outfit. REPLACE the reference's pedestal and studio background entirely with the scene below.";
const FIN = "Full character visible, centered, square composition. No text, no borders, no card frame.";
const DENSITY: Record<number, string> = {
  1: "Skin tier 1 of 5 — a simple, calm, minimal scene with very few elements.",
  2: "Skin tier 2 of 5 — a modest scene with a handful of charming details.",
  3: "Skin tier 3 of 5 — a well-crafted scene with rich props and lighting.",
  4: "Skin tier 4 of 5 — an elaborate spectacular scene, dense details, dramatic light.",
  5: "Skin tier 5 of 5 — a maximalist masterpiece scene, extremely rich, overflowing with detail and glow.",
};
const MAX_ATTEMPTS = 4;
const MAX_CYCLES = 10;
const CACHE = "/tmp/rtm-newbase-refs";
const OUTDIR = "/tmp/rtm-skin-out";

interface Row {
  id: number;
  category: "animal" | "pokemon";
  card_id: number;
  level: number;
  name: string;
  concept: string;
  attempts: number;
  slug: string;
  card_name: string;
  image_url: string;
  base_done_at: string;
}

function subjectFor(r: Row, attempt: number): { subject: string; fidelity: string } {
  if (r.category === "pokemon") {
    const proper = r.slug.charAt(0).toUpperCase() + r.slug.slice(1).replace(/-/g, " ");
    if (attempt === 0) return { subject: `${proper} the Pokémon character from the reference image`, fidelity: "low" };
    if (attempt === 1) return { subject: `the creature character from the reference image (keep its exact design)`, fidelity: "low" };
    if (attempt === 2) return { subject: `the creature character from the reference image (keep its exact design)`, fidelity: "high" };
    return { subject: `the creature character from the reference image, seen from a slightly different angle`, fidelity: "low" };
  }
  return { subject: `the creature "${r.card_name}" from the reference image`, fidelity: "low" };
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
  const wave = opt("wave", "all");
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

  const ownedFilter =
    wave === "owned"
      ? `AND ((cs.category='animal' AND cs.card_id IN (SELECT animal_id FROM user_cards))
          OR (cs.category='pokemon' AND cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards)))`
      : "";

  const load = async (): Promise<Row[]> =>
    (await sqlc.query(`
      SELECT cs.id, cs.category, cs.card_id, cs.level, cs.name, cs.concept, cs.attempts,
             COALESCE(a.slug, p.slug) AS slug,
             COALESCE(a.name, p.name) AS card_name,
             COALESCE(a.image_url, p.image_url) AS image_url,
             br.updated_at AS base_done_at,
             (CASE WHEN cs.category='animal' THEN cs.card_id IN (SELECT animal_id FROM user_cards)
                   ELSE cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards) END) AS owned
      FROM card_skins cs
      LEFT JOIN animals a ON cs.category='animal' AND a.id = cs.card_id
      LEFT JOIN pokemon p ON cs.category='pokemon' AND p.id = cs.card_id
      JOIN base_regen br ON br.category = cs.category AND br.card_id = cs.card_id AND br.status = 'done'
      WHERE cs.status IN ('pending','retry') ${ownedFilter}
      ORDER BY owned DESC, cs.level, cs.id
      LIMIT ${limit}
    `)) as unknown as Row[];

  let queue: Row[] = await load();
  console.log(`usine skins v2: ${queue.length} skins en file (vague ${wave}, concurrence ${concurrency})`);

  const work = async (): Promise<void> => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      const attempt = row.attempts;
      try {
        // Référence = la NOUVELLE base (même URL, contenu refait) ; le
        // cache-buster contourne le CDN pour être sûr d'avoir la version DA.
        const refPath = `${CACHE}/${row.category}-${row.slug}.png`;
        if (!existsSync(refPath)) {
          const buster = encodeURIComponent(row.base_done_at ?? Date.now());
          const sep = row.image_url.includes("?") ? "&" : "?";
          const res = await fetch(`${row.image_url}${sep}v=${buster}`);
          if (!res.ok) throw new Error(`fetch ref HTTP ${res.status}`);
          writeFileSync(refPath, Buffer.from(await res.arrayBuffer()));
        }
        const { subject, fidelity } = subjectFor(row, attempt);
        const prompt = `An ALTERNATE OUTFIT SKIN of ${subject}. ${DA_SKIN} Scene: ${row.concept} ${DENSITY[row.level] ?? ""} ${FIN}`;
        const out = `${OUTDIR}/${row.category}-${row.slug}-n${row.level}.png`;
        await genOnce(prompt, out, refPath, fidelity);
        const blob = await put(`cards/skins/${row.category}/${row.slug}-n${row.level}.png`, readFileSync(out), {
          access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true,
        });
        await sqlc`UPDATE card_skins SET status = 'done', image_url = ${blob.url}, attempts = ${attempt + 1}, updated_at = NOW() WHERE id = ${row.id}`;
        done++; okStreak++; consecFails = 0;
        if (okStreak >= 10 && concurrency < maxC) {
          concurrency++; okStreak = 0;
          console.log(`⇧ concurrence → ${concurrency}`);
        }
        const rate = done / ((Date.now() - t0) / 60000);
        console.log(`done ${row.category}/${row.slug} n${row.level} (${done} ok, ${rate.toFixed(1)}/min)`);
        if (done % 50 === 0) console.log(`JALON: ${done} skins générés, ${queue.length} restants`);
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
          await sqlc`UPDATE card_skins SET status = 'blocked', attempts = ${next}, updated_at = NOW() WHERE id = ${row.id}`;
          blocked++;
          console.log(`BLOQUÉ ${row.category}/${row.slug} n${row.level} après ${next} essais — ${msg.slice(0, 90)}`);
        } else {
          await sqlc`UPDATE card_skins SET status = 'retry', attempts = ${next}, updated_at = NOW() WHERE id = ${row.id}`;
          queue.push({ ...row, attempts: next });
          console.log(`retry ${row.category}/${row.slug} n${row.level} (essai ${next}) — ${msg.slice(0, 90)}`);
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
      // Des bases encore en fabrication ? On attend qu'elles débloquent de
      // nouveaux skins plutôt que de conclure — le cycle ne compte pas.
      const [bases] = (await sqlc.query(`SELECT COUNT(*)::int n FROM base_regen WHERE status IN ('pending','retry')`)) as unknown as { n: number }[];
      if (bases.n > 0) {
        console.log(`file vide mais ${bases.n} bases encore en fabrication — pause 5 min`);
        await new Promise((r) => setTimeout(r, 300000));
        cycle--;
        queue = await load();
        continue;
      }
      const [b] = (await sqlc.query(`SELECT COUNT(*)::int n FROM card_skins WHERE status='blocked'`)) as unknown as { n: number }[];
      if (b.n === 0) break;
      console.log(`CYCLE ${cycle}: requeue de ${b.n} bloqués après pause 20 min`);
      await new Promise((r) => setTimeout(r, 1200000));
      await sqlc.query(`UPDATE card_skins SET status='retry', attempts=0 WHERE status='blocked'`);
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
  console.log(`TERMINÉ: ${done} skins générés, ${blocked} bloqués, en ${mins} min`);
}
main();

export {};
