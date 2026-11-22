import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "butcher-block-favorites";
const SYNC_EVENT = "bb-favorites-updated";

function readLocalFavorites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore storage quota errors */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<string[]>(SYNC_EVENT, { detail: ids }));
  }
}

/**
 * Genuine persisted favourites backed by `localStorage` for guests
 * and synced to `profiles.favorite_items` in Supabase when signed in.
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readLocalFavorites);

  // Keep multiple mounted components in sync when favourites change
  useEffect(() => {
    const onSync = (event: Event) => {
      const custom = event as CustomEvent<string[]>;
      if (Array.isArray(custom.detail)) {
        setFavoriteIds(custom.detail);
      } else {
        setFavoriteIds(readLocalFavorites());
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  // Load authenticated user's saved favourites from Supabase profiles.favorite_items
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("favorite_items")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const remote = Array.isArray(data?.favorite_items)
          ? data.favorite_items.filter((x): x is string => typeof x === "string")
          : [];
        const local = readLocalFavorites();
        const merged = Array.from(new Set([...remote, ...local]));
        setFavoriteIds(merged);
        writeLocalFavorites(merged);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isFavorite = useCallback(
    (itemId: string) => favoriteIds.includes(itemId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    (itemId: string) => {
      const current = readLocalFavorites();
      const exists = current.includes(itemId);
      const next = exists ? current.filter((id) => id !== itemId) : [...current, itemId];
      setFavoriteIds(next);
      writeLocalFavorites(next);

      if (user?.id) {
        void supabase
          .from("profiles")
          .update({ favorite_items: next })
          .eq("user_id", user.id);
      }
      return !exists;
    },
    [user?.id],
  );

  return { favoriteIds, isFavorite, toggleFavorite };
}
