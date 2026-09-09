// Rapport d'avancement des usines (bases + skins) : tableau markdown prêt à
// envoyer, avec delta et rythme calculés depuis le point précédent
// (état mémorisé dans /tmp/rtm-progress-last.json).
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
config({ path: ".env.local" });

const STATE = "/tmp/rtm-progress-last.json";

interface Snap {
  at: number;
  basesDone: number;
  skinsDone: number;
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const b = (await sql.query(
    `SELECT COUNT(*) FILTER (WHERE status='done')::int done,
            COUNT(*) FILTER (WHERE status='blocked')::int blocked,
            COUNT(*) FILTER (WHERE status IN ('pending','retry'))::int rest,
            COUNT(*)::int total
     FROM base_regen`,
  )) as unknown as { done: number; blocked: number; rest: number; total: number }[];
  const s = (await sql.query(
    `SELECT COUNT(*) FILTER (WHERE status='done')::int done,
            COUNT(*) FILTER (WHERE status='blocked')::int blocked,
            COUNT(*) FILTER (WHERE status IN ('pending','retry'))::int rest,
            COUNT(*)::int total
     FROM card_skins`,
  )) as unknown as { done: number; blocked: number; rest: number; total: number }[];
  const bases = b[0];
  const skins = s[0];

  const now = Date.now();
  let prev: Snap | null = null;
  if (existsSync(STATE)) {
    try { prev = JSON.parse(readFileSync(STATE, "utf8")) as Snap; } catch { prev = null; }
  }
  const mins = prev ? (now - prev.at) / 60000 : 0;
  const dB = prev ? bases.done - prev.basesDone : 0;
  const dS = prev ? skins.done - prev.skinsDone : 0;
  const rB = prev && mins > 0.5 ? dB / mins : 0;
  const rS = prev && mins > 0.5 ? dS / mins : 0;
  const eta = (rest: number, rate: number) => {
    if (rate <= 0) return "—";
    const h = rest / rate / 60;
    return h >= 1.5 ? `~${h.toFixed(0)}h` : `~${Math.ceil(rest / rate)}min`;
  };
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const now2 = new Date();
  const hh = String(now2.getHours()).padStart(2, "0");
  const mm = String(now2.getMinutes()).padStart(2, "0");
  const boost = new Date(now2); boost.setHours(21, 37, 0, 0);
  const toBoost = Math.round((boost.getTime() - now2.getTime()) / 60000);
  const boostInfo = toBoost > 0 ? ` · boost nuit dans ${Math.floor(toBoost / 60)}h${String(toBoost % 60).padStart(2, "0")}` : " · régime nuit actif";
  console.log(`Il est ${hh}:${mm}${boostInfo} — depuis le dernier point (${prev ? `${mins.toFixed(0)} min` : "premier point"}) :`);
  console.log("");
  console.log("| Usine | Fait | Δ | Restant | Bloquées | Rythme | ETA |");
  console.log("|---|---|---|---|---|---|---|");
  console.log(
    `| Bases | **${bases.done}/${bases.total}** | ${fmt(dB)} | ${bases.rest} | ${bases.blocked} | ${rB > 0 ? rB.toFixed(1) + "/min" : "—"} | ${eta(bases.rest, rB)} |`,
  );
  console.log(
    `| Skins | **${skins.done}/${skins.total}** | ${fmt(dS)} | ${skins.rest} | ${skins.blocked} | ${rS > 0 ? rS.toFixed(1) + "/min" : "—"} | ${eta(skins.rest, rS)} |`,
  );
  writeFileSync(STATE, JSON.stringify({ at: now, basesDone: bases.done, skinsDone: skins.done }));
}
main();

export {};
