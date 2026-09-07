"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { storeRememberToken } from "@/lib/remember";
import { UserPlus } from "@/components/icons";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
      setError("Erreur lors de l'inscription");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tighter">
            ROAD TO{" "}
            <span className="text-gradient-orange">MASTOCK</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crée ton compte pour commencer
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Prénom
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton prénom"
              required
              className="h-12 bg-secondary/50 text-base font-medium"
            />
          </div>

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
              placeholder="6 caractères minimum"
              required
              minLength={6}
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
                <UserPlus className="size-5" />
                Créer mon compte
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-bold text-primary transition-colors hover:text-primary/80"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
