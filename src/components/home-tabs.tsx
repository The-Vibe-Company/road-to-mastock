"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SessionCard } from "./session-card";
import { Dashboard } from "./dashboard";
import { ExerciseRanking } from "./exercise-ranking";
import { Dumbbell } from "@/components/icons";

interface Session {
  id: number;
  date: string;
  exerciseCount: number;
  totalVolume: number;
  gold: number;
  silver: number;
  bronze: number;
}

type Tab = "dashboard" | "sessions" | "exercises";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sessions", label: "Séances" },
  { id: "exercises", label: "Exercices" },
];

export function HomeTabs({ sessions }: { sessions: Session[] }) {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("tab");
  const initial: Tab =
    fromUrl === "sessions" || fromUrl === "exercises" ? fromUrl : "dashboard";
  const [tab, setTab] = useState<Tab>(initial);

  const switchTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "dashboard" ? "/" : `/?tab=${t}`);
  };

  return (
    <>
      {/* Les onglets : trois plaques dans leur glissière — celle qu'on a
          choisie sort de la glissière et porte la goupille. */}
      <div role="tablist" aria-label="Vue" className="mb-5 grid grid-cols-3 gap-[3px] rounded-lg bg-gap p-[3px]">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.id)}
              className={`flex h-11 items-center justify-center gap-2 rounded-[3px] font-heading text-[16px] font-bold uppercase tracking-[0.06em] transition-colors ${
                active
                  ? "plate text-foreground"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              {active && <span aria-hidden className="pin size-2" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className={tab === "dashboard" ? "" : "hidden"}>
        <Dashboard />
      </div>
      {tab === "sessions" && (
        sessions.length === 0 ? (
          <div className="plate flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="stamp size-14">
              <Dumbbell className="size-7" />
            </span>
            <div>
              <p className="font-heading text-xl font-bold uppercase tracking-[0.04em]">Aucune séance</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Commence ta première séance avec le bouton en bas de l&apos;écran.
              </p>
            </div>
          </div>
        ) : (
          <div className="plate-stack">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                id={s.id}
                date={s.date}
                exerciseCount={s.exerciseCount}
                totalVolume={s.totalVolume}
                gold={s.gold}
                silver={s.silver}
                bronze={s.bronze}
              />
            ))}
          </div>
        )
      )}
      {tab === "exercises" && <ExerciseRanking />}
    </>
  );
}
