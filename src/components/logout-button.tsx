"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "@/components/icons";

export function LogoutButton({ labeled = false }: { labeled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    if (pending) return;
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // La version des Réglages : une ligne pleine largeur qui dit son nom.
  if (labeled) {
    return (
      <button
        onClick={handleLogout}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-secondary/30 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground ring-1 ring-border transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        Déconnexion
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
