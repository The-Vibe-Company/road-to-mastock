import Link from "next/link";
import { ChevronRight, Weight, Trophy } from "@/components/icons";

interface SessionCardProps {
  id: number;
  date: string;
  exerciseCount: number;
  totalVolume: number;
  gold: number;
  silver: number;
  bronze: number;
}

// Une séance = une plaque de la pile. Sur sa tranche gauche, la date est
// frappée comme le chiffre d'une plaque : le jour en gros, le mois dessous.
export function SessionCard({ id, date, exerciseCount, totalVolume, gold, silver, bronze }: SessionCardProps) {
  const d = new Date(date);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "long" });
  const day = d.toLocaleDateString("fr-FR", { day: "numeric" });
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  const formatted = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Link
      href={`/sessions/${id}`}
      aria-label={`Séance du ${formatted}`}
      className="plate card-hover group flex items-center gap-3 py-2 pl-2 pr-3"
    >
      <span className="stamp h-12 w-14 shrink-0 flex-col gap-1">
        <span className="text-[24px] leading-none">{day}</span>
        <span className="font-sans text-[9px] font-semibold uppercase leading-none tracking-[0.12em] opacity-75">
          {month}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-[19px] font-bold uppercase leading-tight tracking-[0.03em]">
          {weekday}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{exerciseCount} exercice{exerciseCount !== 1 ? "s" : ""}</span>
          {totalVolume > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Weight className="size-3 text-steel" />
              {totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}t`
                : `${totalVolume} kg`}
            </span>
          )}
          {(gold > 0 || silver > 0 || bronze > 0) && (
            <span className="flex items-center gap-1.5">
              {gold > 0 && (
                <span className="flex items-center gap-0.5 font-bold text-yellow-400">
                  <Trophy className="size-3" />{gold}
                </span>
              )}
              {silver > 0 && (
                <span className="flex items-center gap-0.5 font-bold text-zinc-300">
                  <Trophy className="size-3" />{silver}
                </span>
              )}
              {bronze > 0 && (
                <span className="flex items-center gap-0.5 font-bold text-amber-600">
                  <Trophy className="size-3" />{bronze}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
