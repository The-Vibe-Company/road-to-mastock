"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Cards, Shield, Sparkles, X } from "@/components/icons";

const SEEN_KEY = "rtm-announce-skins-v1";

interface GiftSkin {
  level: number;
  name: string;
  imageUrl: string | null;
  cardName: string;
}

// L'annonce de la feature Skins : montrée une fois par appareil, à la
// première reconnexion après le déploiement — avec un skin niveau 1
// offert (une fois par joueur, côté serveur) sur une carte possédée.
export function SkinsAnnouncement() {
  const [open, setOpen] = useState(false);
  const [gift, setGift] = useState<GiftSkin | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem(SEEN_KEY));
    } catch {
      // stockage indisponible : pas d'annonce plutôt qu'une annonce en boucle
      seen = true;
    }
    if (seen) return;
    setOpen(true);
    // Le cadeau de bienvenue — le serveur garantit l'unicité par joueur.
    fetch("/api/cards/skin-gift", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.granted && d.skin) setGift(d.skin);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
      <div className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t-2 border-t-primary/40 bg-background sm:rounded-3xl sm:border-2 sm:border-primary/30">
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground transition-colors hover:text-primary"
        >
          <X className="size-4" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-8">
          <p className="text-center font-mono text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">
            Nouveauté
          </p>
          <h2 className="mt-1 text-center text-3xl font-black tracking-tighter">
            Les <span className="text-gradient-orange">Skins</span>
          </h2>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Chaque carte a désormais 5 tenues à collectionner.
          </p>

          {gift && (
            <div className="animate-card-reveal mt-5 rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/40">
              <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                🎁 Ton premier skin est offert
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                {gift.imageUrl && (
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-primary/40 bg-black/40">
                    <Image src={gift.imageUrl} alt="" fill unoptimized className="object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black tracking-tight">« {gift.name} »</p>
                  <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                    pour {gift.cardName} · niveau 1
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Déjà dans sa garde-robe — équipe-le !
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-secondary/30 p-3 ring-1 ring-border">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Cards className="size-4" />
              </span>
              <div>
                <p className="text-sm font-black tracking-tight">3 skins par pack</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  À chaque ouverture, 3 skins tombent avant ta carte — niveau 1
                  (fréquent) à 5 (une ouverture sur vingt).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-secondary/30 p-3 ring-1 ring-border">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-black tracking-tight">Des skins mystère</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Un skin d&apos;une carte que tu n&apos;as pas encore reste secret —
                  il se révèle le jour où tu tires sa carte, et t&apos;attend dans
                  ta réserve (Collection).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-secondary/30 p-3 ring-1 ring-border">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                <Shield className="size-4" />
              </span>
              <div>
                <p className="text-sm font-black tracking-tight">Équipe, et gagne</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Habille tes cartes dans leur garde-robe. Porté par un Gardien
                  qui s&apos;éveille, un beau skin améliore la rareté de tes packs
                  jusqu&apos;à ta prochaine séance.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 px-6 py-4">
          <Link
            href="/collection"
            onClick={dismiss}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-orange-intense text-sm font-black uppercase tracking-wider text-black"
          >
            Ouvrir un pack
          </Link>
          <button
            onClick={dismiss}
            className="mt-2 w-full py-2 text-center text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
