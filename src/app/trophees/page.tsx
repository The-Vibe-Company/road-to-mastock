"use client";

import { BackButton } from "@/components/back-button";
import { Spinner } from "@/components/spinner";
import { useTrophies, type TrophyEntry } from "@/components/trophies-provider";
import {
  METAL_NAMES,
  Medallion,
  TROPHY_FAMILIES,
  gradeOf,
  trophyStatOf,
} from "@/components/trophy-medallion";
import { Check, ChevronDown, Gift, Lock, Trophy } from "@/components/icons";

// ── Le Cabinet des Trophées ─────────────────────────────────────────────────
// Tout est public — la cible, la progression, la récompense : on sait
// toujours pourquoi on pousse. La page se lit comme la pile d'une machine :
// d'abord ce qui est déjà soulevé (le cabinet), puis, famille par famille,
// la plaque où la goupille est plantée — le prochain palier — et, repliées
// dessous, les plaques qui restent à monter.

// L'ordre des familles de la Salle.
const FAMILIES: { stat: string; label: string }[] = [
  "sessions", "records", "maxWeight", "tonnage", "sets", "exercises",
  "streakWeeks", "bestWeek", "cardioMinutes", "cardsOwned",
].map((stat) => ({ stat, label: TROPHY_FAMILIES[stat].label }));

// Un chiffre frappé tient sur une étiquette : en dessous de 10 000 on l'écrit
// en entier (« 1 250 »), au-delà on l'abrège (« 12,5k », « 1,25M »). Arrondi
// par défaut, pour qu'une progression n'affiche jamais la cible atteinte
// avant de l'avoir vraiment atteinte.
function fmt(n: number): string {
  if (n < 10_000) return n.toLocaleString("fr-FR");
  const [div, unit] = n < 1_000_000 ? [1_000, "k"] : [1_000_000, "M"];
  const v = n / div;
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  const f = 10 ** digits;
  return `${(Math.floor(v * f) / f).toLocaleString("fr-FR")}${unit}`;
}

// Le titre d'une récompense reste secret jusqu'à la victoire : le serveur
// envoie alors une phrase d'attente plutôt que le titre.
const isSecretTitle = (t: TrophyEntry) => t.rewardType === "title" && !t.earned;

// Un titre de bloc : gravé, en capitales étroites (comme sur la home).
const BLOCK_TITLE =
  "font-heading text-[14px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

