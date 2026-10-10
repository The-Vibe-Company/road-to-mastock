"use client";

import { Spinner } from "@/components/spinner";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Key, Lock, Package } from "@/components/icons";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { RARITY_COLORS, RARITY_LABELS, type Rarity } from "@/lib/rarities";
import { TalentDescription } from "@/components/talent-description";

// Le Grimoire : la collection dans la collection. Les talents découverts
// s'illuminent ; les autres restent des silhouettes — aucun indice sur la
// carte qui les porte.
//
// Dans la pile : chaque talent est une plaque de la jauge. Les plaques
// éveillées prennent la couleur de la charge, les scellées restent dans le
// jour sombre. Les talents éveillés sont rangés par famille, chacun sur sa
// plaque ; le reste tient dans une seule plaque scellée, avec la goupille
// qui mène aux packs.

interface DiscoveredTalent {
  id: string;
  family: "parure" | "trone" | "oracle" | "relique" | "etendard";
  name: string;
  description: string;
  // La carte porteuse — révélée dès qu'on la possède.
  card?: {
    category: "animal" | "pokemon";
    name: string;
    rarity: string;
    imageUrl: string | null;
  };
}

interface GrimoireData {
  total: number;
  discovered: DiscoveredTalent[];
}

const FAMILY_ORDER: DiscoveredTalent["family"][] = [
  "parure",
  "trone",
  "oracle",
  "relique",
  "etendard",
];

const FAMILY_LABELS: Record<DiscoveredTalent["family"], string> = {
  parure: "Parure",
  trone: "Trône",
  oracle: "Oracle",
  relique: "Relique",
  etendard: "Étendard",
};

export default function GrimoirePage() {
  const [data, setData] = useState<GrimoireData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/talents", { cache: "no-store" })
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

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Ouverture du Grimoire" />
      </div>
    );
  }

  if (!data) {
    // Le fetch a échoué : une porte de sortie plutôt qu'une page morte.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Le Grimoire ne répond pas. Vérifie ta connexion, puis réessaie.
        </p>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => window.location.reload()}
          className="h-11 px-5"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  const found = data.discovered.length;
  const unknownCount = Math.max(0, data.total - found);
  const slots = Math.max(data.total, found);
  const families = FAMILY_ORDER.map((family) => ({
    family,
    talents: data.discovered.filter((t) => t.family === family),
  })).filter((g) => g.talents.length > 0);

  return (
    <div className="min-h-dvh px-4 pb-12 pt-6">
      <BackButton fallback="/collection" />

      <header className="mb-6 mt-3">
        <p className="etched">Secrets</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">Grimoire</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Certaines cartes cachent un talent — un privilège qui s&apos;éveille dès
          qu&apos;elles rejoignent ta collection. Personne ne sait lesquelles.
        </p>
      </header>

      {/* La jauge : une plaque par talent. Éveillés à la couleur de la
          charge, scellés dans le jour sombre de la pile. */}
      <section aria-labelledby="grimoire-count" className="plate mb-6 px-4 pb-4 pt-3.5">
        <div className="flex items-end justify-between gap-3">
          <h2 id="grimoire-count" className="etched font-sans">
            Talents découverts
          </h2>
          <p className="flex items-baseline gap-1.5">
            <span className="stamp h-9 min-w-10 px-2 text-[26px]">{found}</span>
            <span className="font-heading text-[22px] font-bold leading-none tabular-nums text-muted-foreground">
              / {data.total}
            </span>
          </p>
        </div>
        <div
          role="img"
          aria-label={`${found} talent${found > 1 ? "s" : ""} découvert${found > 1 ? "s" : ""} sur ${data.total}`}
          className="mt-3 flex h-6 gap-[2px] rounded-[2px] bg-gap p-[2px]"
        >
          {Array.from({ length: slots }, (_, i) => (
            <span
              key={i}
              className={`min-w-0 flex-1 rounded-[1px] ${
                i < found ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
        {unknownCount === 0 && (
          <p className="mt-3 text-sm font-semibold">
            Le Grimoire est complet : tous les talents sont éveillés.
          </p>
        )}
      </section>

      {/* Les talents éveillés, rangés par famille : chaque talent sur sa
          plaque, avec la carte qui le porte. */}
      {families.map(({ family, talents }) => (
        <section key={family} aria-labelledby={`famille-${family}`} className="mb-6">
          <h2
            id={`famille-${family}`}
            className="etched mb-2 flex items-center gap-2 font-sans"
          >
            {FAMILY_LABELS[family]}
            <span className="stamp h-5 min-w-5 px-1 text-[13px] tracking-normal">
              {talents.length}
            </span>
          </h2>
          <div className="plate-stack">
            {talents.map((t) => {
              const rarity = t.card?.rarity as Rarity | undefined;
              const tint = rarity ? RARITY_COLORS[rarity] : undefined;
              return (
                <article key={t.id} className="plate px-3 py-3">
                  <div className="flex items-center gap-3">
                    {/* La carte responsable, en chair et en os */}
                    {t.card?.imageUrl ? (
                      <div
                        className={`relative size-12 shrink-0 overflow-hidden rounded-[3px] ring-2 ${tint?.bg ?? "bg-secondary"} ${tint?.ring ?? "ring-border"}`}
                      >
                        <Image
                          src={t.card.imageUrl}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <span className="stamp size-12 shrink-0">
                        <Key className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[19px] uppercase leading-tight tracking-[0.03em]">
                        {t.name}
                      </h3>
                      {t.card && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {t.card.name}
                          </span>
                          {rarity && RARITY_LABELS[rarity] && (
                            <> · {RARITY_LABELS[rarity]}</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <TalentDescription
                    text={t.description}
                    className="mt-2.5 text-[13px] leading-relaxed text-secondary-foreground"
                  />
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {/* Le reste : une seule plaque scellée, et la goupille vers les packs —
          c'est en tirant des cartes qu'un talent s'éveille. */}
      {unknownCount > 0 && (
        <section aria-labelledby="grimoire-sealed" className="plate px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="stamp size-12 shrink-0 flex-col gap-1">
              <Lock className="size-3.5 text-steel" />
              <span className="text-[20px] leading-none">{unknownCount}</span>
            </span>
            <div className="min-w-0">
              <h2
                id="grimoire-sealed"
                className="text-[21px] uppercase leading-tight tracking-[0.03em]"
              >
                {unknownCount > 1 ? "Talents scellés" : "Talent scellé"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {found === 0 ? "Aucun talent éveillé pour l'instant. " : ""}
                Couleurs scellées, fonds d&apos;écran, pages de stats interdites,
                easter eggs : chacun dort dans une carte que tu n&apos;as pas
                encore, sans le moindre indice. Il s&apos;éveille le jour où elle
                rejoint ta collection, pour toujours.
              </p>
            </div>
          </div>
          <Link
            href="/collection"
            className="bg-gradient-orange-intense mt-4 inline-flex h-12 items-center gap-3 rounded-full pl-1.5 pr-6 font-heading text-[17px] font-bold uppercase tracking-[0.06em]"
          >
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/15 shadow-[inset_0_2px_3px_oklch(0_0_0/0.3),0_1px_0_oklch(1_0_0/0.25)]"
            >
              <Package className="size-[18px]" />
            </span>
            Ouvrir des packs
          </Link>
        </section>
      )}
    </div>
  );
}
