"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Cards, Gift, Shield, Sparkles, X } from "@/components/icons";

// v2 : la v1 (sans le cadeau) a été vue par les premiers connectés — on
// remontre l'annonce une fois pour que le cadeau arrive à tout le monde.
const SEEN_KEY = "rtm-announce-skins-v2";

// Les Skins passent en tête de la tournée des annonces : tant qu'elle est
// ouverte, les autres annonces de l'accueil attendent leur tour au lieu de
// s'empiler dessous. « rtm:skins-done » leur passe la main.
const SKINS_DONE_EVENT = "rtm:skins-done";

// L'annonce reste à voir sur cet appareil : même règle que celle qui l'ouvre.
function skinsPending(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    // stockage indisponible : l'annonce ne s'ouvre pas, rien à attendre
    return false;
  }
}

// Vrai quand l'annonce des Skins ne bloque plus : déjà vue, ou fermée à
// l'instant sur cet écran. Les autres annonces ne montent qu'à ce moment.
export function useSkinsSettled(): boolean {
  const [settled, setSettled] = useState(() => !skinsPending());
  useEffect(() => {
    if (settled) return;
    const onDone = () => setSettled(true);
    window.addEventListener(SKINS_DONE_EVENT, onDone);
    return () => window.removeEventListener(SKINS_DONE_EVENT, onDone);
  }, [settled]);
  return settled;
}

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

  // `next` : passer la main à l'annonce suivante. Pas quand on part ouvrir
  // un pack — elle attendra le retour sur l'accueil plutôt que de clignoter
  // pendant la navigation.
  const dismiss = (next = true) => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setOpen(false);
    if (next) window.dispatchEvent(new Event(SKINS_DONE_EVENT));
  };

  if (!open) return null;

  return (
    <div className="scrim fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="skins-announce-title"
        className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-background shadow-[inset_0_1px_0_var(--plate-edge),0_-24px_60px_-20px_oklch(0_0_0/0.8)] sm:rounded-xl"
      >
        <button
          onClick={() => dismiss()}
          aria-label="Fermer"
          className="plate absolute right-3 top-3 z-10 flex size-9 items-center justify-center text-muted-foreground transition-colors hover:bg-plate-hover hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-7">
          <p className="flex items-center gap-2 font-heading text-[13px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
            <span aria-hidden className="pin size-2" />
            Collection
          </p>
          <h2
            id="skins-announce-title"
            className="mt-2 text-[2.6rem] font-extrabold uppercase leading-[0.9] tracking-[-0.005em]"
          >
            Les Skins
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Chaque carte a 5 skins à collectionner.
          </p>

          {gift && (
            <div className="animate-card-reveal plate mt-5 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                <Gift className="size-3.5" />
                Ton premier skin est offert
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                {gift.imageUrl && (
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-gap">
                    <Image src={gift.imageUrl} alt="" fill unoptimized className="object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-heading text-lg font-bold">« {gift.name} »</p>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                    pour {gift.cardName} · niveau 1
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Déjà sur la fiche de la carte — équipe-le&nbsp;!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Les trois règles : une pile de trois plaques, le chiffre frappé
              sur la tranche. */}
          <ol className="plate-stack mt-5">
            {[
              {
                Icon: Cards,
                tint: "text-steel",
                title: "3 skins par pack",
                body: (
                  <>
                    À chaque ouverture, 3 skins tombent avant ta carte — niveau 1
                    (fréquent) à 5 (une ouverture sur vingt).
                  </>
                ),
              },
              {
                Icon: Sparkles,
                tint: "text-violet-300",
                title: "Des skins mystère",
                body: (
                  <>
                    Un skin d&apos;une carte que tu n&apos;as pas encore reste secret —
                    il se révèle le jour où tu tires sa carte, et t&apos;attend dans
                    ta réserve (Collection).
                  </>
                ),
              },
              {
                Icon: Shield,
                tint: "text-amber-300",
                title: "Équipe, et gagne",
                body: (
                  <>
                    Équipe un skin depuis la fiche de sa carte, dans Collection.
                    Porté par un Gardien qui s&apos;éveille, un beau skin améliore la
                    rareté de tes packs jusqu&apos;à ta prochaine séance.
                  </>
                ),
              },
            ].map(({ Icon, tint, title, body }, i) => (
              <li key={title} className="plate flex items-start gap-3 py-3 pl-2 pr-3">
                <span className="stamp h-9 w-9 shrink-0 text-[20px]">{i + 1}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <Icon className={`size-3.5 shrink-0 ${tint}`} />
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-gap px-5 pb-5 pt-4">
          <Link
            href="/collection"
            onClick={() => dismiss(false)}
            className="bg-gradient-orange-intense flex h-12 w-full items-center justify-center rounded-lg font-heading text-[18px] font-bold uppercase tracking-[0.08em]"
          >
            Ouvrir un pack
          </Link>
          {/* La sortie, à voir du premier coup d'œil : une plaque sous la
              goupille, pas un texte gris. */}
          <button
            onClick={() => dismiss()}
            className="plate card-hover mt-2 flex h-11 w-full items-center justify-center font-heading text-[16px] font-bold uppercase tracking-[0.08em] text-foreground"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
