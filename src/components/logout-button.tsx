"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "@/components/icons";
import { clearRememberToken } from "@/lib/remember";

export function LogoutButton({ labeled = false }: { labeled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    if (pending) return;
    setPending(true);
    clearRememberToken();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // La version des Réglages : la dernière plaque de la pile, qui dit son
  // nom. L'étiquette rougit au survol, le texte reste lisible.
  if (labeled) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="plate card-hover group flex w-full items-center gap-3 py-2 pl-2 pr-3 text-left disabled:opacity-70"
      >
        <span className="stamp size-10 shrink-0 transition-colors group-hover:text-destructive">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-[17px] font-bold uppercase leading-tight tracking-[0.04em]">
            Déconnexion
          </span>
          <span className="block text-xs text-muted-foreground">
            {pending ? "Sortie en cours…" : "Quitter ton compte sur cet appareil"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLogout}
      disabled={pending}
      className="size-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
    </Button>
  );
}
