"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Download, Eye, Infinity as InfinityIcon, Layers, Anchor, Clock, Landmark, Calendar, Lock, Gauge } from "@/components/icons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { Spinner } from "@/components/spinner";
import { useTalents } from "@/components/talents-provider";

// L'Oracle : les savoirs déverrouillés par les auras. Chaque section
// n'existe que si sa carte est dans la collection.

interface OracleData {
  unlocked: string[];
  yearmap?: string[];
  powerRatio?: { bodyweight: number; rows: { name: string; best: number; ratio: number }[] };
  timeline?: { name: string; date: string; weight: number }[];
  muscles?: { muscle: string; volume: number; sessions: number }[];
  neglected?: { name: string; last_date: string; days_ago: number }[];
  journey?: { name: string; before: number; now: number; delta: number }[];
  hall?: { name: string; date: string; weight: number }[];
  archive?: { sessions: number };
}

function fmtDate(raw: string) {
  return new Date(raw).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}

// Une salle = une plaque. Sur sa tête : l'icône frappée sur son étiquette
// noire, le nom de la salle, et ce qu'elle montre.
function RoomHeader({
  Icon,
  name,
  line,
}: {
  Icon: ComponentType<{ className?: string }>;
  name: string;
  line?: string;
}) {
  return (
    <CardHeader className="flex items-center gap-3">
      <span aria-hidden className="stamp size-9 shrink-0">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[19px] uppercase leading-none tracking-[0.04em]">{name}</h2>
        {line && <p className="mt-1 text-xs text-muted-foreground">{line}</p>}
      </div>
    </CardHeader>
  );
}

// Une liste longue se lit dans sa propre fenêtre : elle défile aussi au
// clavier, l'anneau de focus la cerne.
function ScrollList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className="max-h-80 overflow-y-auto rounded-[3px] pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </div>
  );
}

// Une ligne de salle, et le chiffre frappé qui la clôt (la charge).
const ROW = "flex items-center gap-2 py-2 first:pt-0 last:pb-0";
const ROW_STAMP = "stamp h-7 min-w-[4.25rem] shrink-0 px-2 text-[17px]";

