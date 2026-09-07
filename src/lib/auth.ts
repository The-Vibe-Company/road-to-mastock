import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

const COOKIE_NAME = "rtm-token";
// La session cookie : 90 jours, re-signée en continu par le proxy.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;
// Le jeton de rappel (localStorage) : 180 jours, renouvelé à chaque usage.
const REMEMBER_MAX_AGE = "180d";

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as number };
  } catch {
    return null;
  }
}

// ── Le jeton de rappel ──────────────────────────────────────────────────────
// Les web-apps épinglées iOS perdent parfois le cookie httpOnly au kill de
// l'appli (bug WebKit du mode standalone). Le filet : un jeton longue durée
// gardé en localStorage — CE stockage-là survit — que /api/auth/refresh
// échange contre un cookie tout neuf, sans écran de connexion.

export async function signRememberToken(userId: number): Promise<string> {
  return new SignJWT({ userId, remember: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REMEMBER_MAX_AGE)
    .sign(secret);
}

export async function verifyRememberToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.remember !== true) return null;
    return { userId: payload.userId as number };
  } catch {
    return null;
  }
}

export async function setAuthCookie(userId: number) {
  const token = await signToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    // iOS Safari (notamment en mode PWA standalone) ignore parfois Max-Age
    // et ne respecte que Expires. On envoie les deux.
    expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    path: "/",
  });
}

export async function getAuthUser(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
