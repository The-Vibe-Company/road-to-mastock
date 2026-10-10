// Remet le compte de test AEOM à zéro avant chaque parcours : supprime toutes
// ses séances (séries et exercices de séance suivent en cascade), via l'API de
// l'app, qui ne touche qu'aux séances du compte connecté. N'affiche aucune
// valeur du compte.
import { readFileSync } from "node:fs";

const APP = `http://127.0.0.1:${process.env.APP_PORT ?? 4318}`;
const account = JSON.parse(readFileSync(process.env.AEOM_ACCOUNT ?? ".aeom/account.json", "utf8"));

const login = await fetch(`${APP}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: account["Email"], password: account["Mot de passe"] }),
});
if (!login.ok) {
  console.error(`reset : connexion refusée (${login.status})`);
  process.exit(1);
}
const cookie = login.headers.getSetCookie().find((c) => c.startsWith("rtm-token="))?.split(";")[0];
const headers = { cookie };

const list = await fetch(`${APP}/api/sessions`, { headers });
if (!list.ok) {
  console.error(`reset : liste des séances refusée (${list.status})`);
  process.exit(1);
}
const sessions = await list.json();
for (const s of sessions) {
  const res = await fetch(`${APP}/api/sessions/${s.id}`, { method: "DELETE", headers });
  if (!res.ok) {
    console.error(`reset : suppression refusée (${res.status})`);
    process.exit(1);
  }
}

// Un peu d'historique, pour que les écrans montrent un pratiquant et pas
// seulement des états vides : une séance il y a trois jours, deux machines.
async function post(path, body) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`reset : ${path} refusé (${res.status})`);
    process.exit(1);
  }
  return res.json();
}
const catalog = await (await fetch(`${APP}/api/exercises`, { headers })).json();
const date = new Date(Date.now() - 3 * 86400_000).toISOString().split("T")[0];
const session = await post("/api/sessions", { date });
const history = [
  ["Chest Press", [[60, 10], [65, 8]]],
  ["Presse Cuisse", [[120, 12], [140, 10]]],
];
for (const [name, rows] of history) {
  const exercise = catalog.find((e) => e.name === name);
  if (!exercise) {
    console.error(`reset : exercice « ${name} » introuvable`);
    process.exit(1);
  }
  const se = await post("/api/session-exercises", { sessionId: session.id, exerciseId: exercise.id });
  for (const [weightKg, reps] of rows) await post("/api/sets", { sessionExerciseId: se.id, weightKg, reps });
}
console.log(`reset : ${sessions.length} séance(s) supprimée(s), une séance d'historique recréée`);
