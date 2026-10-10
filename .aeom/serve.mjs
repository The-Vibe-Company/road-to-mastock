// Sert l'app pour AEOM, déjà connectée avec le compte de test.
//
// Les champs de /login ont un <label> qui n'est pas relié à leur <input>
// (pas de htmlFor), donc la connexion d'AEOM, qui remplit chaque champ par
// son libellé, ne peut pas les trouver. Plutôt que de toucher à l'app, ce
// script lance `next start` sur APP_PORT, se connecte une fois par l'API
// avec le compte de .aeom/account.json, et sert l'app sur PROXY_PORT en
// posant le cookie de session sur chaque requête.
//
// Prérequis : `next build` déjà fait. Aucune valeur du compte n'est affichée.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

const PROXY_PORT = Number(process.env.PORT ?? 4317);
const APP_PORT = Number(process.env.APP_PORT ?? PROXY_PORT + 1);
const ACCOUNT = process.env.AEOM_ACCOUNT ?? ".aeom/account.json";
const COOKIE = "rtm-token";

const account = JSON.parse(readFileSync(ACCOUNT, "utf8"));
const app = spawn("./node_modules/.bin/next", ["start", "-p", String(APP_PORT)], { stdio: "inherit" });
const stop = () => {
  app.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
app.on("exit", (code) => process.exit(code ?? 1));

async function waitForApp() {
  for (let i = 0; i < 240; i++) {
    try {
      await fetch(`http://127.0.0.1:${APP_PORT}/login`);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`next start ne répond pas sur ${APP_PORT}`);
}

async function signIn() {
  const res = await fetch(`http://127.0.0.1:${APP_PORT}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account["Email"], password: account["Mot de passe"] }),
  });
  if (!res.ok) throw new Error(`connexion refusée (${res.status}) : vérifier ${ACCOUNT}`);
  const set = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE}=`));
  if (!set) throw new Error("la connexion n'a pas posé de cookie de session");
  return set.split(";")[0].slice(COOKIE.length + 1);
}

await waitForApp();
const token = await signIn();

// Le cookie de session du compte de test remplace celui que le navigateur
// envoie : une déconnexion ou un cookie re-signé n'y change rien.
function withSession(cookieHeader) {
  const others = (cookieHeader ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith(`${COOKIE}=`));
  return [...others, `${COOKIE}=${token}`].join("; ");
}

http
  .createServer((req, res) => {
    // L'hôte d'origine est gardé : les redirections de l'app restent sur le proxy.
    const headers = { ...req.headers, cookie: withSession(req.headers.cookie) };
    const upstream = http.request(
      { host: "127.0.0.1", port: APP_PORT, method: req.method, path: req.url, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  })
  .listen(PROXY_PORT, "127.0.0.1", () => console.log(`AEOM : app connectée sur http://localhost:${PROXY_PORT}`));
