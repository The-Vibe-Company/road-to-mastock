"use client";

import { Spinner } from "@/components/spinner";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, Check, X, Eye, Search, Clock, Trash2, Loader2 } from "@/components/icons";
import { BackButton } from "./back-button";

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

export function FriendsPage() {
  const [data, setData] = useState<FriendsData>({ friends: [], pendingReceived: [], pendingSent: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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
        .then((r) => { setSearchResults(r); setSearching(false); });
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
        setAddSuccess("Demande envoyee !");
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

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm font-medium text-primary/60">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-12 pt-6">
      <div className="mb-6">
        <BackButton className="mb-3" />
        <h1 className="text-2xl font-black tracking-tight">Amis</h1>
      </div>

      <div className="space-y-4">
        {/* Search & Add */}
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
              <UserPlus className="size-4" />
              Ajouter un ami
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom ou email..."
                  className="w-full rounded-lg bg-secondary/50 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                      <div>
                        <p className="text-sm font-bold">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleAdd(user.email)}
                        disabled={pendingAction !== null}
                        className="text-primary hover:text-primary/80"
                      >
                        {pendingAction === `add:${user.email}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserPlus className="size-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {addError && <p className="text-xs font-bold text-red-500">{addError}</p>}
              {addSuccess && <p className="text-xs font-bold text-primary">{addSuccess}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Pending received */}
        {data.pendingReceived.length > 0 && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Clock className="size-4" />
                Demandes recues ({data.pendingReceived.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.pendingReceived.map((f) => (
                  <div key={f.friendshipId} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-bold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleAccept(f.friendshipId)}
                        disabled={pendingAction !== null}
                        className="text-primary hover:text-primary/80"
                      >
                        {pendingAction === `accept:${f.friendshipId}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDecline(f.friendshipId)}
                        disabled={pendingAction !== null}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        {pendingAction === `decline:${f.friendshipId}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <X className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending sent */}
        {data.pendingSent.length > 0 && (
          <Card className="card-gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
                <Clock className="size-4" />
                Demandes envoyees ({data.pendingSent.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.pendingSent.map((f) => (
                  <div key={f.friendshipId} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-bold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemove(f.friendshipId)}
                      disabled={pendingAction !== null}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      {pendingAction === `remove:${f.friendshipId}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Friends list */}
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/60">
              <Users className="size-4" />
              Mes amis ({data.friends.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.friends.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Aucun ami pour le moment</p>
            ) : (
              <div className="space-y-2">
                {data.friends.map((f) => (
                  <div key={f.friendshipId} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* Le Totem de l'ami : sa carte de parade */}
                      {f.totemImage && (
                        <Image
                          src={f.totemImage}
                          alt={f.totemName ?? ""}
                          width={32}
                          height={32}
                          unoptimized
                          className="size-8 shrink-0 object-contain"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{f.name}</p>
                        {f.title ? (
                          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-primary/70">
                            {f.title}
                          </p>
                        ) : (
                          <p className="truncate text-xs text-muted-foreground">{f.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/friends/${f.userId}`}>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-primary hover:text-primary/80"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemove(f.friendshipId)}
                        disabled={pendingAction !== null}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        {pendingAction === `remove:${f.friendshipId}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
