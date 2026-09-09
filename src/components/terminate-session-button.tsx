"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Lock, Loader2, Star, Trophy, Flame, Ticket, Shield, Magnet, ShieldOff, Activity } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useTalents } from "./talents-provider";
import { RARITY_COLORS, RARITY_LABELS, type Rarity } from "@/lib/rarities";
import { TROPHY_FAMILIES } from "@/components/trophy-medallion";

// Confettis de la Mélodie (Meloetta) : purement décoratif, 40 particules.
function ConfettiBurst() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 8) * 0.12,
    duration: 1.6 + ((i * 13) % 10) / 10,
    hue: (i * 47) % 360,
    size: 5 + ((i * 7) % 6),
  }));
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: `oklch(0.75 0.2 ${p.hue})`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

interface SessionState {
  terminatedAt: string | null;
  tokensGrantedAt: string | null;
  hasSets: boolean;
}

interface RewardInfo {
  type: "normal" | "special";
  weekPosition: number | null;
}

interface CardioDraw {
  drawId: number;
  card: {
    category: "animal" | "pokemon";
    name: string;
    rarity: Rarity;
    imageUrl: string | null;
  };
  attract: string;
  repel: string;
}

interface DraftAwakening {
  card: { category: "animal" | "pokemon"; name: string; rarity: Rarity; imageUrl: string | null };
  powerName: string;
  detail: string;
}

interface TrophyProgressStep {
  stat: string;
  name: string;
  target: number;
  before: number;
  after: number;
}

interface AwakenedGuardian {
  exerciseId: number;
  exerciseName: string;
  card: {
    category: "animal" | "pokemon";
    name: string;
    rarity: Rarity;
    imageUrl: string | null;
  };
  powerName: string;
  detail: string;
  record: boolean;
  fragmentRarity: Rarity | null;
}

