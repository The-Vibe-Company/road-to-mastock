/**
 * Contrôle de la logique de programme de séance (src/lib/session-plan.ts).
 *
 * Le repo n'a pas de harnais de test : ce script joue le même rôle pour la
 * seule partie vraiment subtile du calcul — séries d'approche, charge de
 * travail, progression d'un palier, plafond, et transition depuis les
 * anciennes séances en pyramide.
 *
 *   pnpm check:plan
 */
import { computeSessionPlan, type PlanOptions, type SessionPlan } from "../src/lib/session-plan";

type LoggedSet = { weightKg: number; reps: number };
const sets = (weights: number[], reps: number[]): LoggedSet[] =>
  weights.map((w, i) => ({ weightKg: w, reps: reps[i] }));
/** Séance au nouveau format : échauffement, montée, trois séries de travail. */
const session = (warm: number, ramp: number, work: number, workReps: number[]): LoggedSet[] => [
  { weightKg: warm, reps: 10 },
  { weightKg: ramp, reps: 5 },
  ...workReps.map((r) => ({ weightKg: work, reps: r })),
];

let failures = 0;

type Expected = Partial<Omit<SessionPlan, "sets">> & { plan?: string };
/** Le plan s'écrit « 32x10 45x5 59x10 59x10 59x10 » pour se lire d'un coup d'œil. */
const show = (p: SessionPlan) => p.sets.map((s) => `${s.weightKg}x${s.reps}`).join(" ");