export default function OraclePage() {
  const { loaded, has } = useTalents();
  const [data, setData] = useState<OracleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/oracle", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    // Retour depuis une autre page — restauration bfcache ou history load
    // complet : dans les deux cas on relance une requête neuve.
    const onShow = () => load();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (loading || !loaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Les sept salles de l'Oracle : chacune tient à un talent. Les salles
  // fermées restent VISIBLES en silhouette — on sait ce qui existe, jamais
  // quelle carte l'ouvre.
  const ROOMS: { id: string; label: string }[] = [
    { id: "boucle", label: "La Frise du Temps" },
    { id: "sept-tetes", label: "L'Anatomie du Colosse" },
    { id: "profondeurs", label: "Les Machines Oubliées" },
    { id: "voyage", label: "Le Voyage" },
    { id: "regard", label: "Le Hall des Records" },
    { id: "racines", label: "L'Archive Totale" },
    { id: "presage", label: "La Carte du Ciel" },
    { id: "rapport-force", label: "Le Rapport de Force" },
  ];
  const lockedRooms = ROOMS.filter((r) => !has(r.id));
  const anyOracle = ROOMS.some((r) => has(r.id));

  return (
    <div className="min-h-dvh px-4 pb-12 pt-6">
      <BackButton fallback="/collection" />

      <header className="mb-6 mt-3">
        <p className="etched">Savoirs</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">L&apos;Oracle</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {anyOracle
            ? "Ce que tes cartes voient et que les autres ignorent."
            : "Certaines cartes voient plus loin. Trouve-les, et cette page s'éveillera."}
        </p>
      </header>

      <div className="space-y-4">
        {/* Aucune salle ouverte : l'Oracle se tait. */}
        {!anyOracle && (
          <div className="plate flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span aria-hidden className="stamp size-14">
              <Eye className="size-7" />
            </span>
            <div>
              <p className="font-heading text-xl font-bold uppercase tracking-[0.04em]">
                L&apos;Oracle est muet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Ses voix sont dispersées dans le catalogue — continue d&apos;ouvrir des packs.
              </p>
            </div>
          </div>
        )}

        {/* La Boucle (Ouroboros) */}
        {has("boucle") && data?.timeline && data.timeline.length > 0 && (
          <Card>
            <RoomHeader Icon={InfinityIcon} name="La Boucle" line="Tes records dans le temps" />
            <CardContent>
              <ScrollList label="Tes records dans le temps">
                <div className="divide-y divide-[var(--gap)]">
                  {data.timeline.map((r, i) => (
                    <div key={i} className={ROW}>
                      <span className="w-[4.5rem] shrink-0 font-heading text-[13px] font-semibold tabular-nums text-muted-foreground">
                        {fmtDate(r.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                      <span className={ROW_STAMP}>{r.weight} kg</span>
                    </div>
                  ))}
                </div>
              </ScrollList>
            </CardContent>
          </Card>
        )}

        {/* Les Sept Têtes (Hydre) : le tonnage, en plaques */}
        {has("sept-tetes") && data?.muscles && data.muscles.length > 0 && (() => {
          const max = Math.max(...data.muscles!.map((m) => m.volume), 1);
          return (
            <Card>
              <RoomHeader Icon={Layers} name="Les Sept Têtes" line="Tonnage par muscle" />
              <CardContent className="space-y-3">
                {data.muscles.map((m) => (
                  <div key={m.muscle}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-semibold">{m.muscle}</span>
                      <span className="shrink-0 font-heading text-[15px] font-bold leading-none tabular-nums">
                        {m.volume >= 1000 ? `${(m.volume / 1000).toFixed(1)}t` : `${Math.round(m.volume)}kg`}
                      </span>
                    </div>
                    <div className="segments relative h-2.5 bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{ width: `${(m.volume / max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* Les Profondeurs (Léviathan) */}
        {has("profondeurs") && data?.neglected && (
          <Card>
            <RoomHeader Icon={Anchor} name="Les Profondeurs" line="Ce que tu fuis" />
            <CardContent>
              {data.neglected.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Rien ne traîne — aucune machine délaissée depuis plus de 10 jours.
                </p>
              ) : (
                <div className="divide-y divide-[var(--gap)]">
                  {data.neglected.map((n, i) => (
                    <div key={i} className={ROW}>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{n.name}</span>
                      {/* L'étiquette reste noire dans les deux thèmes : le
                          rouge et l'ambre y gardent leur contraste. */}
                      <span
                        className={`stamp h-7 min-w-[3rem] shrink-0 px-2 text-[17px] ${
                          n.days_ago > 21 ? "text-red-400" : "text-amber-300"
                        }`}
                      >
                        {n.days_ago}j
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Le Voyage (Celebi) */}
        {has("voyage") && data?.journey && (
          <Card>
            <RoomHeader Icon={Clock} name="Le Voyage" line="Toi, contre toi d'avant" />
            <CardContent>
              {data.journey.length === 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Pas encore assez d&apos;histoire : reviens quand tes séances récentes
                  pourront se mesurer à celles d&apos;il y a quatre mois et plus.
                </p>
              ) : (
                <div className="divide-y divide-[var(--gap)]">
                  {data.journey.map((j, i) => (
                    <div key={i} className={ROW}>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{j.name}</span>
                      <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-muted-foreground">
                        {j.before} → {j.now} kg
                      </span>
                      <span
                        className={`stamp h-7 min-w-[3.25rem] shrink-0 px-2 text-[17px] ${
                          j.delta >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {j.delta >= 0 ? "+" : ""}{j.delta}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Le Regard (Basilic) */}
        {has("regard") && data?.hall && data.hall.length > 0 && (
          <Card>
            <RoomHeader Icon={Landmark} name="Le Hall des records" line="Gravé dans la pierre" />
            <CardContent>
              <ScrollList label="Le Hall des records">
                <div className="divide-y divide-[var(--gap)]">
                  {data.hall.map((h, i) => (
                    <div key={i} className={ROW}>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{h.name}</span>
                      <span className="shrink-0 font-heading text-[13px] font-semibold tabular-nums text-muted-foreground">
                        {fmtDate(h.date)}
                      </span>
                      <span className={ROW_STAMP}>{h.weight} kg</span>
                    </div>
                  ))}
                </div>
              </ScrollList>
            </CardContent>
          </Card>
        )}

        {/* La Carte du Ciel (Qilin) : l'année entière, jour par jour */}
        {has("presage") && data?.yearmap && (() => {
          const dates = new Set(data.yearmap);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const weeks = 52;
          const cell = 7;
          const gap = 2;
          const W = weeks * (cell + gap);
          const H = 7 * (cell + gap);
          const dayOfWeek = today.getDay() || 7;
          const monday = new Date(today);
          monday.setDate(monday.getDate() - dayOfWeek + 1);
          const cells: { x: number; y: number; on: boolean }[] = [];
          for (let w = 0; w < weeks; w++) {
            for (let d = 0; d < 7; d++) {
              const cd = new Date(monday);
              cd.setDate(cd.getDate() - (weeks - 1 - w) * 7 + d);
              if (cd > today) continue;
              const ds = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, "0")}-${String(cd.getDate()).padStart(2, "0")}`;
              cells.push({ x: w * (cell + gap), y: d * (cell + gap), on: dates.has(ds) });
            }
          }
          const days = data.yearmap.length;
          const caption = `jour${days > 1 ? "s" : ""} d'entraînement sur les 365 derniers`;
          return (
            <Card>
              <RoomHeader Icon={Calendar} name="La Carte du Ciel" line="Ton année, jour par jour" />
              <CardContent>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Ton année, jour par jour"
                  className="overflow-x-auto rounded-[3px] pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  // En mobile, la carte dépasse l'écran : on l'ouvre sur
                  // AUJOURD'HUI (bord droit), le passé se scrolle vers la
                  // gauche — sinon on ne voit que des semaines vides.
                  ref={(el) => {
                    if (el) el.scrollLeft = el.scrollWidth;
                  }}
                >
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    width={W}
                    height={H}
                    className="min-w-full"
                    role="img"
                    aria-label={`${days} ${caption}`}
                  >
                    {cells.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x}
                        y={c.y}
                        width={cell}
                        height={cell}
                        rx={1}
                        // Safari iOS refuse oklch(var(...)) en fill SVG →
                        // tout noir. Le jour d'entraînement prend le hex
                        // littéral de l'accent ; le jour vide, le gris de la
                        // fonte (un oklch sans var, juste dans les deux
                        // thèmes).
                        style={{
                          fill: c.on ? "var(--accent-gradient-mid)" : "var(--muted)",
                          opacity: 1,
                        }}
                      />
                    ))}
                  </svg>
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="stamp h-7 min-w-[2.5rem] shrink-0 px-2 text-[17px]">{days}</span>
                  {caption}
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Les Racines (Niðhöggr) */}
        {has("racines") && (
          <Card>
            <RoomHeader Icon={Download} name="Les Racines" line="L'archive totale" />
            <CardContent>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="stamp h-7 min-w-[2.5rem] shrink-0 px-2 text-[17px]">
                  {data?.archive?.sessions ?? 0}
                </span>
                séances archivées, jusqu&apos;à la première série.
              </p>
              {/* La goupille : l'action de la salle, ronde, à la couleur du
                  joueur. */}
              <a
                href="/api/oracle/export"
                download
                className="mt-4 inline-flex h-12 items-center gap-3 rounded-full bg-gradient-orange-intense pl-1.5 pr-6 font-heading text-[17px] font-bold uppercase tracking-[0.06em] text-primary-foreground"
              >
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/15 shadow-[inset_0_2px_3px_oklch(0_0_0/0.3),0_1px_0_oklch(1_0_0/0.25)]"
                >
                  <Download className="size-4" />
                </span>
                Exporter mes données
              </a>
            </CardContent>
          </Card>
        )}

        {/* Le Rapport de Force : la charge rapportée au poids de corps */}
        {has("rapport-force") && data?.powerRatio && (
          <Card>
            <RoomHeader Icon={Gauge} name="Le Rapport de Force" line="Charge / poids de corps" />
            <CardContent>
              {data.powerRatio.bodyweight <= 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  L&apos;ours veut d&apos;abord te peser : enregistre ton poids
                  de corps (« Pèse-toi », en haut d&apos;une séance) et cette
                  salle s&apos;éveillera.
                </p>
              ) : (
                <>
                  <div className="divide-y divide-[var(--gap)]">
                    {data.powerRatio.rows.map((r) => (
                      <div key={r.name} className={ROW}>
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</p>
                        <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-muted-foreground">
                          {Math.round(r.best)} kg
                        </span>
                        {/* La goupille marque les charges qui passent ton
                            propre poids. */}
                        <span className="flex w-[5.25rem] shrink-0 items-center justify-end gap-1.5">
                          {r.ratio >= 1 && <span aria-hidden className="pin size-2" />}
                          <span className="stamp h-7 min-w-[4rem] px-2 text-[17px]">
                            ×{r.ratio.toFixed(2).replace(".", ",")}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Rapporté à ton poids de corps :{" "}
                    <span className="font-semibold text-foreground">
                      {Math.round(data.powerRatio.bodyweight)} kg
                    </span>{" "}
                    — ×1,00 = tu soulèves ton propre poids.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Les salles encore scellées : silhouettes, pas d'indices */}
        {lockedRooms.length > 0 && (
          <Card>
            <RoomHeader
              Icon={Lock}
              name={`${lockedRooms.length} salle${lockedRooms.length > 1 ? "s" : ""} encore scellée${lockedRooms.length > 1 ? "s" : ""}`}
            />
            <CardContent>
              <ul className="divide-y divide-[var(--gap)]">
                {lockedRooms.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2.5 py-2 text-sm font-semibold text-muted-foreground first:pt-0 last:pb-0"
                  >
                    <Lock aria-hidden className="size-3.5 shrink-0 text-steel-dark" />
                    {r.label}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Chaque salle s&apos;ouvre quand la bonne carte rejoint ta
                collection. Personne ne sait laquelle avant de la tirer.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
