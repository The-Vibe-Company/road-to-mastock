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
      });
  }, [friendUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Chargement..." />
      </div>
    );
  }

  if (!stats) return null;

  const totalMuscleSets = stats.muscleDistribution.reduce((s, m) => s + m.setCount, 0);
  const maxWeeklyVolume = Math.max(...stats.weeklyVolumes.map((w) => w.volume), 1);

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="card-gradient-border">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Flame className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black text-primary">{stats.totalSessions}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Seances</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient-border">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Weight className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black text-primary">
                {stats.totalVolume >= 1000
                  ? `${(stats.totalVolume / 1000).toFixed(1)}t`
                  : `${stats.totalVolume}kg`}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Volume total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient-border">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black text-primary">{stats.streak}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Streak sem.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient-border">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black text-primary">
                {stats.daysSinceLastSession !== null ? (stats.daysSinceLastSession === 0 ? "Auj." : `${stats.daysSinceLastSession}j`) : "-"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dernier entr.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions */}
      {stats.suggestions.length > 0 && (
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
              A travailler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.suggestions.map((s) => (
                <div key={s.muscleGroup} className="flex items-center gap-3">
                  <AlertTriangle className={`size-3.5 shrink-0 ${s.daysSince > 14 ? "text-red-500" : "text-amber-500"}`} />
                  <span className="flex-1 text-sm font-bold">{s.muscleGroup}</span>
                  <span className={`text-sm font-black ${s.daysSince > 14 ? "text-red-500" : "text-amber-500"}`}>
                    {s.daysSince}j
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly volume chart */}
      {stats.weeklyVolumes.length > 0 && (() => {
        const W = 320;
        const H = 140;
        const padTop = 20;
        const padBottom = 20;
        const n = stats.weeklyVolumes.length;
        const barGap = 6;
        const barW = Math.min(36, (W - 16 - barGap * (n - 1)) / n);
        const chartH = H - padTop - padBottom;
        const totalBarArea = n * barW + (n - 1) * barGap;
        const offsetX = (W - totalBarArea) / 2;

        return (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
                Volume par semaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-gradient-start)" />
                    <stop offset="100%" stopColor="var(--accent-gradient-end)" />
                  </linearGradient>
                </defs>
                {stats.weeklyVolumes.map((w, i) => {
                  const pct = maxWeeklyVolume > 0 ? w.volume / maxWeeklyVolume : 0;
                  const barH = Math.max(pct * chartH, 3);
                  const x = offsetX + i * (barW + barGap);
                  const y = padTop + chartH - barH;
                  const weekDate = new Date(w.week);
                  const label = `${weekDate.getDate()}/${weekDate.getMonth() + 1}`;
                  const valLabel = w.volume >= 1000 ? `${(w.volume / 1000).toFixed(1)}t` : `${w.volume}`;
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={barW} height={barH} rx={4} fill="url(#barGrad)" />
                      <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="fill-primary/70 text-[8px] font-bold">
                        {valLabel}
                      </text>
                      <text x={x + barW / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[8px]">
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
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
              Records personnels
            </CardTitle>
            <p className="text-[11px] font-medium text-foreground/60">
              Courbe : volume par séance, lissé sur 3 séances
            </p>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto pr-1">
              <table className="w-full">
                <tbody>
                  {stats.topExercises.map((ex, i) => {
                    const spark = stats.sparklines[ex.name] || [];
                    return (
                      <tr key={i} className="transition-colors hover:bg-secondary/30">
                        <td className="py-2 pl-2 pr-2">
                          <Trophy className="size-3.5 text-yellow-500/70" />
                        </td>
                        <td className="max-w-[100px] py-2 pr-2">
                          <p className="truncate text-sm font-bold">{ex.name}</p>
                        </td>
                        <td className="py-2 pr-2">
                          <VolumeSparkline values={spark} />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-right text-sm font-black text-primary">
                          {ex.maxWeight} kg
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

      {/* Muscle distribution */}
      {stats.muscleDistribution.length > 0 && (
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
              Repartition muscles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {stats.muscleDistribution.map((m) => {
                const pct = totalMuscleSets > 0 ? Math.round((m.setCount / totalMuscleSets) * 100) : 0;
                return (
                  <div key={m.muscleGroup}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold">{m.muscleGroup}</span>
                      <span className="text-[10px] font-bold text-primary">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary/50">
                      <div
                        className="h-full rounded-full bg-gradient-orange"
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
        const H = 7 * (cellSize + gap) + 16;
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
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/60">
                Frequence (3 mois)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                {dayLabels.map((label, i) => (
                  label && (
                    <text key={i} x={8} y={i * (cellSize + gap) + cellSize - 2} textAnchor="middle" className="fill-muted-foreground text-[7px]">
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
                    rx={3}
                    fill={c.active ? "var(--primary)" : "var(--muted)"}
                    opacity={c.active ? 1 : 0.5}
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

// La moyenne mobile sur 3 séances, comme les courbes lissées des pages
// d'évolution : la tendance du volume, sans le bruit d'une seule séance.
function smoothVolumes(values: number[]) {
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - 2), i + 1);
    return window.reduce((a, b) => a + b, 0) / window.length;
  });
}

function VolumeSparkline({ values }: { values: number[] }) {
  if (values.length < 2 || Math.max(...values) <= 0) return null;
  const W = 96;
  const H = 28;
  const PAD = 3;
  const smoothed = smoothVolumes(values);
  const min = Math.min(...smoothed);
  const range = Math.max(...smoothed) - min || 1;
  const pts = smoothed.map((v, i) => ({
    x: PAD + (i / (smoothed.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
  }));
  // Pas d'angles : chaque point sert de contrôle et le tracé passe par les
  // milieux entre deux séances.
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    line += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  line += ` L ${last.x} ${last.y}`;
  const area = `${line} L ${last.x} ${H} L ${pts[0].x} ${H} Z`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Volume par séance, lissé sur 3 séances"
    >
      <path d={area} fill="var(--primary)" fillOpacity={0.15} />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2.75} fill="var(--primary)" />
    </svg>
  );
}