function check(
  label: string,
  steps: number[],
  last: LoggedSet[] | null,
  expected: Expected | null,
  options?: PlanOptions,
) {
  const plan = computeSessionPlan(steps, last, options);
  const mismatch: string[] = [];

  if (expected === null) {
    if (plan !== null) mismatch.push("un plan a été produit alors qu'aucun n'était attendu");
  } else if (plan === null) {
    mismatch.push("aucun plan produit");
  } else {
    if (expected.plan && show(plan) !== expected.plan)
      mismatch.push(`plan ${show(plan)} au lieu de ${expected.plan}`);
    for (const key of ["workingWeight", "shifted", "atCeiling", "firstTime"] as const) {
      if (expected[key] !== undefined && plan[key] !== expected[key])
        mismatch.push(`${key} = ${plan[key]} au lieu de ${expected[key]}`);
    }
  }

  if (mismatch.length === 0) {
    console.log(`  ok   ${label}${plan ? `  (${show(plan)})` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
    for (const m of mismatch) console.log(`       ${m}`);
  }
}

const P = [32, 39, 45, 52, 59, 66, 73];

console.log("Programme de séance\n");

console.log(" déroulé");
check("sans historique : deux paliers d'approche, travail au troisième", P, null,
  { plan: "32x10 39x5 45x10 45x10 45x10", workingWeight: 45, firstTime: true, shifted: false });
check("échauffement vers 50 %, montée vers 70 %, 10 reps chacune", P,
  session(32, 45, 59, [9, 8, 8]),
  { plan: "32x10 39x10 59x10 59x10 59x10", workingWeight: 59, shifted: false, firstTime: false });
check("les trois séries de travail portent la même charge", P,
  session(39, 52, 73, [8, 8, 7]),
  { plan: "39x10 52x10 73x10 73x10 73x10" });

console.log("\n premier exercice de la séance");
const EX = [30, 40, 55, 65, 80, 90];
const at80 = sets([30, 55, 80, 80, 80], [10, 10, 9, 8, 8]);
check("premier exercice : l'exemple conseillé, 30 × 10, 55 × 10 puis 3 × 80 × 10", EX, at80,
  { plan: "30x10 55x10 80x10 80x10 80x10", workingWeight: 80 }, { firstOfSession: true });
check("exercice suivant, même charge : échauffement à 50 %", EX, at80,
  { plan: "40x10 55x10 80x10 80x10 80x10", workingWeight: 80 });
check("premier exercice : l'échauffement descend, la montée ne bouge pas", P,
  session(39, 52, 73, [8, 8, 7]), { plan: "32x10 52x10 73x10 73x10 73x10" }, { firstOfSession: true });

console.log("\n progression");
check("trois séries à 10 reps : la charge de travail monte d'un palier", P,
  session(32, 45, 59, [10, 10, 10]),
  { plan: "32x10 45x10 66x10 66x10 66x10", workingWeight: 66, shifted: true });
check("au-delà de 10 reps, séance bouclée aussi", P,
  session(32, 45, 59, [12, 11, 10]), { workingWeight: 66, shifted: true });
check("une seule série de travail sous la cible : on garde la charge", P,
  session(32, 45, 59, [10, 10, 9]), { workingWeight: 59, shifted: false });
check("juste après un palier, les reps chutent : on garde la nouvelle charge", P,
  session(32, 52, 66, [7, 6, 6]), { workingWeight: 66, shifted: false });

console.log("\n plafond");
check("bouclé au palier le plus haut : plafond annoncé, même charge", P,
  session(39, 59, 73, [10, 10, 10]),
  { workingWeight: 73, shifted: false, atCeiling: true });
check("au palier le plus haut sans boucler : pas de plafond", P,
  session(39, 59, 73, [9, 8, 8]), { workingWeight: 73, atCeiling: false });

console.log("\n transition depuis les anciennes pyramides");
// La plus lourde (59 × 6) n'a été faite qu'une fois, jusqu'à l'échec : on
// travaille à 52, tenu 8 reps.
check("pyramide montante : on travaille à la plus lourde tenue 8 reps", P,
  sets([32, 39, 45, 52, 59], [10, 10, 10, 8, 6]), { workingWeight: 52, shifted: false });
check("pyramide 1 2 5 4 3 : même règle", P,
  sets([32, 39, 59, 52, 45], [10, 10, 5, 7, 10]), { workingWeight: 45, shifted: false });
check("une charge répétée compte même sous 8 reps", P,
  sets([32, 52, 52, 52], [10, 7, 6, 6]), { workingWeight: 52 });

console.log("\n ancrage");
// 41 est entre 39 et 45, le plus proche est 39.
check("poids hors paliers : on ancre sur le plus proche", P,
  sets([41, 41, 41], [8, 8, 8]), { workingWeight: 39 });
check("un single de force isolé ne tire pas le programme vers le haut", P,
  sets([45, 52, 73], [10, 10, 1]), { workingWeight: 52 });
check("que des séries courtes : le single est ignoré", P,
  sets([52, 73], [5, 1]), { workingWeight: 52 });

console.log("\n peu de paliers sous la charge");
check("charge au premier palier : pas d'approche, trois séries de travail",
  [32, 39, 45], sets([32, 32, 32], [8, 8, 8]), { plan: "32x10 32x10 32x10" });
check("un seul palier dessous, au-dessus de 80 % : échauffement court",
  [50, 55, 60], sets([55, 55, 55], [8, 8, 8]), { plan: "50x5 55x10 55x10 55x10" });
check("deux paliers dessous, tous deux au-dessus de 80 % : approches courtes",
  [50, 55, 60, 65], sets([60, 60, 60], [8, 8, 8]), { plan: "50x5 55x5 60x10 60x10 60x10" });

console.log("\n haltères (20 reps notées = 10 par bras)");
check("la cible suit les reps de la machine", [8, 10, 12, 14, 16, 18],
  sets([8, 12, 16, 16, 16], [20, 10, 20, 20, 20]),
  { plan: "8x20 12x20 18x20 18x20 18x20", shifted: true }, { targetReps: 20 });
check("à 10 reps notées, une série d'haltères n'est pas bouclée", [8, 10, 12, 14, 16, 18],
  sets([8, 12, 16, 16, 16], [20, 10, 10, 10, 10]), { workingWeight: 16, shifted: false }, { targetReps: 20 });

console.log("\n garde-fous");
check("moins de trois paliers connus : pas de programme", [40, 50], null, null);
check("paliers en désordre ou dupliqués : triés et dédoublonnés",
  [45, 32, 39, 45, 52, 59], null, { plan: "32x10 39x5 45x10 45x10 45x10" });

// Séances bouclées à la suite : la charge doit monter d'un palier à chaque
// fois, puis se déclarer au plafond, jamais se figer en prétendant progresser.
console.log("\n progression sur plusieurs séances");
let current = computeSessionPlan(P, null)!;
const seen: string[] = [show(current)];
let simFailures = 0;
for (let i = 0; i < 6; i++) {
  const before = current;
  current = computeSessionPlan(P, current.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })))!;
  seen.push(`${show(current)}${current.shifted ? " +1" : ""}${current.atCeiling ? " [plafond]" : ""}`);
  if (current.workingWeight < before.workingWeight) {
    simFailures++;
    console.log(`  FAIL séance ${i + 2} : la charge de travail a baissé`);
  }
  if (!current.shifted && !current.atCeiling) {
    simFailures++;
    console.log(`  FAIL séance ${i + 2} : ni progression ni plafond annoncé`);
  }
}
failures += simFailures;
if (simFailures === 0) console.log(`  ok   la charge monte d'un palier par séance bouclée, puis plafonne`);
for (const s of seen) console.log(`         ${s}`);

if (failures > 0) {
  console.error(`\n${failures} contrôle(s) en échec`);
  process.exit(1);
}
console.log("\nTous les contrôles passent.");
