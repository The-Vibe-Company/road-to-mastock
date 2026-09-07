"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn } from "@/components/icons";
import { clearRememberToken, readRememberToken, storeRememberToken } from "@/lib/remember";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // La reconnexion silencieuse : tant qu'elle court, pas de formulaire.
  const [resuming, setResuming] = useState(true);

  // iOS (web-app épinglée) perd parfois le cookie au kill de l'appli : si
  // un jeton de rappel vit en localStorage, on ré-ouvre la session sans
  // rien demander — l'écran de connexion ne se montre qu'en dernier recours.
  useEffect(() => {
    const token = readRememberToken();
    if (!token) {
      // En microtâche : jamais de setState synchrone dans un effet.
      queueMicrotask(() => setResuming(false));
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          const data = await res.json();
          storeRememberToken(data.rememberToken);
          router.replace("/");
          return;
        }
        clearRememberToken();
      } catch {
        // réseau : on laisse le formulaire prendre le relais
      }
      setResuming(false);
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      storeRememberToken(data.rememberToken);
      router.push("/");
    } catch {
      setError("Erreur de connexion");
      setLoading(false);
    }
  };

  if (resuming) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Reconnexion...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tighter">
            ROAD TO{" "}
            <span className="text-gradient-orange">MASTOCK</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connecte-toi pour continuer
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              className="h-12 bg-secondary/50 text-base font-medium"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Mot de passe
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-12 bg-secondary/50 text-base font-medium"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-gradient-orange-intense text-base font-bold text-black shadow-lg glow-orange-sm"
          >
            {loading ? (
              <div className="size-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            ) : (
              <>
                <LogIn className="size-5" />
                Se connecter
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-bold text-primary transition-colors hover:text-primary/80"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
