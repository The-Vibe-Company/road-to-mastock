import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { setAuthCookie, signRememberToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json(
      { error: "Email et mot de passe requis" },
      { status: 400 }
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()));

  if (!user) {
    return Response.json(
      { error: "Email ou mot de passe incorrect" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return Response.json(
      { error: "Email ou mot de passe incorrect" },
      { status: 401 }
    );
  }

  await setAuthCookie(user.id);

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    // Le filet iOS : gardé en localStorage, échangé via /api/auth/refresh
    // quand le cookie de session n'a pas survécu au kill de l'appli.
    rememberToken: await signRememberToken(user.id),
  });
}
