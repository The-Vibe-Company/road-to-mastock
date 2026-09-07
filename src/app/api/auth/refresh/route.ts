import { setAuthCookie, signRememberToken, verifyRememberToken } from "@/lib/auth";

// Le filet des web-apps épinglées iOS : quand le cookie de session a été
// perdu au kill de l'appli, le client échange son jeton de rappel
// (localStorage, longue durée) contre un cookie tout neuf — sans écran de
// connexion. Le jeton est renouvelé à chaque échange : qui ouvre l'appli
// au moins une fois tous les 180 jours ne se reconnecte jamais.
export async function POST(request: Request) {
  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    return Response.json({ error: "Jeton manquant" }, { status: 400 });
  }
  if (typeof token !== "string" || !token) {
    return Response.json({ error: "Jeton manquant" }, { status: 400 });
  }

  const payload = await verifyRememberToken(token);
  if (!payload) {
    return Response.json({ error: "Jeton invalide ou expiré" }, { status: 401 });
  }

  await setAuthCookie(payload.userId);
  return Response.json({
    ok: true,
    rememberToken: await signRememberToken(payload.userId),
  });
}
