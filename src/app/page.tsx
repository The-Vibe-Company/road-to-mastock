import Link from "next/link";
import { db } from "@/lib/db";
import { animals, pokemon, userCards, userCharges, userPokemonCards, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { earnedTrophies } from "@/lib/trophies-server";
import { hasTrophyFeature } from "@/lib/trophies";
import { Users, Settings, Cards, Trophy, Sparkles, Flame } from "@/components/icons";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HomeTabs } from "@/components/home-tabs";
import { NewSessionButton } from "@/components/new-session-button";
import { RefreshOnReturn } from "@/components/refresh-on-return";
import { HomeExtras, HomeTrinkets } from "@/components/home-extras";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const [user] = await db
    .select({
      name: users.name,
      title: users.title,
      magnesie: users.magnesie,
      bannerCategory: users.bannerCategory,
      bannerCardId: users.bannerCardId,
    })
    .from(users)
    .where(eq(users.id, auth.userId));

  // L'identité du header : magnésie, cartes en tout, jauge de Forge.
  const [[forgeRow], [ac], [pc]] = await Promise.all([
    db
      .select({ points: userCharges.points })
      .from(userCharges)
      .where(and(eq(userCharges.userId, auth.userId), eq(userCharges.direction, "forge"))),
    db.select({ n: sql<number>`COUNT(*)::int` }).from(userCards).where(eq(userCards.userId, auth.userId)),
    db.select({ n: sql<number>`COUNT(*)::int` }).from(userPokemonCards).where(eq(userPokemonCards.userId, auth.userId)),
  ]);
  const wallet = {
    magnesie: user?.magnesie ?? 0,
    cards: (ac?.n ?? 0) + (pc?.n ?? 0),
    forge: forgeRow?.points ?? 0,
  };

  // L'Étendard : la carte en bannière derrière le titre.
  let bannerUrl: string | null = null;
  if (user?.bannerCategory && user.bannerCardId) {
    const table = user.bannerCategory === "animal" ? animals : pokemon;
    const [card] = await db
      .select({ imageUrl: table.imageUrl })
      .from(table)
      .where(eq(table.id, user.bannerCardId));
    bannerUrl = card?.imageUrl ?? null;
  }

  // Le bilan hebdo (trophée Le Mois Parfait) : cette semaine vs la dernière.
  const trophies = await earnedTrophies(auth.userId);
  let weekly: { sessions: number; volume: number; prevSessions: number; prevVolume: number } | null = null;
  if (hasTrophyFeature(trophies, "weekly")) {
    const res = (await db.execute(sql`
      SELECT
        COUNT(DISTINCT s.id) FILTER (WHERE DATE_TRUNC('week', s.date::timestamp) = DATE_TRUNC('week', NOW()))::int AS sessions,
        COALESCE(SUM(st.weight_kg * st.reps) FILTER (WHERE DATE_TRUNC('week', s.date::timestamp) = DATE_TRUNC('week', NOW())), 0)::float AS volume,
        COUNT(DISTINCT s.id) FILTER (WHERE DATE_TRUNC('week', s.date::timestamp) = DATE_TRUNC('week', NOW() - INTERVAL '7 days'))::int AS prev_sessions,
        COALESCE(SUM(st.weight_kg * st.reps) FILTER (WHERE DATE_TRUNC('week', s.date::timestamp) = DATE_TRUNC('week', NOW() - INTERVAL '7 days')), 0)::float AS prev_volume
      FROM sessions s
      LEFT JOIN session_exercises se ON se.session_id = s.id
      LEFT JOIN sets st ON st.session_exercise_id = se.id
      WHERE s.user_id = ${auth.userId}
    `)) as unknown as { rows?: Record<string, unknown>[] };
    const w = ((res.rows ?? res) as unknown as { sessions: number; volume: number; prev_sessions: number; prev_volume: number }[])[0];
    weekly = {
      sessions: Number(w?.sessions ?? 0),
      volume: Math.round(Number(w?.volume ?? 0)),
      prevSessions: Number(w?.prev_sessions ?? 0),
      prevVolume: Math.round(Number(w?.prev_volume ?? 0)),
    };
  }

  const result = await db.execute(sql`
    WITH exercise_rankings AS (
      SELECT
        se.id AS se_id,
        se.session_id,
        se.exercise_id,
        COALESCE(MAX(st.weight_kg), 0) AS max_weight,
        COALESCE(SUM(st.weight_kg * st.reps), 0) AS total_volume
      FROM session_exercises se
      JOIN sessions s ON s.id = se.session_id
      LEFT JOIN sets st ON st.session_exercise_id = se.id
      WHERE s.user_id = ${auth.userId}
      GROUP BY se.id, se.session_id, se.exercise_id
    ),
    ranked AS (
      SELECT
        se_id,
        session_id,
        LEAST(
          RANK() OVER (PARTITION BY exercise_id ORDER BY max_weight DESC),
          RANK() OVER (PARTITION BY exercise_id ORDER BY total_volume DESC)
        ) AS best_rank
      FROM exercise_rankings
      WHERE max_weight > 0
    )
    SELECT
      s.id,
      s.date,
      (SELECT COUNT(*) FROM session_exercises se WHERE se.session_id = s.id) AS exercise_count,
      COALESCE((
        SELECT SUM(st.weight_kg * st.reps)
        FROM sets st
        JOIN session_exercises se ON se.id = st.session_exercise_id
        WHERE se.session_id = s.id
      ), 0) AS total_volume,
      COALESCE((SELECT COUNT(*) FROM ranked r WHERE r.session_id = s.id AND r.best_rank = 1), 0) AS gold,
      COALESCE((SELECT COUNT(*) FROM ranked r WHERE r.session_id = s.id AND r.best_rank = 2), 0) AS silver,
      COALESCE((SELECT COUNT(*) FROM ranked r WHERE r.session_id = s.id AND r.best_rank = 3), 0) AS bronze
    FROM sessions s
    WHERE s.user_id = ${auth.userId}
    ORDER BY s.date DESC, s.created_at DESC
  `);
  const allSessions = (result.rows ?? result) as unknown as { id: number; date: string; exercise_count: number; total_volume: number; gold: number; silver: number; bronze: number }[];

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-28 pt-10">
      <RefreshOnReturn />
      {/* Hero — l'affiche : le titre tout en haut, l'identité à sa droite,
          puis la rangée d'outils pleine largeur */}
      <div className="hero-gradient relative -mx-4 -mt-10 mb-8 overflow-hidden px-4 pb-6 pt-4">
        {/* L'Étendard : la carte flotte derrière le titre */}
        {/* L'Étendard : une couronne sur le HAUT de la home — l'image
            règne sur le premier écran puis s'efface avant les listes.
            Confinée à la colonne (max-w-lg), jamais pleine page desktop. */}
        {bannerUrl && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 -z-10 mx-auto h-[46dvh] max-w-lg select-none"
            style={{
              maskImage:
                "linear-gradient(to bottom, black 35%, rgba(0,0,0,0.5) 70%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 35%, rgba(0,0,0,0.5) 70%, transparent)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerUrl} alt="" className="size-full object-cover object-top opacity-25" />
          </div>
        )}
        <h1 className="text-4xl leading-[0.95] tracking-tight">
          ROAD TO <span className="text-gradient-orange">MASTOCK</span>
        </h1>

        {/* L'identité : le nom aligné sur le haut du titre, et dessous les
            trois compteurs — magnésie, cartes en tout, Forge. Le compte de
            séances vit déjà dans le Dashboard, pas besoin de le répéter. */}
        <div className="absolute right-4 top-4 z-10 text-right">
          <p className="text-[13px] font-black uppercase leading-none tracking-[0.08em]">
            {user?.name ?? "Toi"}
          </p>
          <div className="mt-1.5 flex items-center justify-end gap-2.5 font-mono text-[10.5px] font-bold tabular-nums">
            <span className="flex items-center gap-1 text-sky-300">
              <Sparkles className="size-3" />
              {wallet.magnesie}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Cards className="size-3" />
              {wallet.cards}
            </span>
            <span className="flex items-center gap-1 text-primary">
              <Flame className="size-3" />
              {wallet.forge}
            </span>
          </div>
        </div>

        {user?.title && (
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
            {user.title}
          </p>
        )}

        {/* La rangée d'outils : quatre portes nommées, pleine largeur. Le
            catalogue vit dans l'onglet Exercices, la déconnexion dans les
            Réglages. */}
        <nav className="mt-4 grid grid-cols-4 gap-1.5">
          {[
            { href: "/friends", Icon: Users, label: "Amis" },
            { href: "/trophees", Icon: Trophy, label: "Trophées" },
            { href: "/collection", Icon: Cards, label: "Cartes" },
            { href: "/settings", Icon: Settings, label: "Réglages" },
          ].map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 rounded-[3px] bg-secondary/30 py-2 text-muted-foreground ring-1 ring-border transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
            >
              <Icon className="size-5" />
              <span className="text-[8px] font-black uppercase tracking-[0.18em]">{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <HomeExtras />

      {/* Le bilan hebdo — gagné avec « Le Mois Parfait » */}
      {weekly && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-secondary/30 px-4 py-3 ring-1 ring-border">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Cette semaine
            </p>
            <p className="text-lg font-black leading-tight text-primary">
              {weekly.sessions} séance{weekly.sessions > 1 ? "s" : ""}
              <span className="text-muted-foreground"> · </span>
              {weekly.volume >= 1000 ? `${(weekly.volume / 1000).toFixed(1)}t` : `${weekly.volume}kg`}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Sem. dernière
            </p>
            <p className="text-sm font-bold leading-tight text-muted-foreground">
              {weekly.prevSessions} · {weekly.prevVolume >= 1000 ? `${(weekly.prevVolume / 1000).toFixed(1)}t` : `${weekly.prevVolume}kg`}
            </p>
          </div>
        </div>
      )}

      <HomeTabs
        sessions={allSessions.map((s) => ({
          id: Number(s.id),
          date: s.date,
          exerciseCount: Number(s.exercise_count),
          totalVolume: Math.round(Number(s.total_volume)),
          gold: Number(s.gold),
          silver: Number(s.silver),
          bronze: Number(s.bronze),
        }))}
      />

      <HomeTrinkets />

      {/* FAB */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <NewSessionButton />
      </div>
    </div>
  );
}
