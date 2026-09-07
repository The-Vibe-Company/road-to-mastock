"use client";

import { Spinner } from "@/components/spinner";
import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, HelpCircle, Key } from "@/components/icons";
import { BackButton } from "@/components/back-button";
import { RARITY_COLORS, type Rarity } from "@/lib/rarities";
import { TalentDescription } from "@/components/talent-description";

// Le Grimoire : la collection dans la collection. Les talents découverts
// s'illuminent ; les autres restent des silhouettes — aucun indice sur la
// carte qui les porte.

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

const FAMILY_LABELS: Record<DiscoveredTalent["family"], string> = {
  parure: "Parure",
  trone: "Trône",
  oracle: "Oracle",
  relique: "Relique",
  etendard: "Étendard",
};

const FAMILY_COLORS: Record<DiscoveredTalent["family"], string> = {
  parure: "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/40",
  trone: "text-sky-300 bg-sky-500/10 ring-sky-500/40",
  oracle: "text-violet-300 bg-violet-500/10 ring-violet-500/40",
  relique: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/40",
  etendard: "text-amber-300 bg-amber-500/10 ring-amber-500/40",
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
        <Spinner />
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
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-secondary/60 px-4 py-2.5 text-sm font-bold text-primary ring-1 ring-border"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const unknownCount = Math.max(0, data.total - data.discovered.length);

  return (
    <div className="min-h-dvh px-4 pb-12 pt-6">
      <BackButton fallback="/collection" />

      <header className="mb-6 mt-3">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
          Secrets
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tighter">Grimoire</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Certaines cartes cachent un talent — un privilège qui s&apos;éveille dès
          qu&apos;elles rejoignent ta collection. Personne ne sait lesquelles.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-secondary/30 px-4 py-3 ring-1 ring-border">
        <BookOpen className="size-5 text-primary" />
        <p className="text-sm font-bold">
          Talents découverts :{" "}
          <span className="font-mono tabular-nums text-primary">
            {data.discovered.length}
          </span>
          <span className="text-muted-foreground"> / {data.total}</span>
        </p>
      </div>

      {data.discovered.length > 0 && (
        <div className="mb-8 space-y-2.5">
          {data.discovered.map((t) => (
            <div
              key={t.id}
              className={`rounded-2xl px-4 py-3 ring-1 ${FAMILY_COLORS[t.family]}`}
            >
              <div className="flex items-center gap-3">
                {/* La carte responsable, en chair et en os */}
                {t.card?.imageUrl ? (
                  <div className={`relative size-11 shrink-0 overflow-hidden rounded-lg ${RARITY_COLORS[t.card.rarity as Rarity]?.bg ?? "bg-secondary/40"} ring-1 ${RARITY_COLORS[t.card.rarity as Rarity]?.ring ?? "ring-border"}`}>
                    <Image src={t.card.imageUrl} alt="" fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <Key className="size-3.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black tracking-tight">{t.name}</p>
                  {t.card && (
                    <p className={`truncate text-[11px] font-bold ${RARITY_COLORS[t.card.rarity as Rarity]?.text ?? "text-muted-foreground"}`}>
                      {t.card.name}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-md bg-black/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest opacity-80">
                  {FAMILY_LABELS[t.family]}
                </span>
              </div>
              <TalentDescription
                text={t.description}
                className="mt-2 text-xs leading-relaxed text-foreground/80"
              />
            </div>
          ))}
        </div>
      )}

      {unknownCount > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: unknownCount }, (_, i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-xl bg-secondary/20 ring-1 ring-border/50"
            >
              <HelpCircle className="size-5 text-muted-foreground/30" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