export default function TrophiesPage() {
  const { loaded, trophies } = useTrophies();

  const header = (
    <>
      <BackButton fallback="/" />
      <header className="mb-6 mt-3">
        <p className="etched">Le mérite</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">Trophées</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gagnés à la sueur, jamais au tirage. Les plus grands déverrouillent
          des morceaux de l&apos;appli.
        </p>
      </header>
    </>
  );

  if (!loaded) {
    return (
      <div className="min-h-dvh px-4 pb-12 pt-6">
        {header}
        <div className="flex justify-center py-16">
          <Spinner label="Chargement..." />
        </div>
      </div>
    );
  }

  if (trophies.length === 0) {
    return (
      <div className="min-h-dvh px-4 pb-12 pt-6">
        {header}
        <div className="plate px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Le cabinet n&apos;a pas pu se charger. Recharge la page pour réessayer.
          </p>
        </div>
      </div>
    );
  }

  // Chaque famille, son échelle triée du plus petit palier au plus grand.
  const ladders = FAMILIES.map(({ stat, label }) => {
    const group = trophies
      .filter((t) => trophyStatOf(t.id) === stat)
      .sort((a, b) => a.target - b.target);
    const locked = group.filter((t) => !t.earned);
    return {
      stat,
      label,
      group,
      earned: group.filter((t) => t.earned),
      next: locked[0] ?? null,
      rest: locked.slice(1),
    };
  }).filter((l) => l.group.length > 0);

  // Le cabinet : ce qui est gagné, famille par famille, en tête de page.
  const earned = ladders.flatMap((l) => l.earned.map((t) => ({ t, family: l.label })));
  const earnedCount = trophies.filter((t) => t.earned).length;
  const cabinetPct = Math.min(100, (earnedCount / trophies.length) * 100);

  return (
    <div className="min-h-dvh px-4 pb-12 pt-6">
      {header}

      {/* ── Au cabinet : les plaques déjà soulevées ─────────────────────── */}
      <section aria-labelledby="cabinet-title" className="mb-9">
        <div className="plate-stack">
          <div className="plate px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="stamp h-12 min-w-[4.5rem] px-2.5 text-[32px]">{earnedCount}</span>
              <div className="min-w-0 flex-1">
                <h2
                  id="cabinet-title"
                  className="text-[20px] uppercase leading-none tracking-[0.04em]"
                >
                  Au cabinet
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  sur {trophies.length} trophées
                </p>
              </div>
              <Trophy aria-hidden className="size-5 shrink-0 text-steel-dark" />
            </div>
            <div
              className="segments relative mt-3 h-2.5 bg-muted"
              role="img"
              aria-label={`${earnedCount} trophées gagnés sur ${trophies.length}`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary"
                style={{ width: `${cabinetPct}%` }}
              />
            </div>
          </div>

          {earned.length === 0 ? (
            <div className="plate px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Rien au cabinet pour l&apos;instant. Le premier palier de chaque
                échelle t&apos;attend juste en dessous.
              </p>
            </div>
          ) : (
            earned.map(({ t, family }) => (
              <article key={t.id} className="plate flex items-center gap-3 p-3">
                <Medallion entry={t} />
                <div className="min-w-0 flex-1">
                  <p className="etched">
                    {family} · {METAL_NAMES[gradeOf(t)]}
                  </p>
                  <h3 className="mt-0.5 text-[19px] uppercase leading-tight tracking-[0.03em]">
                    {t.name}
                  </h3>
                  <p className="text-xs leading-snug text-muted-foreground">{t.description}</p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold leading-snug">
                    <Check aria-hidden className="mt-px size-3.5 shrink-0 text-steel" />
                    {t.rewardLabel}
                  </p>
                </div>
                {/* Gagné : la progression a atteint la cible, seule la cible est frappée. */}
                <span
                  className="stamp h-7 min-w-[2.75rem] shrink-0 self-start px-1.5 text-[16px]"
                  aria-label={`${fmt(t.progress)} sur ${fmt(t.target)}`}
                >
                  {fmt(t.target)}
                </span>
              </article>
            ))
          )}
        </div>
      </section>

      {/* ── Les échelles : la goupille dans le prochain palier ──────────── */}
      <section aria-labelledby="echelles-title">
        <div className="mb-3">
          <h2 id="echelles-title" className={BLOCK_TITLE}>
            Les échelles
          </h2>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Le prochain palier de chaque famille, puis ceux qui suivent. Les
            titres restent secrets jusqu&apos;à la victoire.
          </p>
        </div>

        <div className="space-y-5">
          {ladders.map(({ stat, label, group, earned: famEarned, next, rest }) => {
            const Icon = TROPHY_FAMILIES[stat].icon;
            const pct = next ? Math.min(100, (next.progress / next.target) * 100) : 100;
            return (
              <section key={stat} aria-label={label} className="plate-stack">
                <div className="plate px-3 pb-3.5 pt-3">
                  <div className="flex items-center gap-2.5">
                    <span className="stamp size-8 shrink-0">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="text-[18px] uppercase leading-none tracking-[0.05em]">
                      {label}
                    </h3>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      <span className="font-heading text-[16px] font-bold tabular-nums text-foreground">
                        {famEarned.length}
                      </span>
                      /{group.length} paliers
                    </span>
                  </div>

                  {next ? (
                    <>
                      <div className="mt-3.5 flex items-start gap-2">
                        {/* La goupille, plantée dans la plaque du prochain palier. */}
                        <span aria-hidden className="pin pin-rod mt-[15px] size-2.5" />
                        <span className="stamp h-10 min-w-[4.25rem] shrink-0 px-1.5 text-[22px]">
                          {fmt(next.target)}
                        </span>
                        <div className="min-w-0 flex-1 pl-1">
                          <p className="etched">Prochain palier</p>
                          <p className="font-heading text-[18px] font-bold uppercase leading-tight tracking-[0.03em]">
                            {next.name}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-snug text-muted-foreground">
                        {next.description}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div
                          className="segments relative h-2.5 flex-1 bg-muted"
                          role="img"
                          aria-label={`Progression ${fmt(next.progress)} sur ${fmt(next.target)}`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-heading text-[15px] font-bold leading-none tabular-nums">
                          {fmt(next.progress)}
                          <span className="text-muted-foreground">/{fmt(next.target)}</span>
                        </span>
                      </div>
                      <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                        {isSecretTitle(next) ? (
                          <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
                        ) : (
                          <Gift aria-hidden className="mt-px size-3.5 shrink-0" />
                        )}
                        {next.rewardLabel}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold">
                      <Check aria-hidden className="size-4 shrink-0 text-steel" />
                      Échelle complète : tout est au cabinet.
                    </p>
                  )}
                </div>

                {/* Les plaques qui restent à monter, repliées sous la goupille. */}
                {rest.length > 0 && (
                  <details className="plate group">
                    <summary className="flex min-h-11 list-none items-center gap-2 rounded-[var(--radius)] px-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-plate-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <Lock aria-hidden className="size-3.5 shrink-0" />
                      {rest.length} palier{rest.length > 1 ? "s" : ""} suivant
                      {rest.length > 1 ? "s" : ""}
                      <ChevronDown
                        aria-hidden
                        className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <ol className="divide-y divide-[var(--gap)] px-3 pb-1">
                      {rest.map((t) => (
                        <li key={t.id} className="flex items-start gap-3 py-2.5">
                          <span className="stamp h-7 min-w-[3.25rem] shrink-0 px-1.5 text-[16px]">
                            {fmt(t.target)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-tight">{t.name}</p>
                            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                              {t.description}
                            </p>
                            <p className="mt-0.5 flex items-start gap-1 text-[12px] leading-snug text-muted-foreground">
                              {isSecretTitle(t) ? (
                                <>
                                  <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
                                  <span>
                                    Titre secret
                                    <span className="sr-only"> : {t.rewardLabel}</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Gift aria-hidden className="mt-0.5 size-3 shrink-0" />
                                  {t.rewardLabel}
                                </>
                              )}
                            </p>
                            <p className="sr-only">
                              Progression {fmt(t.progress)} sur {fmt(t.target)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
