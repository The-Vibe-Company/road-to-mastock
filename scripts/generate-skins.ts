// L'usine à skins : génère les images du catalogue card_skins par vagues,
// avec concurrence adaptative (la ressource Azure throttle en déguisant en
// « safety »), retries + reformulation, upload Vercel Blob, reprise sur
// simple relance (seuls les pending/retry repartent).
//
//   npx tsx scripts/generate-skins.ts --wave owned --concurrency 3
//   npx tsx scripts/generate-skins.ts --wave all --limit 500
//
// Journal sur stdout, une ligne par événement — le monitoring s'y accroche.
import { config } from "dotenv";
config({ path: ".env.local" });

const AZURE_BASE =
  process.env.AZURE_OPENAI_IMAGE_ENDPOINT ??
  "https://quivr-sweden-central-resource.openai.azure.com/openai/v1";
const DEPLOYMENT = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT ?? "gpt-image-2-1";
const STYLE =
  "Premium fantasy TCG card illustration style, rich colors, dramatic lighting, high detail. Full character visible, centered, square composition. No text, no borders, no card frame.";
const MAX_ATTEMPTS = 4;

interface SkinRow {
  id: number;
  category: "animal" | "pokemon";
  level: number;
  name: string;
  concept: string;
  slug: string;
  cardName: string;
  description: string | null;
  attempts: number;
}

function subjectFor(row: SkinRow, attempt: number): string {
  if (row.category === "pokemon") {
    // Le modèle connaît chaque pokémon ; en cas de blocage « output », la
    // variante 2 décrit sans insister sur la marque.
    const proper = row.slug.charAt(0).toUpperCase() + row.slug.slice(1).replace(/-/g, " ");
    return attempt < 2
      ? `${proper} the Pokémon, accurate official design.`
      : `The creature ${proper} (accurate well-known design).`;
  }
  const desc = (row.description ?? "").split(/[.!]/)[0]?.trim();
  return `A fantasy creature: ${row.cardName}${desc ? ` — ${desc}` : ""}.`;
}

async function generateOnce(prompt: string, apiKey: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);
  try {
    const res = await fetch(`${AZURE_BASE}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEPLOYMENT, prompt, size: "1024x1024", n: 1 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("réponse sans image");
    return Buffer.from(b64, "base64");
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string, dflt: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const wave = opt("wave", "owned");
  const limit = Number(opt("limit", "100000"));
  let concurrency = Number(opt("concurrency", "3"));
  const minC = 1;
  const maxC = Number(opt("max-concurrency", "4"));

  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY manquant dans l'environnement");
  const { neon } = await import("@neondatabase/serverless");
  const sqlc = neon(process.env.DATABASE_URL!);
  const { put } = await import("@vercel/blob");

  const ownedFilter =
    wave === "owned"
      ? `AND (
          (cs.category = 'animal' AND cs.card_id IN (SELECT animal_id FROM user_cards))
          OR (cs.category = 'pokemon' AND cs.card_id IN (SELECT pokemon_id FROM user_pokemon_cards))
        )`
      : "";
  const rows = (await sqlc.query(`
    SELECT cs.id, cs.category, cs.level, cs.name, cs.concept, cs.attempts,
           COALESCE(a.slug, p.slug) AS slug,
           COALESCE(a.name, p.name) AS card_name,
           a.description
    FROM card_skins cs
    LEFT JOIN animals a ON cs.category = 'animal' AND a.id = cs.card_id
    LEFT JOIN pokemon p ON cs.category = 'pokemon' AND p.id = cs.card_id
    WHERE cs.status IN ('pending', 'retry') ${ownedFilter}
    ORDER BY cs.level, cs.id
    LIMIT ${limit}
  `)) as unknown as (Omit<SkinRow, "cardName"> & { card_name: string })[];

  const queue: SkinRow[] = rows.map((r) => ({ ...r, cardName: r.card_name }));
  console.log(`file: ${queue.length} skins (vague ${wave}, concurrence ${concurrency})`);
  if (queue.length === 0) return;

  let done = 0;
  let blocked = 0;
  let consecFails = 0;
  let okStreak = 0;
  const t0 = Date.now();

  const work = async (): Promise<void> => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      const attempt = row.attempts;
      const prompt = `${subjectFor(row, attempt)} Scene: ${row.concept}. Skin tier ${row.level} of 5 — the higher the tier, the more spectacular. ${STYLE}`;
      try {
        const img = await generateOnce(prompt, apiKey);
        const path = `cards/skins/${row.category}/${row.slug}-n${row.level}.png`;
        const blob = await put(path, img, { access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true });
        await sqlc`UPDATE card_skins SET status = 'done', image_url = ${blob.url}, attempts = ${attempt + 1}, updated_at = NOW() WHERE id = ${row.id}`;
        done++;
        okStreak++;
        consecFails = 0;
        if (okStreak >= 10 && concurrency < maxC) {
          concurrency++;
          okStreak = 0;
          console.log(`⇧ concurrence → ${concurrency}`);
        }
        const rate = done / ((Date.now() - t0) / 60000);
        console.log(`done ${row.category}/${row.slug} n${row.level} (${done} ok, ${rate.toFixed(1)}/min)`);
        if (done % 25 === 0) console.log(`JALON: ${done} images générées, ${queue.length} restantes`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        consecFails++;
        okStreak = 0;
        const next = attempt + 1;
        if (next >= MAX_ATTEMPTS) {
          await sqlc`UPDATE card_skins SET status = 'blocked', attempts = ${next}, updated_at = NOW() WHERE id = ${row.id}`;
          blocked++;
          console.log(`BLOQUÉ ${row.category}/${row.slug} n${row.level} après ${next} essais — ${msg.slice(0, 100)}`);
        } else {
          await sqlc`UPDATE card_skins SET status = 'retry', attempts = ${next}, updated_at = NOW() WHERE id = ${row.id}`;
          queue.push({ ...row, attempts: next });
          console.log(`retry ${row.category}/${row.slug} n${row.level} (essai ${next}) — ${msg.slice(0, 100)}`);
        }
        if (consecFails >= 3) {
          concurrency = minC;
          console.log(`⇩ saturation détectée — concurrence → ${minC}, pause 90s`);
          await new Promise((r) => setTimeout(r, 90000));
          consecFails = 0;
        } else {
          await new Promise((r) => setTimeout(r, 15000));
        }
      }
      // Respiration entre requêtes d'un même worker.
      await new Promise((r) => setTimeout(r, 3000));
      // Ajustement dynamique du nombre de workers : les surnuméraires sortent.
      if (workerCount > concurrency) {
        workerCount--;
        return;
      }
    }
  };

  let workerCount = 0;
  const runners: Promise<void>[] = [];
  const spawn = () => {
    workerCount++;
    runners.push(work());
  };
  for (let i = 0; i < concurrency; i++) spawn();
  // Superviseur : fait naître des workers quand la concurrence remonte.
  const supervisor = setInterval(() => {
    if (queue.length > 0 && workerCount < concurrency) spawn();
  }, 5000);
  await Promise.all(runners);
  clearInterval(supervisor);

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`TERMINÉ: ${done} générées, ${blocked} bloquées, en ${mins} min`);
}
main();

export {};
