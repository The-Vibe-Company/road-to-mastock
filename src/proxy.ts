import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

const publicPaths = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/favicon.ico",
];

const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
// Re-issue the cookie early and often : sur iOS standalone, un cookie posé
// par une réponse fetch peut ne pas survivre au kill de l'appli — celui
// posé par une NAVIGATION est fiable. Chaque ouverture re-signe donc la
// session (au plus toutes les 10 minutes, pour ne pas réécrire Set-Cookie
// sur chaque requête).
const REFRESH_AFTER = 60 * 10; // 10 minutes

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("rtm-token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const response = NextResponse.next();
    response.headers.set("x-user-id", String(payload.userId));

    // Les documents HTML ne doivent jamais être resservis depuis le cache
    // disque lors d'un history load (Retour cross-document sur iOS) : un
    // HTML d'un ancien build pointe vers des chunks disparus → spinner
    // éternel. Les /api/* et assets statiques gardent leur cache normal.
    if (!pathname.startsWith("/api/")) {
      response.headers.set("Cache-Control", "no-store, must-revalidate");
    }

    // Sliding session: if the token was issued more than a day ago,
    // re-sign it and reset the cookie so the user stays logged in as long
    // as they use the app at least once every 30 days.
    const iat = typeof payload.iat === "number" ? payload.iat : 0;
    const now = Math.floor(Date.now() / 1000);
    if (now - iat > REFRESH_AFTER) {
      const fresh = await new SignJWT({ userId: payload.userId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("90d")
        .sign(secret);
      response.cookies.set("rtm-token", fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        // iOS Safari (PWA standalone) ignore parfois Max-Age — on double
        // avec Expires pour forcer la persistance 30 jours.
        expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
        path: "/",
      });
    }
    return response;
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
