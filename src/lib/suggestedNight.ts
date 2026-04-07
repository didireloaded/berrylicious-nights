const KEY = "berrylicious-suggested-night";

export type SuggestedNightSummary = {
  time: string;
  food: string;
  drink: string;
  guests?: number;
  updatedAt: string;
};

/** Shown on Home before the user builds a plan in-session. */
export const DEFAULT_HOME_SUGGESTED_NIGHT = {
  time: "19:30",
  food: "The Licious Burger",
  drink: "Classic Mojito",
} as const;

export function persistSuggestedNight(p: Omit<SuggestedNightSummary, "updatedAt">) {
  const payload: SuggestedNightSummary = { ...p, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readSuggestedNight(): SuggestedNightSummary | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SuggestedNightSummary;
  } catch {
    return null;
  }
}
