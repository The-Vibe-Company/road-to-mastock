// Le jeton de rappel côté client — le filet des web-apps épinglées iOS,
// où le cookie httpOnly ne survit pas toujours au kill de l'appli alors
// que localStorage, lui, tient. Toujours en try/catch : le stockage peut
// être indisponible (navigation privée, iframe...).

const KEY = "rtm-remember";

export function readRememberToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeRememberToken(token: string | null | undefined) {
  if (!token) return;
  try {
    localStorage.setItem(KEY, token);
  } catch {}
}

export function clearRememberToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
