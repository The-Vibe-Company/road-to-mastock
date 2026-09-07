import { db } from "@/lib/db";
import { exerciseCatalog, exercises, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { setAuthCookie, signRememberToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return Response.json(
      { error: "Email, mot de passe et nom requis" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { error: "Le mot de passe doit faire au moins 6 caractères" },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()));

  if (existing.length > 0) {
    return Response.json(
      { error: "Cet email est déjà utilisé" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
    })
    .returning({ id: users.id, email: users.email, name: users.name });

  // Les exercices appartiennent a leur proprietaire : on part d'une copie du
  // catalogue de reference, que le nouvel inscrit peut renommer ou supprimer
  // sans impacter personne.
  const catalog = await db.select().from(exerciseCatalog);
  if (catalog.length > 0) {
    await db.insert(exercises).values(
      catalog.map((c) => ({
        userId: user.id,
        name: c.name,
        kind: c.kind,
        isAssisted: c.isAssisted,
        muscleGroup: c.muscleGroup,
        muscleGroups: c.muscleGroups,
      })),
    );
  }

  await setAuthCookie(user.id);

  return Response.json(
    { ...user, rememberToken: await signRememberToken(user.id) },
    { status: 201 },
  );
}
