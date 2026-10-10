"use client";

import { useState } from "react";
import { Lock } from "@/components/icons";
import { BackButton } from "@/components/back-button";

// Le Manuel : tout le jeu, expliqué au même endroit. Pas de secret révélé —
// on explique les règles, jamais quelles cartes portent quoi.
//
// La pile de fonte : chaque chapitre est une plaque de la pile, frappée de
// son numéro. Pour lire une plaque, on plante la goupille dans son trou —
// la seule pièce de couleur de la page.

const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

// Un sous-titre gravé dans le texte d'un chapitre.
const Sub = ({ children }: { children: React.ReactNode }) => (
  <h4 className="font-heading text-[16px] font-bold uppercase leading-tight tracking-[0.05em] text-foreground">
    {children}
  </h4>
);

// Le trou de la plaque : vide quand elle est fermée, la goupille plantée
// dedans quand on la lit.
function Socket({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gap shadow-[inset_0_1px_2px_oklch(0_0_0/0.55),0_1px_0_var(--plate-edge)]"
    >
      {open ? (
        <span className="pin size-4" />
      ) : (
        <span className="size-2 rounded-full transition-colors group-hover:bg-steel-dark" />
      )}
    </span>
  );
}

function Chapter({
  n,
  title,
  tag,
  summary,
  children,
}: {
  n: number;
  title: string;
  tag?: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = `chapitre-${n}`;
  return (
    <div className="plate">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-texte`}
          aria-labelledby={`${id}-titre`}
          aria-describedby={tag ? `${id}-tag ${id}-resume` : `${id}-resume`}
          onClick={() => setOpen((v) => !v)}
          className={`card-hover group flex w-full items-center gap-3 py-2.5 pl-2 pr-3.5 text-left ${
            open ? "rounded-t" : "rounded"
          }`}
        >
          <span aria-hidden className="stamp size-11 shrink-0 text-[22px]">
            {String(n).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            {tag && (
              <span id={`${id}-tag`} className="etched mb-0.5 block font-sans">
                {tag}
              </span>
            )}
            <span id={`${id}-titre`} className="block text-[20px] leading-[1.1]">
              {title}
            </span>
            <span
              id={`${id}-resume`}
              className="mt-1 block font-sans text-[13px] font-normal leading-snug tracking-normal text-muted-foreground"
            >
              {summary}
            </span>
          </span>
          <Socket open={open} />
        </button>
      </h3>
      <div
        id={`${id}-texte`}
        hidden={!open}
        className="space-y-3 border-t-2 border-gap px-4 pb-4 pt-3.5 text-sm leading-relaxed text-muted-foreground"
      >
        {children}
      </div>
    </div>
  );
}

// Les chiffres d'une règle, frappés sur leurs étiquettes, dans le creux de
// la plaque.
function Figures({
  caption,
  items,
  cols,
}: {
  caption: string;
  items: [string, string][];
  cols: string;
}) {
  return (
    <figure className="rounded bg-background px-2.5 pb-3 pt-2.5 shadow-[inset_0_1px_2px_var(--plate-shade)]">
      <figcaption className="etched">{caption}</figcaption>
      <ul className={`mt-2.5 grid gap-x-1.5 gap-y-3 ${cols}`}>
        {items.map(([value, label]) => (
          <li key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span className="stamp h-9 w-full text-[20px]">{value}</span>
            <span className="text-[11px] font-semibold leading-tight text-muted-foreground">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Part({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-2.5 flex items-center gap-3">
        <h2 id={id} className="etched shrink-0 font-sans">
          {title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
        {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="plate-stack">{children}</div>
    </section>
  );
}

const LOOP = ["Séance", "Jeton", "Pack", "Gardien"];

const ORACLES = [
  "la frise de tous tes records",
  "le tonnage par muscle",
  "les machines que tu fuis",
  "toi contre toi d'il y a six mois",
  "le Hall des records",
  "l'export de tes données",
  "l'index du catalogue",
  "l'analyse par machine",
  "la carte céleste de ton année",
];

export default function ManuelPage() {
  return (
    <div className="min-h-dvh px-4 pb-16 pt-6">
      <BackButton fallback="/collection" />

      <header className="mb-6 mt-3">
        <p className="etched">Tout comprendre</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">Le Manuel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Toutes les règles du jeu, au même endroit. Les secrets, eux, restent
          des secrets.
        </p>
      </header>

      <div className="space-y-9">
        <Part id="partie-depart" title="Le départ" hint="Touche une plaque pour la lire">
          {/* La boucle : tout le jeu en quatre plaques, enfilées sur une tige. */}
          <div className="plate px-3 pb-3.5 pt-3">
            <p className="etched">La boucle du jeu</p>
            <div className="relative mt-3">
              <span
                aria-hidden
                className="absolute inset-x-[12.5%] top-[12px] h-[4px] rounded-full bg-[linear-gradient(180deg,var(--steel),var(--steel-dark))]"
              />
              <ol className="relative grid grid-cols-4">
                {LOOP.map((step) => (
                  <li key={step} className="flex flex-col items-center gap-2">
                    <span
                      aria-hidden
                      className="block h-7 w-3 rounded-[2px] bg-steel shadow-[inset_1px_0_0_var(--plate-edge),inset_-1px_0_0_var(--plate-shade),0_1px_0_var(--plate-shade)]"
                    />
                    <span className="font-heading text-[15px] font-bold uppercase leading-none tracking-[0.06em]">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Chaque séance clôturée rapporte un jeton ; le jeton ouvre un pack ;
              la carte tirée devient le Gardien d&apos;une machine. Entraîne-toi
              dessus : il s&apos;éveille et son pouvoir s&apos;applique.
            </p>
          </div>

          <Chapter
            n={1}
            title="Les jetons et les packs"
            summary="Une séance, un jeton ; un jeton, un pack."
          >
            <p>
              Chaque séance clôturée rapporte <B>1 jeton</B>. La 1ʳᵉ et la 4ᵉ
              séance de la semaine rapportent un <B>jeton spécial</B> à la place —
              il se joue à la roue de la fortune et se change en 1 à 4 jetons
              normaux.
            </p>
            <p>
              Un jeton ouvre un <B>pack</B>. L&apos;ouverture pioche un ticket dans
              un chapeau qui en contient 100 :
            </p>
            <Figures
              caption="Le chapeau · 100 tickets"
              cols="grid-cols-5"
              items={[
                ["64", "Basique"],
                ["15", "Animal"],
                ["15", "Pokémon"],
                ["5", "Premium"],
                ["1", "Mythique"],
              ]}
            />
            <p>
              Les packs mixtes (Basique, Premium, Mythique) tirent ensuite la
              famille de la carte : 75 % animal / 25 % pokémon en Basique.
            </p>
            <p>
              Un doublon devient un <B>fragment</B> de sa rareté. 3 fragments
              fusionnent en une carte de la rareté supérieure ; les fragments se
              convertissent aussi en jetons.
            </p>
          </Chapter>
        </Part>

        <Part id="partie-machines" title="Sur les machines">
          <Chapter
            n={2}
            title="Les Gardiens"
            summary="Une carte posée sur une machine, qui s'éveille quand tu t'y entraînes."
          >
            <ol className="space-y-2.5">
              {[
                <>
                  Pose une carte sur un exercice (sa fiche → <B>Mascotte</B>) :
                  elle devient son <B>Gardien</B> et décore le bloc en séance.
                </>,
                <>
                  Fais au moins une série sur cette machine puis clôture la
                  séance : le Gardien <B>s&apos;éveille</B>{" "}et son pouvoir
                  s&apos;applique. Une fois par séance, pas plus.
                </>,
                <>
                  L&apos;écran de clôture liste toute la récolte : qui s&apos;est
                  éveillé, ce que chacun a produit.
                </>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="stamp mt-0.5 size-6 shrink-0 text-[14px]">
                    {i + 1}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </Chapter>

          <Chapter
            n={3}
            title="Les métiers et la polarité"
            tag="Commun → épique"
            summary="Ce que fait chaque carte, et dans quel sens : Attractif ou Répulsif."
          >
            <p>
              Chaque carte du commun à l&apos;épique exerce un <B>métier</B>{" "}selon
              sa nature. Et c&apos;est toi qui choisis son sens sur la fiche :{" "}
              <B>Attractif</B> ou <B>Répulsif</B>, modifiable à volonté.
            </p>
            <Figures
              caption="La force du métier, selon la rareté"
              cols="grid-cols-4"
              items={[
                ["±1 %", "commun"],
                ["±2 %", "peu commun"],
                ["±4 %", "rare"],
                ["±6 %", "épique"],
              ]}
            />
            <dl className="divide-y-2 divide-gap">
              {[
                ["La Famille", "Attire ou dévore les tickets du pack de sa famille."],
                ["Le Lest", "Remplit le Basique, ou le dévore pour faire monter tout le reste."],
                ["L'Étincelle", "Sème 0,1 à 0,6 ticket Mythique par éveil, ou brûle du Basique."],
                [
                  "La Balance",
                  "Penche le 75/25 des packs mixtes vers les animaux ou les Pokémon (1 à 6 % par éveil).",
                ],
              ].map(([name, text]) => (
                <div key={name} className="py-2.5 first:pt-0 last:pb-0">
                  <dt className="font-heading text-[16px] font-bold uppercase leading-tight tracking-[0.05em] text-foreground">
                    {name}
                  </dt>
                  <dd className="mt-0.5">{text}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3 border-t-2 border-gap pt-3">
              <Sub>L&apos;Échappée, en cardio</Sub>
              <p>
                Sur une machine de cardio, chaque quart d&apos;heure{" "}
                <B>entamé</B> après le premier tire une carte au hasard dans ta
                réserve (tes cartes qui ne gardent aucune machine). À la clôture,
                tu places chacune en Attractif ou Répulsif : son éveil part dans
                le chapeau. Les légendaires et mythiques tirés pèsent leur rang :
                ±8 et ±13 tickets de leur famille.
              </p>
              <Figures
                caption="Cartes tirées, selon la durée"
                cols="grid-cols-3"
                items={[
                  ["1", "16 min"],
                  ["2", "31 min"],
                  ["4", "une heure"],
                ]}
              />
            </div>
          </Chapter>

          <Chapter
            n={4}
            title="Les Prodiges et les Miracles"
            tag="Légendaire et mythique"
            summary="Un pouvoir unique, écrit pour une seule carte."
          >
            <div className="space-y-1.5">
              <Sub>Légendaire · le Prodige</Sub>
              <p>
                Les <B>légendaires</B> ne comptent pas en tickets : chacun porte
                un <B>Prodige unique</B>, écrit pour lui seul — 70 légendaires,
                70 pouvoirs. Tickets Premium et Mythique, roue qui perd son ×1,
                pack qui refuse d&apos;être Basique, fragments offerts sur
                record… Le détail de chaque carte raconte son prodige.
              </p>
            </div>
            <div className="space-y-1.5 border-t-2 border-gap pt-3">
              <Sub>Mythique · le Miracle</Sub>
              <p>
                Les <B>mythiques</B> portent chacun un <B>Miracle unique</B>, un
                étage encore au-dessus : un jeton spécial offert chaque semaine,
                la roue qui monte à ×10, le chapeau qui échappe à la remise à
                zéro… Le détail de chaque carte raconte son pouvoir.
              </p>
            </div>
          </Chapter>

          <Chapter n={5} title="L'énergie" summary="Récoltée, consommée, remise à zéro.">
            <p>
              L&apos;énergie des éveils se <B>consomme</B> quand tu ouvres un
              pack ou tournes la roue — le chapeau revient ensuite à la normale.
              Ouvre ton pack <B>après la séance</B>{"\u00a0"}: c&apos;est le rythme du
              jeu.
            </p>
            <p>
              Car clôturer une nouvelle séance <B>remet le chapeau à zéro</B>{" "}
              avant la nouvelle récolte : l&apos;énergie de pack non dépensée est
              annulée. Seules les jauges d&apos;atelier (Forge, Curée,
              Orpailleur) survivent — et quelques cartes savent tricher avec le
              temps.
            </p>
          </Chapter>

          <Chapter
            n={6}
            title="Les records et le Gardien lié"
            summary="Les jours de record, et ce que coûte un Gardien qu'on veut délier."
          >
            <p>
              Un <B>record</B>{" "}— charge max ou volume, avec au moins 3 séances
              d&apos;historique — compte pour tes trophées, et certains Gardiens
              (la Banshee, le Sphinx, Marshadow, Victini…) n&apos;offrent leur
              pouvoir que ce jour-là.
            </p>
            <p>
              <Lock className="mr-1 inline size-3.5 -translate-y-px text-foreground" />
              Un Gardien posé est <B>lié</B> dès son premier éveil : pour changer
              sa carte, attends 30 jours… ou paie sa <B>magnésie</B>. Et un
              Gardien ne tient qu&apos;<B>un seul poste</B>{" "}— impossible de
              poser la même carte sur deux machines. Tant qu&apos;il ne
              s&apos;est pas éveillé, tu peux encore changer d&apos;avis
              librement.
            </p>
            <p>
              La <B>Magnésie</B>, c&apos;est la poudre qui délie. Environ une
              carte sur dix la porte — tirée au sort une fois pour toutes,
              visible sur sa fiche. Quand une porteuse s&apos;éveille, elle en
              dépose (1 à 8 selon son rang) en plus de son pouvoir. Délier
              coûte selon le Gardien libéré — le bouton vit sur la fiche de la
              machine, sous le verrou.
            </p>
            <Figures
              caption="Délier, en magnésie"
              cols="grid-cols-3 sm:grid-cols-6"
              items={[
                ["4", "commun"],
                ["6", "peu commun"],
                ["9", "rare"],
                ["12", "épique"],
                ["16", "légendaire"],
                ["20", "mythique"],
              ]}
            />
          </Chapter>
        </Part>

        <Part id="partie-deblocages" title="Ce qui se débloque">
          <Chapter
            n={7}
            title="Les Talents cachés et le Grimoire"
            summary="Des privilèges d'appli, cachés dans une cinquantaine de cartes."
          >
            <p>
              Une cinquantaine de cartes portent un <B>Talent caché</B>{"\u00a0"}: un
              privilège d&apos;appli — couleurs scellées, fonds d&apos;écran,
              pages de stats interdites, easter eggs. Posséder la carte suffit,
              pour toujours. Personne ne sait lesquelles avant de les tirer.
            </p>
            <p>
              Le <B>Grimoire</B> (depuis la Collection) compte tes découvertes et
              garde le reste en silhouettes. Les 30 mythiques portent tous une{" "}
              <B>aura</B> en plus de leur Miracle.
            </p>
          </Chapter>

          <Chapter
            n={8}
            title="Les Oracles"
            summary="Neuf savoirs à allumer, carte par carte."
          >
            <p>Neuf savoirs cachés dans certaines auras :</p>
            <ol className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {ORACLES.map((oracle, i) => (
                <li key={oracle} className="flex items-center gap-2.5">
                  <span aria-hidden className="stamp size-6 shrink-0 text-[14px]">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{oracle}</span>
                </li>
              ))}
            </ol>
            <p>
              Le temple est dans <B>Collection → Oracle</B>{" "}— il s&apos;allume
              carte par carte.
            </p>
          </Chapter>

          <Chapter
            n={9}
            title="Les Trophées et les titres"
            summary="Ce que l'entraînement débloque, et les titres à porter."
          >
            <p>
              <B>200 trophées</B>, gagnés à l&apos;entraînement, jamais au tirage :
              séances, records, tonnage, séries, charge max, cardio, régularité,
              variété, collection. La Salle des Trophées montre chaque jauge.
            </p>
            <p>
              Les grands paliers déverrouillent des morceaux d&apos;appli — le
              choix des couleurs, l&apos;Étendard, les courbes lissées, le bilan
              hebdo. Presque tous les autres offrent un <B>titre portable</B>,
              à afficher sous ton nom depuis les réglages.
            </p>
          </Chapter>
        </Part>
      </div>
    </div>
  );
}
