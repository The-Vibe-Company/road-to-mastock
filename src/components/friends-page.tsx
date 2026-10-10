"use client";

import { Spinner } from "@/components/spinner";
import { useState, useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Users, Check, X, Eye, Search, Clock, Trash2, Loader2 } from "@/components/icons";
import { BackButton } from "./back-button";
import { cn } from "@/lib/utils";

interface Friend {
  friendshipId: number;
  userId: number;
  name: string;
  email: string;
  title?: string | null;
  totemImage?: string | null;
  totemName?: string | null;
}

interface FriendsData {
  friends: Friend[];
  pendingReceived: Friend[];
  pendingSent: Friend[];
}

interface SearchResult {
  id: number;
  name: string;
  email: string;
}

// Le titre d'un bloc : gravé dans l'acier, le compte frappé à côté.
const BLOCK_TITLE =
  "flex items-center gap-2 font-heading text-[14px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

// Les goupilles d'action : rondes. La couleur du joueur pour ce qui fait
// avancer (ajouter, accepter), l'acier pour ce qui retire.
const PIN_ACTION = "size-10 rounded-full [&_svg:not([class*='size-'])]:size-4";
const PIN_RETIRE =
  "size-10 rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive [&_svg:not([class*='size-'])]:size-4";

function BlockTitle({ id, children, count }: { id: string; children: ReactNode; count?: number }) {
  return (
    <h2 id={id} className={BLOCK_TITLE}>
      {children}
      {count !== undefined && (
        <span className="stamp h-5 min-w-5 px-1.5 text-[13px] tracking-normal">{count}</span>
      )}
    </h2>
  );
}

// Le Totem de l'ami, posé sur l'étiquette noire ; à défaut, son initiale frappée.
function FriendMark({ name, image, imageAlt }: { name: string; image?: string | null; imageAlt?: string | null }) {
  return (
    <span className="stamp size-11 shrink-0 overflow-hidden text-[22px] uppercase">
      {image ? (
        <Image
          src={image}
          alt={imageAlt ?? ""}
          width={40}
          height={40}
          unoptimized
          className="size-10 object-contain"
        />
      ) : (
        <span aria-hidden>{name.trim().charAt(0) || "?"}</span>
      )}
    </span>
  );
}

