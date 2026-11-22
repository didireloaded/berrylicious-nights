import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { DietaryPreference } from "@/lib/smartSuggestions";

export interface UsualOrderPreset {
  key: string;
  menuItemId: string;
  name: string;
  weight?: string;
  doneness?: string;
  side?: string;
  sauces?: string[];
  quantity: number;
}

export interface DiningPreferencesState {
  dietaryPreferences: DietaryPreference[];
  preferredDoneness: string;
  preferredSide: string;
  usualItems: UsualOrderPreset[];
}

const STORAGE_KEY = "bb-dining-preferences-v1";

const EMPTY_PREFS: DiningPreferencesState = {
  dietaryPreferences: [],
  preferredDoneness: "Medium Rare",
  preferredSide: "Chips",
  usualItems: [],
};

function readLocalPrefs(): DiningPreferencesState {
  if (typeof localStorage === "undefined") return EMPTY_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<DiningPreferencesState>;
    return {
      dietaryPreferences: Array.isArray(parsed.dietaryPreferences) ? parsed.dietaryPreferences : [],
      preferredDoneness: typeof parsed.preferredDoneness === "string" ? parsed.preferredDoneness : "Medium Rare",
      preferredSide: typeof parsed.preferredSide === "string" ? parsed.preferredSide : "Chips",
      usualItems: Array.isArray(parsed.usualItems) ? parsed.usualItems : [],
    };
  } catch {
    return EMPTY_PREFS;
  }
}

function writeLocalPrefs(next: DiningPreferencesState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<(next: DiningPreferencesState) => void>();
let sharedState: DiningPreferencesState = readLocalPrefs();

function broadcast(next: DiningPreferencesState) {
  sharedState = next;
  writeLocalPrefs(next);
  for (const fn of listeners) fn(next);
}

type DynamicPrefsDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
    upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: unknown }>;
  };
};

export function useDiningPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<DiningPreferencesState>(() => sharedState);

  useEffect(() => {
    const listener = (next: DiningPreferencesState) => setPrefs(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Hydrate from Supabase when signed in
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const db = supabase as unknown as DynamicPrefsDb;
    void db
      .from("user_dining_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        const remote: DiningPreferencesState = {
          dietaryPreferences: Array.isArray(data.dietary_preferences)
            ? (data.dietary_preferences as DietaryPreference[])
            : [],
          preferredDoneness:
            typeof data.preferred_doneness === "string" && data.preferred_doneness
              ? data.preferred_doneness
              : "Medium Rare",
          preferredSide:
            typeof data.preferred_side === "string" && data.preferred_side
              ? data.preferred_side
              : "Chips",
          usualItems: Array.isArray(data.usual_items) ? (data.usual_items as UsualOrderPreset[]) : [],
        };
        broadcast(remote);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const persist = useCallback(
    (next: DiningPreferencesState) => {
      broadcast(next);
      if (user?.id) {
        const db = supabase as unknown as DynamicPrefsDb;
        void db.from("user_dining_preferences").upsert(
          {
            user_id: user.id,
            dietary_preferences: next.dietaryPreferences,
            preferred_doneness: next.preferredDoneness,
            preferred_side: next.preferredSide,
            usual_items: next.usualItems,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
    },
    [user?.id],
  );

  const toggleDietaryPreference = useCallback(
    (id: DietaryPreference) => {
      const exists = sharedState.dietaryPreferences.includes(id);
      const nextList = exists
        ? sharedState.dietaryPreferences.filter((p) => p !== id)
        : [...sharedState.dietaryPreferences, id];
      persist({ ...sharedState, dietaryPreferences: nextList });
    },
    [persist],
  );

  const setSteakDefaults = useCallback(
    (doneness: string, side: string) => {
      persist({ ...sharedState, preferredDoneness: doneness, preferredSide: side });
    },
    [persist],
  );

  const saveUsualItem = useCallback(
    (item: Omit<UsualOrderPreset, "key">) => {
      const key = [
        item.menuItemId,
        item.weight ?? "",
        item.doneness ?? "",
        item.side ?? "",
        (item.sauces ?? []).slice().sort().join(","),
      ].join("|");
      const filtered = sharedState.usualItems.filter((u) => u.key !== key);
      const next = [{ ...item, key }, ...filtered].slice(0, 8);
      persist({ ...sharedState, usualItems: next });
    },
    [persist],
  );

  const removeUsualItem = useCallback(
    (key: string) => {
      const next = sharedState.usualItems.filter((u) => u.key !== key);
      persist({ ...sharedState, usualItems: next });
    },
    [persist],
  );

  return {
    prefs,
    toggleDietaryPreference,
    setSteakDefaults,
    saveUsualItem,
    removeUsualItem,
  };
}
