"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@/components/icons";

export function BackButton({
  fallback = "/",
  label = "Retour",
  className = "",
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  // `window.history.length` ne dit PAS s'il existe une page précédente dans
  // l'app : il compte tout l'onglet, y compris ce qui précède l'app, et ne
  // décroît jamais. On y lisait « il y a un précédent » puis router.back()
  // retombait sur une page qui redirige aussitôt en avant (le middleware
  // d'auth) : on revenait au même endroit, le bouton semblait mort.
  //
  // On tente donc le retour, et on vérifie qu'il a bougé. S'il n'a rien
  // changé, on prend le fallback explicite de la page.
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const from = window.location.pathname;
    router.back();
    window.setTimeout(() => {
      if (window.location.pathname === from) router.push(fallback);
    }, 400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`-ml-2 mb-4 inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-bold text-muted-foreground transition-all hover:bg-accent hover:text-primary active:scale-95 ${className}`}
    >
      <ArrowLeft className="size-5" strokeWidth={2.5} />
      {label}
    </button>
  );
}