export function FriendsPage() {
  const [data, setData] = useState<FriendsData>({ friends: [], pendingReceived: [], pendingSent: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // La dernière recherche revenue du serveur : pour ne dire « personne »
  // qu'une fois la réponse arrivée, pas pendant la frappe.
  const [searchedQuery, setSearchedQuery] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await fetch("/api/friends");
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(() => {
      setSearching(true);
      fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((r) => { setSearchResults(r); setSearchedQuery(searchQuery); setSearching(false); });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleAdd = async (email: string) => {
    const key = `add:${email}`;
    if (pendingAction) return;
    setPendingAction(key);
    setAddError("");
    setAddSuccess("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAddError(body.error);
      } else {
        setAddSuccess("Demande envoyée !");
        setAddEmail("");
        setSearchQuery("");
        setSearchResults([]);
        await refresh();
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleAccept = async (friendshipId: number) => {
    const key = `accept:${friendshipId}`;
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      await refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const handleDecline = async (friendshipId: number) => {
    const key = `decline:${friendshipId}`;
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      await refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemove = async (friendshipId: number) => {
    const key = `remove:${friendshipId}`;
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
      await refresh();
    } finally {
      setPendingAction(null);
    }
  };

  // Le prochain geste de la liste vide : remonter au champ de recherche.
  const focusSearch = () => {
    const el = searchRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  const noMatch =
    searchQuery.length >= 2 &&
    !searching &&
    searchedQuery === searchQuery &&
    Array.isArray(searchResults) &&
    searchResults.length === 0;

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-12 pt-6">
      <BackButton fallback="/" />
      <header className="mb-6 mt-3">
        <p className="etched">Le vestiaire</p>
        <h1 className="mt-1 text-4xl uppercase leading-none">Amis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ajoute tes potes de salle et suis leurs séances.
        </p>
      </header>

      {loading ? (
        <div className="flex flex-1 items-start justify-center pt-16">
          <Spinner label="Chargement…" />
        </div>
      ) : (
        <div className="space-y-7">
          {/* Les demandes reçues d'abord : ce sont elles qui attendent une réponse. */}
          {data.pendingReceived.length > 0 && (
            <section aria-labelledby="friends-received">
              <BlockTitle id="friends-received" count={data.pendingReceived.length}>
                <span aria-hidden className="pin size-2" />
                Demandes reçues
              </BlockTitle>
              <div className="plate-stack mt-2">
                {data.pendingReceived.map((f) => (
                  <div key={f.friendshipId} className="plate flex items-center gap-3 py-2 pl-2 pr-2">
                    <FriendMark name={f.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{f.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.email}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="icon"
                        onClick={() => handleAccept(f.friendshipId)}
                        disabled={pendingAction !== null}
                        aria-label={`Accepter la demande de ${f.name}`}
                        title="Accepter"
                        className={PIN_ACTION}
                      >
                        {pendingAction === `accept:${f.friendshipId}` ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Check />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDecline(f.friendshipId)}
                        disabled={pendingAction !== null}
                        aria-label={`Refuser la demande de ${f.name}`}
                        title="Refuser"
                        className={PIN_RETIRE}
                      >
                        {pendingAction === `decline:${f.friendshipId}` ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <X />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ajouter : la seule action de la page, en tête. */}
          <section aria-labelledby="friends-add">
            <BlockTitle id="friends-add">
              <UserPlus className="size-4" />
              Ajouter un ami
            </BlockTitle>
            <div className="plate-stack mt-2">
              <div className="plate p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom ou email d'un pote"
                    aria-label="Rechercher un ami par nom ou email"
                    autoComplete="off"
                    className="h-12 border-steel-dark pl-11 pr-11 text-base md:text-base"
                  />
                  {searching && (
                    <Loader2
                      aria-label="Recherche en cours"
                      className="absolute right-3.5 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
                    />
                  )}
                </div>
                <p className="mt-2 px-0.5 text-xs text-muted-foreground">
                  Dès deux lettres, les comptes qui correspondent apparaissent ici.
                </p>

                {noMatch && (
                  <p className="mt-3 px-0.5 text-sm text-muted-foreground">
                    Personne ne correspond à « {searchQuery} ». Essaie avec son email complet.
                  </p>
                )}
                {addError && (
                  <p role="alert" className="mt-3 px-0.5 text-sm font-semibold text-destructive">
                    {addError}
                  </p>
                )}
                {addSuccess && (
                  <p role="status" className="mt-3 flex items-center gap-2 px-0.5 text-sm font-semibold text-foreground">
                    <span aria-hidden className="pin size-2" />
                    {addSuccess}
                  </p>
                )}
              </div>

              {searchResults.length > 0 &&
                searchResults.map((user) => (
                  <div key={user.id} className="plate flex items-center gap-3 py-2 pl-2 pr-2">
                    <FriendMark name={user.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Button
                      size="icon"
                      onClick={() => handleAdd(user.email)}
                      disabled={pendingAction !== null}
                      aria-label={`Envoyer une demande à ${user.name}`}
                      title="Envoyer une demande"
                      className={PIN_ACTION}
                    >
                      {pendingAction === `add:${user.email}` ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <UserPlus />
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          </section>

          {/* Les demandes envoyées : en attente de l'autre. */}
          {data.pendingSent.length > 0 && (
            <section aria-labelledby="friends-sent">
              <BlockTitle id="friends-sent" count={data.pendingSent.length}>
                <Clock className="size-4" />
                Demandes envoyées
              </BlockTitle>
              <div className="plate-stack mt-2">
                {data.pendingSent.map((f) => (
                  <div key={f.friendshipId} className="plate flex items-center gap-3 py-2 pl-2 pr-2">
                    <FriendMark name={f.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{f.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.email} · en attente
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(f.friendshipId)}
                      disabled={pendingAction !== null}
                      aria-label={`Annuler la demande à ${f.name}`}
                      title="Annuler la demande"
                      className={PIN_RETIRE}
                    >
                      {pendingAction === `remove:${f.friendshipId}` ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <X />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Mes amis : une plaque par ami, son Totem frappé à gauche. */}
          <section aria-labelledby="friends-list">
            <BlockTitle id="friends-list" count={data.friends.length}>
              <Users className="size-4" />
              Mes amis
            </BlockTitle>

            {data.friends.length === 0 ? (
              <div className="plate-stack mt-2">
                <div className="plate px-4 py-5">
                  <div className="flex items-center gap-3">
                    <span className="stamp size-12 shrink-0">
                      <Users className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading text-xl font-bold uppercase leading-tight tracking-[0.04em]">
                        Aucun ami pour le moment
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Trois gestes pour monter ta bande.
                      </p>
                    </div>
                  </div>
                </div>
                {[
                  "Cherche un pote par son nom ou son email, dans le champ au-dessus.",
                  "Envoie-lui une demande : elle attend ici tant qu'il n'a pas répondu.",
                  "Dès qu'il accepte, ouvre son tableau de bord : séances, volume, charges.",
                ].map((step, i) => (
                  <div key={i} className="plate flex items-center gap-3 py-2 pl-2 pr-4">
                    <span className="stamp size-10 shrink-0 text-[22px]">{i + 1}</span>
                    <p className="text-sm leading-snug">{step}</p>
                  </div>
                ))}
                <div className="plate flex justify-center px-4 py-3">
                  <Button
                    variant="secondary"
                    onClick={focusSearch}
                    className="h-10 gap-2 rounded-full px-5 font-heading text-[15px] font-bold uppercase tracking-[0.06em]"
                  >
                    <Search />
                    Chercher un ami
                  </Button>
                </div>
              </div>
            ) : (
              <div className="plate-stack mt-2">
                {data.friends.map((f) => (
                  <div key={f.friendshipId} className="plate flex items-center gap-3 py-2 pl-2 pr-2">
                    <FriendMark name={f.name} image={f.totemImage} imageAlt={f.totemName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{f.name}</p>
                      {f.title ? (
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {f.title}
                        </p>
                      ) : (
                        <p className="truncate text-xs text-muted-foreground">{f.email}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link
                        href={`/friends/${f.userId}`}
                        aria-label={`Voir les stats de ${f.name}`}
                        className={cn(
                          buttonVariants({ variant: "secondary" }),
                          "h-10 gap-1.5 rounded-full px-3.5 font-heading text-[14px] font-bold uppercase tracking-[0.06em]",
                        )}
                      >
                        <Eye />
                        Stats
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(f.friendshipId)}
                        disabled={pendingAction !== null}
                        aria-label={`Retirer ${f.name} de tes amis`}
                        title="Retirer"
                        className={PIN_RETIRE}
                      >
                        {pendingAction === `remove:${f.friendshipId}` ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
