"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "@/components/icons";

// La goupille : le seul objet rond et coloré de l'écran. La tête ronde
// porte le +, le corps porte le mot — on la tire pour lancer la séance.
export function NewSessionButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() => {
        if (pending) return;
        setPending(true);
        router.push("/sessions/new");
      }}
      className="h-14 gap-3 rounded-full bg-gradient-orange-intense pl-2 pr-7 font-heading text-[19px] font-bold uppercase tracking-[0.06em] text-primary-foreground glow-orange disabled:opacity-100"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/15 shadow-[inset_0_2px_3px_oklch(0_0_0/0.3),0_1px_0_oklch(1_0_0/0.25)]"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" strokeWidth={3} />
        ) : (
          <Plus className="size-5" strokeWidth={3} />
        )}
      </span>
      {pending ? "Création..." : "Nouvelle séance"}
    </Button>
  );
}
