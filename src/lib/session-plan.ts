// Programme de séance pour un exercice de muscu.
//
// Toujours le même déroulé, pour ne rien inventer en salle :
//
//   1. échauffement  : environ 30 % de la charge de travail sur le premier
//                      exercice de la séance (rien n'est encore chaud), 50 %
//                      sur les suivants, 10 reps faciles
//   2. montée        : environ 70 %, 10 reps
//   3. 4. 5. travail : trois séries à la même charge, celles qui sont dures
//
//   ex. charge de travail 80 kg, premier exercice  ->  30 × 10 · 55 × 10 · 3 × 80 × 10
//       même charge, exercice suivant             ->  40 × 10 · 55 × 10 · 3 × 80 × 10
//
// Une série d'approche qui tomberait au-dessus de 80 % de la charge de travail
// (machine avec peu de paliers) passe à 5 reps, pour ne pas arriver fatigué.
//
// Progression : quand les trois séries de travail atteignent les reps cibles,
// la charge de travail monte d'un palier à la séance suivante. Sinon on garde
// la même charge et on cherche à gagner des reps.
//
// Tout est déduit des paliers de la machine et de la dernière séance faite, il
// n'y a rien à stocker.

export type PlanRole = "echauffement" | "montee" | "travail";

export interface PlanSet {
  weightKg: number;
  reps: number;
  role: PlanRole;
}

export interface SessionPlan {
  sets: PlanSet[];
  /** Charge des trois séries de travail. */
  workingWeight: number;
  /** La charge de travail a monté d'un palier par rapport à la dernière séance. */
  shifted: boolean;
  /**
   * Les trois séries de travail ont été bouclées au palier le plus haut connu :
   * il faut déclarer un palier au-dessus pour continuer à progresser.
   */
  atCeiling: boolean;
  /** Pas encore d'historique : la charge de travail est une proposition à ajuster. */
  firstTime: boolean;
}

export interface PlannedSet {
  weightKg: number;
  reps: number;
}

/** En dessous de 3 paliers connus, un programme n'a pas de sens. */
const MIN_STEPS = 3;
export const TARGET_REPS = 10;
const WORK_SETS = 3;
const FIRST_WARMUP_RATIO = 0.3;
const WARMUP_RATIO = 0.5;
const RAMP_RATIO = 0.7;
/** Au-dessus, une série d'approche est raccourcie. */
const HEAVY_RATIO = 0.8;

const same = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Palier le plus proche du poids donné. À égalité, on prend le plus léger. */
function nearestStepIndex(steps: number[], target: number): number {
  let best = 0;
  let bestGap = Math.abs(steps[0] - target);
  for (let i = 1; i < steps.length; i++) {
    const gap = Math.abs(steps[i] - target);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Charge de travail de la dernière séance.
 *
 * Au nouveau format, c'est la charge répétée sur les séries de travail. Sur une
 * ancienne séance en pyramide, la plus lourde n'a été faite qu'une fois, jusqu'à
 * l'échec : la reprendre pour trois séries serait trop lourd. On retient donc la
 * plus lourde des charges répétées ou tenues au moins `target - 2` reps, ce qui
 * ancre la transition sur une charge vraiment faisable.
 */
function previousWorkingWeight(previous: PlannedSet[], target: number): number {
  const counts = new Map<number, number>();
  for (const s of previous) counts.set(s.weightKg, (counts.get(s.weightKg) ?? 0) + 1);
  const solid = previous
    .filter((s) => (counts.get(s.weightKg) ?? 0) >= 2 || s.reps >= target - 2)
    .map((s) => s.weightKg);
  if (solid.length > 0) return Math.max(...solid);
  // Que des séries courtes : on ignore les singles pour qu'un test de force
  // isolé ne tire pas tout le programme vers le haut.
  const worked = previous.filter((s) => s.reps >= target / 2).map((s) => s.weightKg);
  return Math.max(...(worked.length > 0 ? worked : previous.map((s) => s.weightKg)));
}

/** Séries d'approche sous la charge de travail, prises parmi les paliers. */
function approachSets(
  below: number[],
  working: number,
  target: number,
  warmupRatio: number,
): PlanSet[] {
  const short = Math.max(3, Math.round(target / 2));
  const repsFor = (w: number) => (w > working * HEAVY_RATIO ? short : target);
  if (below.length === 0) return [];
  if (below.length === 1) {
    // Un seul palier dessous : un seul échauffement.
    return [{ weightKg: below[0], reps: repsFor(below[0]), role: "echauffement" }];
  }
  const ramp = below[nearestStepIndex(below, working * RAMP_RATIO)];
  const lighter = below.filter((w) => w < ramp);
  // La montée tombe déjà au plus bas : l'échauffement prend ce palier, la
  // montée le suivant.
  const [warm, up] =
    lighter.length === 0
      ? [below[0], below[1]]
      : [lighter[nearestStepIndex(lighter, working * warmupRatio)], ramp];
  return [
    { weightKg: warm, reps: repsFor(warm), role: "echauffement" },
    { weightKg: up, reps: repsFor(up), role: "montee" },
  ];
}

export interface PlanOptions {
  /** Reps visées par série : 20 sur les haltères (10 par bras), 10 ailleurs. */
  targetReps?: number;
  /** Premier exercice de muscu de la séance : échauffement plus léger. */
  firstOfSession?: boolean;
}

export function computeSessionPlan(
  knownWeights: number[],
  lastSets: PlannedSet[] | null | undefined,
  { targetReps = TARGET_REPS, firstOfSession = false }: PlanOptions = {},
): SessionPlan | null {
  const steps = [...new Set(knownWeights)].sort((a, b) => a - b);
  if (steps.length < MIN_STEPS) return null;

  const previous = lastSets && lastSets.length > 0 ? lastSets : null;

  let workIndex: number;
  let shifted = false;
  let atCeiling = false;

  if (previous === null) {
    // Première fois : troisième palier, au-dessus de deux paliers d'approche.
    workIndex = Math.min(2, steps.length - 1);
  } else {
    const prevWeight = previousWorkingWeight(previous, targetReps);
    const prevIndex = nearestStepIndex(steps, prevWeight);
    const workSets = previous.filter((s) => same(s.weightKg, prevWeight));
    const done =
      workSets.length >= WORK_SETS && workSets.every((s) => s.reps >= targetReps);
    workIndex = prevIndex;
    if (done) {
      if (prevIndex < steps.length - 1) {
        workIndex = prevIndex + 1;
        shifted = true;
      } else {
        atCeiling = true;
      }
    }
  }

  const working = steps[workIndex];
  const sets: PlanSet[] = [
    ...approachSets(
      steps.slice(0, workIndex),
      working,
      targetReps,
      firstOfSession ? FIRST_WARMUP_RATIO : WARMUP_RATIO,
    ),
    ...Array.from({ length: WORK_SETS }, () => ({
      weightKg: working,
      reps: targetReps,
      role: "travail" as const,
    })),
  ];

  return { sets, workingWeight: working, shifted, atCeiling, firstTime: previous === null };
}