export function TerminateSessionButton({ sessionId }: { sessionId: number }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<RewardInfo | null>(null);
  const [guardians, setGuardians] = useState<AwakenedGuardian[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [newTrophies, setNewTrophies] = useState<{ id: string; name: string; rewardLabel: string }[]>([]);
  const [trophyProgress, setTrophyProgress] = useState<TrophyProgressStep[]>([]);
  // L'Échappée : cartes tirées par le cardio, en attente de placement.
  const [draws, setDraws] = useState<CardioDraw[]>([]);
  const [drawModes, setDrawModes] = useState<Record<number, "attract" | "repel">>({});
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftResults, setDraftResults] = useState<DraftAwakening[]>([]);
  // Le carrousel de l'Éveil : un Gardien par écran, à la clôture.
  const [showAwakening, setShowAwakening] = useState(false);
  const [awakeStep, setAwakeStep] = useState(0);
  const [closeError, setCloseError] = useState<string | null>(null);
  // Le garde-fou : on ne clôture pas d'un pouce distrait.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { has, assets } = useTalents();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPsyduck, setShowPsyduck] = useState(false);

  const refresh = async () => {
    const r = await fetch(`/api/sessions/${sessionId}`);
    if (!r.ok) return;
    const data = await r.json();
    const hasSets = (data.exercises ?? []).some(
      (ex: { sets?: unknown[] }) => Array.isArray(ex.sets) && ex.sets.length > 0,
    );
    setState({
      terminatedAt: data.terminatedAt ?? null,
      tokensGrantedAt: data.tokensGrantedAt ?? null,
      hasSets,
    });
    if (Array.isArray(data.cardioDraws) && data.cardioDraws.length > 0) {
      setDraws(data.cardioDraws);
    }
  };

  useEffect(() => {
    refresh();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTerminate = async () => {
    if (busy || !state) return;
    setBusy(true);
    setReward(null);
    setCloseError(null);
    try {
      const r = await fetch(`/api/sessions/${sessionId}/terminate`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        if (err?.error) setCloseError(err.error);
        return;
      }
      const data = await r.json();
      if (data.specialTokenGranted) {
        setReward({ type: "special", weekPosition: data.weekPosition ?? null });
      } else if (data.tokenGranted) {
        setReward({ type: "normal", weekPosition: data.weekPosition ?? null });
      }
      const awakened = Array.isArray(data.guardians) ? data.guardians : [];
      setGuardians(awakened);
      if (awakened.length > 0) {
        setAwakeStep(0);
        setShowAwakening(true);
      }
      setRecordCount(data.recordCount ?? 0);
      setNewTrophies(Array.isArray(data.newTrophies) ? data.newTrophies : []);
      setTrophyProgress(Array.isArray(data.trophyProgress) ? data.trophyProgress : []);
      if (Array.isArray(data.cardioDraws)) setDraws(data.cardioDraws);

      // Reliques de clôture — chacune ne s'éveille que si son talent est là.
      const gotReward = data.tokenGranted || data.specialTokenGranted;
      const gotRecord = (data.recordCount ?? 0) > 0;
      if (has("melodie") && gotReward) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3200);
        try {
          navigator.vibrate?.([80, 60, 80, 60, 200]);
        } catch {}
      }
      if (gotRecord) {
        // Le Cri de la Banshee : une signature haptique rien qu'à elle.
        if (has("cri")) {
          try {
            navigator.vibrate?.([300, 80, 100, 80, 500]);
          } catch {}
        }
        // La Migraine : Psykokwak surgit, dépassé par tes progrès.
        if (has("migraine") && assets["migraine"]) {
          setShowPsyduck(true);
          setTimeout(() => setShowPsyduck(false), 2700);
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDraft = async () => {
    if (draftBusy || draws.some((d) => !drawModes[d.drawId])) return;
    setDraftBusy(true);
    try {
      const r = await fetch(`/api/sessions/${sessionId}/cardio-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choices: draws.map((d) => ({ drawId: d.drawId, mode: drawModes[d.drawId] })),
        }),
      });
      if (!r.ok) return;
      const data = await r.json();
      setDraftResults(Array.isArray(data.awakenings) ? data.awakenings : []);
      setDraws([]);
      setDrawModes({});
    } finally {
      setDraftBusy(false);
    }
  };

  const handleReopen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/sessions/${sessionId}/terminate`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  const awakeCurrent = guardians[Math.min(awakeStep, Math.max(0, guardians.length - 1))];
  const awakeLast = awakeStep >= guardians.length - 1;

  if (state.terminatedAt) {
    return (
      <div className="mb-6 flex flex-col gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/30">
        {/* ── Le carrousel de l'Éveil : les Gardiens de la séance, un par un ── */}
        {showAwakening && awakeCurrent && (
          <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
            <div className="relative flex h-[29rem] max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-primary/40 bg-background sm:rounded-3xl sm:border-2 sm:border-primary/30">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-8">
                <div className={`pointer-events-none absolute left-1/2 top-14 size-56 -translate-x-1/2 rounded-full blur-3xl ${RARITY_COLORS[awakeCurrent.card.rarity].bg}`} />
                <p className="text-center font-mono text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">
                  L&apos;Éveil · {awakeStep + 1} / {guardians.length}
                </p>
                <div key={awakeStep} className="animate-card-reveal mt-4 flex flex-col items-center text-center">
                  <span className="rounded-md bg-secondary/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground ring-1 ring-border">
                    {awakeCurrent.exerciseName}
                  </span>
                  <div className={`relative mt-4 size-28 overflow-hidden rounded-2xl ${RARITY_COLORS[awakeCurrent.card.rarity].bg} ring-2 ${RARITY_COLORS[awakeCurrent.card.rarity].ring} drop-shadow-2xl`}>
                    {awakeCurrent.card.imageUrl && (
                      <Image src={awakeCurrent.card.imageUrl} alt="" fill unoptimized className="object-cover" />
                    )}
                  </div>
                  <p className={`mt-3 text-xl font-black tracking-tight ${RARITY_COLORS[awakeCurrent.card.rarity].text}`}>
                    {awakeCurrent.card.name}
                  </p>
                  <p className="mt-2 text-base font-black tracking-tight text-foreground">
                    {awakeCurrent.powerName}
                  </p>
                  {awakeCurrent.detail && (
                    <p className="mt-2 w-full max-w-xs rounded-xl bg-primary/10 px-3 py-2.5 font-mono text-xs font-bold leading-snug text-primary ring-1 ring-primary/30">
                      {awakeCurrent.detail}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                    {awakeCurrent.record && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-400">
                        <Trophy className="size-3" />
                        Record battu
                      </span>
                    )}
                    {awakeCurrent.fragmentRarity && (
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${RARITY_COLORS[awakeCurrent.fragmentRarity].bg} ${RARITY_COLORS[awakeCurrent.fragmentRarity].text}`}>
                        <Flame className="size-3" />
                        +1 fragment {RARITY_LABELS[awakeCurrent.fragmentRarity].toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-border/50 px-6 pb-6 pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-center gap-1">
                  {guardians.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === awakeStep ? "w-5 bg-primary" : i < awakeStep ? "w-1.5 bg-primary/50" : "w-1.5 bg-secondary"
                      }`}
                    />
                  ))}
                </div>
                {awakeLast ? (
                  <Button
                    onClick={() => setShowAwakening(false)}
                    className="h-12 w-full rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                  >
                    <CheckCircle2 className="size-4" />
                    {draws.length > 0 ? "Voir l'Échappée" : "Compris"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setAwakeStep((n) => n + 1)}
                    className="h-12 w-full rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
                  >
                    Gardien suivant
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {showConfetti && <ConfettiBurst />}
        {showPsyduck && assets["migraine"] && (
          <div className="pointer-events-none fixed bottom-10 left-1/2 z-[120] -translate-x-1/2">
            <Image
              src={assets["migraine"]!}
              alt=""
              width={90}
              height={90}
              unoptimized
              className="psyduck-pop size-24 object-contain drop-shadow-2xl"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-400" />
          <p className="flex-1 text-sm font-bold text-emerald-300">
            Séance clôturée
          </p>
          <button
            onClick={handleReopen}
            disabled={busy}
            className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 hover:text-emerald-300 disabled:opacity-50"
          >
            Rouvrir
          </button>
        </div>
        {reward && (
          <div className="flex flex-col gap-1.5">
            {reward.type === "special" ? (
              <Link
                href="/collection"
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-black shadow-[0_0_28px_-8px_rgba(251,191,36,0.7)]"
              >
                <Star className="size-4" strokeWidth={3} />
                +1 jeton spécial — tourne la roue
              </Link>
            ) : (
              <Link
                href="/collection"
                className="flex items-center gap-2 rounded-xl bg-gradient-orange-intense px-3 py-2 text-sm font-black text-black"
              >
                <Ticket className="size-4" />
                +1 jeton — ouvre ton pack
              </Link>
            )}
            {reward.weekPosition !== null && (
              <span className="inline-flex w-fit items-center gap-1 rounded-md bg-secondary/40 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ring-1 ring-border">
                {reward.weekPosition === 1
                  ? "1ʳᵉ séance de la semaine"
                  : reward.weekPosition === 4
                    ? "4ᵉ séance de la semaine"
                    : `Séance ${reward.weekPosition} de la semaine`}
              </span>
            )}
          </div>
        )}

        {/* Trophées gagnés par cette séance — la gloire d'abord */}
        {newTrophies.map((t) => (
          <Link
            key={t.id}
            href="/trophees"
            className="flex items-center gap-3 rounded-xl bg-yellow-500/10 px-3 py-2.5 ring-1 ring-yellow-500/40"
          >
            <Trophy className="size-5 shrink-0 text-yellow-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-400/80">
                Trophée gagné
              </p>
              <p className="truncate text-sm font-black text-yellow-200">{t.name}</p>
              <p className="truncate text-[10px] text-yellow-100/70">{t.rewardLabel}</p>
            </div>
          </Link>
        ))}

        {/* L'avancée : ce que la séance a fait progresser vers les trophées */}
        {trophyProgress.length > 0 && (
          <div className="mt-1 rounded-xl bg-background/60 p-3 ring-1 ring-border">
            <div className="mb-2 flex items-center gap-1.5">
              <Trophy className="size-3.5 text-yellow-400/80" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-300/80">
                Ta route vers les trophées
              </span>
            </div>
            <div className="space-y-2">
              {trophyProgress.map((t) => {
                const fam = TROPHY_FAMILIES[t.stat];
                const Icon = fam?.icon;
                const pct = Math.min(100, Math.round((t.after / t.target) * 100));
                const beforePct = Math.min(100, Math.round((t.before / t.target) * 100));
                return (
                  <div key={t.stat}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-bold">
                        {Icon && <Icon className={`size-3.5 shrink-0 ${fam.accent}`} />}
                        <span className="truncate">{t.name}</span>
                      </p>
                      <p className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                        {t.before.toLocaleString("fr-FR")}
                        <span className="text-emerald-300"> → {t.after.toLocaleString("fr-FR")}</span>
                        {" / "}
                        {t.target.toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                      <div className="rounded-l-full bg-yellow-500/45" style={{ width: `${beforePct}%` }} />
                      <div className="bg-gradient-orange rounded-r-full" style={{ width: `${Math.max(1, pct - beforePct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* L'Échappée : le cardio a tiré des cartes de la réserve — place-les */}
        {draws.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-xl bg-background/60 p-3 ring-1 ring-sky-500/40">
            <div className="mb-1 flex items-center gap-1.5">
              <Activity className="size-3.5 text-sky-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                L&apos;Échappée — {draws.length} carte{draws.length > 1 ? "s" : ""} tirée{draws.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground">
              Ton cardio a fait sortir des cartes de ta réserve. Place chacune :
              son éveil part dans le chapeau, dans le sens que tu choisis.
            </p>
            <div className="space-y-2">
              {draws.map((d, i) => (
                <div
                  key={d.drawId}
                  className="animate-card-reveal rounded-lg bg-secondary/30 p-2 ring-1 ring-border"
                  style={{ animationDelay: `${i * 0.45}s`, animationFillMode: "backwards" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`relative size-11 shrink-0 overflow-hidden rounded-lg ${RARITY_COLORS[d.card.rarity].bg} ring-1 ${RARITY_COLORS[d.card.rarity].ring}`}>
                      {d.card.imageUrl && (
                        <Image src={d.card.imageUrl} alt="" fill unoptimized className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-black ${RARITY_COLORS[d.card.rarity].text}`}>
                        {d.card.name}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {RARITY_LABELS[d.card.rarity]}
                      </p>
                    </div>
                  </div>
                  {/* Chaque bouton dit CE QU'IL FERA pour cette carte-là */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setDrawModes((m) => ({ ...m, [d.drawId]: "attract" }))}
                      className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all active:scale-95 ${
                        drawModes[d.drawId] === "attract"
                          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50"
                          : "bg-secondary/60 text-muted-foreground ring-1 ring-border"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider">
                        <Magnet className="size-3" />
                        Attire
                      </span>
                      <span className="font-mono text-[10px] font-bold tabular-nums text-emerald-300/90">
                        {d.attract}
                      </span>
                    </button>
                    <button
                      onClick={() => setDrawModes((m) => ({ ...m, [d.drawId]: "repel" }))}
                      className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all active:scale-95 ${
                        drawModes[d.drawId] === "repel"
                          ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/50"
                          : "bg-secondary/60 text-muted-foreground ring-1 ring-border"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider">
                        <ShieldOff className="size-3" />
                        Repousse
                      </span>
                      <span className="font-mono text-[10px] font-bold tabular-nums text-red-300/90">
                        {d.repel}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={handleDraft}
              disabled={draftBusy || draws.some((d) => !drawModes[d.drawId])}
              className="mt-2.5 h-10 w-full rounded-xl bg-sky-500 text-xs font-black uppercase tracking-wider text-black hover:bg-sky-400 disabled:opacity-40"
            >
              {draftBusy ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
              Éveiller les renforts
            </Button>
          </div>
        )}

        {/* Les renforts éveillés : le résultat du placement */}
        {draftResults.length > 0 && (
          <div className="mt-1 rounded-xl bg-background/60 p-3 ring-1 ring-sky-500/30">
            <div className="mb-2 flex items-center gap-1.5">
              <Activity className="size-3.5 text-sky-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                Renforts éveillés
              </span>
            </div>
            <div className="space-y-1.5">
              {draftResults.map((a, i) => (
                <div key={i} className="animate-card-reveal flex items-center gap-2.5" style={{ animationDelay: `${i * 0.25}s`, animationFillMode: "backwards" }}>
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                    {a.card.imageUrl && (
                      <Image src={a.card.imageUrl} alt="" fill unoptimized className="object-contain p-0.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-bold ${RARITY_COLORS[a.card.rarity].text}`}>{a.card.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground/70">{a.powerName}</span>
                      <span className="text-primary/80"> · {a.detail}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* La récolte : les Gardiens éveillés par cette séance */}
        {guardians.length > 0 && (
          <div className="mt-1 rounded-xl bg-background/60 p-3 ring-1 ring-border">
            <div className="mb-2 flex items-center gap-1.5">
              <Shield className="size-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
                {guardians.length} gardien{guardians.length > 1 ? "s" : ""} éveillé{guardians.length > 1 ? "s" : ""}
              </span>
              {recordCount > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-yellow-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-400">
                  <Trophy className="size-3" />
                  Record battu
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {guardians.map((g) => (
                <div key={g.exerciseId} className="flex items-center gap-2.5">
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                    {g.card.imageUrl && (
                      <Image src={g.card.imageUrl} alt="" fill unoptimized className="object-contain p-0.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold leading-tight">
                      <span className={RARITY_COLORS[g.card.rarity].text}>{g.card.name}</span>
                      <span className="text-muted-foreground"> · {g.exerciseName}</span>
                    </p>
                    <p className="truncate text-[10px] leading-tight text-muted-foreground">
                      <span className="font-bold text-foreground/70">{g.powerName}</span>
                      {g.detail && <span className="text-primary/80"> · {g.detail}</span>}
                    </p>
                  </div>
                  {g.record && g.fragmentRarity && (
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${RARITY_COLORS[g.fragmentRarity].bg} ${RARITY_COLORS[g.fragmentRarity].text}`}>
                      <Flame className="size-2.5" />
                      +1 fragment {RARITY_LABELS[g.fragmentRarity].toLowerCase()}
                    </span>
                  )}
                  {g.record && !g.fragmentRarity && (
                    <Trophy className="size-3.5 shrink-0 text-yellow-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!state.hasSets) return null;

  return (
    <div className="mb-6">
      {closeError && (
        <p className="mb-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-bold leading-snug text-red-300 ring-1 ring-red-500/30">
          {closeError}
        </p>
      )}
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        size="lg"
        className="h-14 w-full rounded-2xl bg-gradient-orange-intense text-base font-bold text-black shadow-lg glow-orange disabled:opacity-100"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" strokeWidth={3} />
        ) : (
          <Lock className="size-5" strokeWidth={3} />
        )}
        {busy ? "Clôture..." : "Terminer la séance"}
      </Button>

      {/* La confirmation : la clôture engage la journée, pas de pouce distrait */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[116] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t-2 border-t-primary/40 bg-background px-6 pb-8 pt-6 sm:rounded-3xl sm:border-2 sm:border-primary/30"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
              Dernière vérification
            </p>
            <h2 className="mt-1 text-2xl tracking-tight">Clôturer la séance ?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              La clôture éveille tes Gardiens, prend le{" "}
              <strong className="text-foreground">jeton du jour</strong> — une
              seule clôture par jour — et remet le chapeau à zéro pour la
              prochaine récolte.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => setConfirmOpen(false)}
                variant="outline"
                className="h-12 flex-1 rounded-2xl border-border text-sm font-bold text-muted-foreground"
              >
                Pas encore
              </Button>
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  handleTerminate();
                }}
                className="h-12 flex-1 rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
              >
                <Lock className="size-4" strokeWidth={3} />
                Oui, clôture
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
