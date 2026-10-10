"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Infinity as InfinityIcon, Layers, Anchor, Clock, Landmark, Calendar, Lock, Gauge } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
          Savoirs
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tighter">L&apos;Oracle</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {anyOracle
            ? "Ce que tes cartes voient et que les autres ignorent."
            : "Certaines cartes voient plus loin. Trouve-les, et cette page s'éveillera."}
        </p>
      </header>

      <div className="space-y-4">
        {/* La Boucle (Ouroboros) */}
        {has("boucle") && data?.timeline && data.timeline.length > 0 && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <InfinityIcon className="size-4" />
                La Boucle — tes records dans le temps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {data.timeline.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-16 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {fmtDate(r.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                    <span className="shrink-0 font-black text-primary">{r.weight} kg</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Les Sept Têtes (Hydre) */}
        {has("sept-tetes") && data?.muscles && data.muscles.length > 0 && (() => {
          const max = Math.max(...data.muscles!.map((m) => m.volume), 1);
          return (
            <Card className="card-gradient-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                  <Layers className="size-4" />
                  Les Sept Têtes — tonnage par muscle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.muscles.map((m) => (
                  <div key={m.muscle}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold">{m.muscle}</span>
                      <span className="font-mono text-[10px] tabular-nums text-primary">
                        {m.volume >= 1000 ? `${(m.volume / 1000).toFixed(1)}t` : `${Math.round(m.volume)}kg`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary/50">
                      <div className="h-full rounded-full bg-gradient-orange" style={{ width: `${(m.volume / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* Les Profondeurs (Léviathan) */}
        {has("profondeurs") && data?.neglected && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Anchor className="size-4" />
                Les Profondeurs — ce que tu fuis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.neglected.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Rien ne traîne — aucune machine délaissée depuis plus de 10 jours.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.neglected.map((n, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-bold">{n.name}</span>
                      <span className={`shrink-0 font-black ${n.days_ago > 21 ? "text-red-400" : "text-amber-400"}`}>
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
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Clock className="size-4" />
                Le Voyage — toi, contre toi d&apos;avant
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.journey.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Pas encore assez d&apos;histoire : reviens quand tes séances récentes
                  pourront se mesurer à celles d&apos;il y a quatre mois et plus.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.journey.map((j, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-bold">{j.name}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {j.before} → {j.now} kg
                      </span>
                      <span className={`w-12 shrink-0 text-right font-black ${j.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Landmark className="size-4" />
                Le Hall des records — gravé dans la pierre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {data.hall.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-bold">{h.name}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {fmtDate(h.date)}
                    </span>
                    <span className="w-14 shrink-0 text-right font-black text-primary">{h.weight} kg</span>
                  </div>
                ))}
              </div>
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
          return (
            <Card className="card-gradient-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                  <Calendar className="size-4" />
                  La Carte du Ciel — ton année, jour par jour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="overflow-x-auto"
                  // En mobile, la carte dépasse l'écran : on l'ouvre sur
                  // AUJOURD'HUI (bord droit), le passé se scrolle vers la
                  // gauche — sinon on ne voit que des semaines vides.
                  ref={(el) => {
                    if (el) el.scrollLeft = el.scrollWidth;
                  }}
                >
                  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="min-w-full">
                    {cells.map((c, i) => (
                      <rect
                        key={i}
                        x={c.x}
                        y={c.y}
                        width={cell}
                        height={cell}
                        rx={1.5}
                        // Safari iOS refuse oklch(var(...)) en fill SVG →
                        // tout noir. On peint avec le hex littéral de
                        // l'accent et un blanc translucide : incassable.
                        style={{
                          fill: c.on ? "var(--accent-gradient-mid)" : "rgba(255,255,255,0.16)",
                          opacity: 1,
                        }}
                      />
                    ))}
                  </svg>
                </div>
                <p className="mt-2 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {data.yearmap.length} jour{data.yearmap.length > 1 ? "s" : ""}{" "}
                  d&apos;entraînement sur les 365 derniers
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Les Racines (Niðhöggr) */}
        {has("racines") && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Download className="size-4" />
                Les Racines — l&apos;archive totale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                {data?.archive?.sessions ?? 0} séances archivées, jusqu&apos;à la première série.
              </p>
              <a
                href="/api/oracle/export"
                download
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-orange-intense px-4 text-xs font-black uppercase tracking-wider text-black"
              >
                <Download className="size-3.5" strokeWidth={3} />
                Exporter mes données
              </a>
            </CardContent>
          </Card>
        )}

        {!anyOracle && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/40 ring-1 ring-border">
              <Eye className="size-7 text-muted-foreground/60" />
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              L&apos;Oracle est muet. Ses voix sont dispersées dans le catalogue —
              continue d&apos;ouvrir des packs.
            </p>
          </div>
        )}

        {/* Le Rapport de Force : la charge rapportée au poids de corps */}
        {has("rapport-force") && data?.powerRatio && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Gauge className="size-4" />
                Le Rapport de Force — charge / poids de corps
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.powerRatio.bodyweight <= 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  L&apos;ours veut d&apos;abord te peser : enregistre ton poids
                  de corps (« Pèse-toi », en haut d&apos;une séance) et cette
                  salle s&apos;éveillera.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {data.powerRatio.rows.map((r) => (
                      <div key={r.name} className="flex items-baseline gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs font-bold">{r.name}</p>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {Math.round(r.best)} kg
                        </span>
                        <span className={`w-14 shrink-0 text-right font-mono text-sm font-black tabular-nums ${r.ratio >= 1 ? "text-primary" : "text-foreground/80"}`}>
                          ×{r.ratio.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    rapporté à ton poids de corps : {Math.round(data.powerRatio.bodyweight)} kg
                    — ×1,00 = tu soulèves ton propre poids
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Les salles encore scellées : silhouettes, pas d'indices */}
        {lockedRooms.length > 0 && (
          <div className="rounded-2xl bg-secondary/20 p-4 ring-1 ring-border/60">
            <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
              <Lock className="size-3.5" />
              {lockedRooms.length} salle{lockedRooms.length > 1 ? "s" : ""} encore scellée{lockedRooms.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lockedRooms.map((r) => (
                <span
                  key={r.id}
                  className="rounded-md bg-secondary/40 px-2 py-1 text-[10px] font-bold text-muted-foreground/60 ring-1 ring-border/50"
                >
                  {r.label}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
              Chaque salle s&apos;ouvre quand la bonne carte rejoint ta
              collection. Personne ne sait laquelle avant de la tirer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
