"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Weight, Calendar, TrendingUp, AlertTriangle } from "@/components/icons";
import { Spinner } from "./spinner";

interface Stats {
  totalSessions: number;
  totalVolume: number;
  streak: number;
  lastSessionDate: string | null;
  daysSinceLastSession: number | null;
  weeklyVolumes: { week: string; volume: number }[];
  topExercises: { name: string; maxWeight: number; totalVolume: number; date: string }[];
  muscleDistribution: { muscleGroup: string; setCount: number }[];
  sessionDates: string[];
  sparklines: Record<string, number[]>;
  suggestions: { muscleGroup: string; daysSince: number }[];
}

// Un titre de bloc : gravé sur la plaque, en capitales étroites.
const BLOCK_TITLE =
  "font-heading text-[14px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

export function Dashboard({ friendUserId }: { friendUserId?: number } = {}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = friendUserId
      ? `/api/friends/${friendUserId}/stats`
      : "/api/stats";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [friendUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Chargement..." />
      </div>
    );
  }

  if (!stats || !Array.isArray(stats.weeklyVolumes)) {
    return (
      <div className="plate flex items-center gap-3 px-4 py-4">
        <AlertTriangle className="size-5 shrink-0 text-amber-400" />
        <p className="text-sm text-muted-foreground">
          Les statistiques n&apos;ont pas pu se charger. Recharge la page pour réessayer.
        </p>
      </div>
    );
  }

  const totalMuscleSets = stats.muscleDistribution.reduce((s, m) => s + m.setCount, 0);
  const maxWeeklyVolume = Math.max(...stats.weeklyVolumes.map((w) => w.volume), 1);

  // La pile des compteurs : chaque chiffre frappé sur sa plaque.
  const counters = [
    { Icon: Flame, value: String(stats.totalSessions), label: "Séances" },
    {
      Icon: Weight,
      value:
        stats.totalVolume >= 1000
          ? `${(stats.totalVolume / 1000).toFixed(1)}t`
          : `${stats.totalVolume}kg`,
      label: "Volume total",
    },
    { Icon: TrendingUp, value: String(stats.streak), label: "Streak sem." },
    {
      Icon: Calendar,
      value:
        stats.daysSinceLastSession !== null
          ? stats.daysSinceLastSession === 0
            ? "Auj."
            : `${stats.daysSinceLastSession}j`
          : "-",
      label: "Dernier entr.",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Quick stats — la pile */}
      <div className="plate-stack">
        {counters.map(({ Icon, value, label }) => (
          <div key={label} className="plate flex h-14 items-center gap-3 pl-2 pr-4">
            <span className="stamp h-10 min-w-[5.25rem] px-2.5 text-[28px]">{value}</span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            <Icon className="ml-auto size-4 text-steel-dark" />
          </div>
        ))}
      </div>

      {stats.totalSessions === 0 && !friendUserId && (
        <p className="px-1 text-sm leading-relaxed text-muted-foreground">
          La pile est vide pour l&apos;instant : lance ta première séance avec le
          bouton en bas de l&apos;écran, chaque série notée viendra la remplir.
        </p>
      )}

      {/* Suggestions */}
      {stats.suggestions.length > 0 && (
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className={BLOCK_TITLE}>À travailler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[var(--gap)]">
              {stats.suggestions.map((s) => (
                <div key={s.muscleGroup} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <AlertTriangle className={`size-3.5 shrink-0 ${s.daysSince > 14 ? "text-red-400" : "text-amber-400"}`} />
                  <span className="flex-1 text-sm font-semibold">{s.muscleGroup}</span>
                  <span className={`font-heading text-lg font-bold leading-none tabular-nums ${s.daysSince > 14 ? "text-red-400" : "text-amber-400"}`}>
                    {s.daysSince}j
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly volume chart — chaque barre est une pile de plaques ; la
          semaine en cours porte la couleur de la goupille. */}
      {stats.weeklyVolumes.length > 0 && (() => {
        const W = 320;
        const H = 150;
        const padTop = 18;
        const padBottom = 18;
        const n = stats.weeklyVolumes.length;
        const barGap = 6;
        const barW = Math.min(34, (W - 16 - barGap * (n - 1)) / n);
        const chartH = H - padTop - padBottom;
        const totalBarArea = n * barW + (n - 1) * barGap;
        const offsetX = (W - totalBarArea) / 2;
        const PLATES = 12;
        const plateGap = 2;
        const plateH = (chartH - plateGap * (PLATES - 1)) / PLATES;

        return (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className={BLOCK_TITLE}>Volume par semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Volume soulevé par semaine">
                {stats.weeklyVolumes.map((w, i) => {
                  const pct = maxWeeklyVolume > 0 ? w.volume / maxWeeklyVolume : 0;
                  const count = w.volume > 0 ? Math.max(1, Math.round(pct * PLATES)) : 0;
                  const x = offsetX + i * (barW + barGap);
                  const current = i === n - 1;
                  const topY = padTop + chartH - (count * plateH + Math.max(0, count - 1) * plateGap);
                  const weekDate = new Date(w.week);
                  const label = `${weekDate.getDate()}/${weekDate.getMonth() + 1}`;
                  const valLabel = w.volume >= 1000 ? `${(w.volume / 1000).toFixed(1)}t` : `${w.volume}`;
                  return (
                    <g key={i}>
                      {/* Le socle : une plaque vide, pour que la semaine sans
                          volume reste lisible. */}
                      {count === 0 && (
                        <rect x={x} y={padTop + chartH - 2} width={barW} height={2} rx={1} fill="var(--muted)" />
                      )}
                      {Array.from({ length: count }, (_, k) => (
                        <rect
                          key={k}
                          x={x}
                          y={padTop + chartH - (k + 1) * plateH - k * plateGap}
                          width={barW}
                          height={plateH}
                          rx={1}
                          fill={current ? "var(--primary)" : "var(--steel-dark)"}
                        />
                      ))}
                      <text
                        x={x + barW / 2}
                        y={(count > 0 ? topY : padTop + chartH - 2) - 5}
                        textAnchor="middle"
                        className={`font-heading text-[10px] font-bold ${current ? "fill-foreground" : "fill-muted-foreground"}`}
                      >
                        {valLabel}
                      </text>
                      <text x={x + barW / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground font-heading text-[10px] font-semibold">
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </CardContent>
          </Card>
        );
      })()}

      {/* Records with sparklines */}
      {stats.topExercises.length > 0 && (
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className={BLOCK_TITLE}>Records personnels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto pr-1">
              <table className="w-full">
                <tbody className="divide-y divide-[var(--gap)]">
                  {stats.topExercises.map((ex, i) => {
                    const spark = stats.sparklines[ex.name] || [];
                    const sparkW = 48;
                    const sparkH = 18;
                    let sparkPath = "";
                    if (spark.length > 1) {
                      const min = Math.min(...spark);
                      const max = Math.max(...spark);
                      const range = max - min || 1;
                      sparkPath = spark
                        .map((v, j) => {
                          const x = (j / (spark.length - 1)) * sparkW;
                          const y = sparkH - ((v - min) / range) * (sparkH - 2) - 1;
                          return `${j === 0 ? "M" : "L"} ${x} ${y}`;
                        })
                        .join(" ");
                    }
                    return (
                      <tr key={i}>
                        <td className="w-6 py-2 pr-2">
                          <Trophy className="size-3.5 text-yellow-400/80" />
                        </td>
                        <td className="max-w-[100px] py-2 pr-2">
                          <p className="truncate text-sm font-semibold">{ex.name}</p>
                        </td>
                        <td className="py-2 pr-2">
                          {sparkPath && (
                            <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} aria-hidden>
                              <path d={sparkPath} fill="none" stroke="var(--steel)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 text-right">
                          <span className="stamp h-7 min-w-[4.25rem] px-2 text-[17px]">{ex.maxWeight} kg</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Muscle distribution — la charge, en plaques */}
      {stats.muscleDistribution.length > 0 && (
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className={BLOCK_TITLE}>Répartition muscles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.muscleDistribution.map((m) => {
                const pct = totalMuscleSets > 0 ? Math.round((m.setCount / totalMuscleSets) * 100) : 0;
                return (
                  <div key={m.muscleGroup}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[13px] font-semibold">{m.muscleGroup}</span>
                      <span className="font-heading text-[15px] font-bold leading-none tabular-nums">{pct}%</span>
                    </div>
                    <div className="segments relative h-2.5 bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap */}
      {stats.sessionDates.length > 0 && (() => {
        const dateSet = new Set(stats.sessionDates);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weeks = 13;
        const cellSize = 14;
        const gap = 3;
        const W = weeks * (cellSize + gap) + 20;
        const H = 7 * (cellSize + gap);
        const dayLabels = ["L", "", "M", "", "V", "", "D"];

        const dayOfWeek = today.getDay() || 7;
        const monday = new Date(today);
        monday.setDate(monday.getDate() - dayOfWeek + 1);

        const cells: { x: number; y: number; active: boolean }[] = [];
        for (let w = 0; w < weeks; w++) {
          for (let d = 0; d < 7; d++) {
            const cellDate = new Date(monday);
            cellDate.setDate(cellDate.getDate() - (weeks - 1 - w) * 7 + d);
            if (cellDate > today) continue;
            const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
            cells.push({
              x: 20 + w * (cellSize + gap),
              y: d * (cellSize + gap),
              active: dateSet.has(dateStr),
            });
          }
        }

        return (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className={BLOCK_TITLE}>Fréquence (3 mois)</CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Jours de séance sur trois mois">
                {dayLabels.map((label, i) => (
                  label && (
                    <text key={i} x={8} y={i * (cellSize + gap) + cellSize - 3} textAnchor="middle" className="fill-muted-foreground font-heading text-[9px] font-bold">
                      {label}
                    </text>
                  )
                ))}
                {cells.map((c, i) => (
                  <rect
                    key={i}
                    x={c.x}
                    y={c.y}
                    width={cellSize}
                    height={cellSize}
                    rx={1.5}
                    fill={c.active ? "var(--primary)" : "var(--muted)"}
                  />
                ))}
              </svg>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
