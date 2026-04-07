import type { PlanPeople, PlanVibe } from "@/lib/planMyNight";

const KEY = "berrylicious-plan-draft";

export type PlanDraftV1 = {
  v: 1;
  step: 1 | 2;
  people: PlanPeople | null;
  vibe: PlanVibe | null;
  preferredTime: string | null;
};

export function readPlanDraft(): PlanDraftV1 | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlanDraftV1;
    if (p?.v !== 1 || (p.step !== 1 && p.step !== 2)) return null;
    return p;
  } catch {
    return null;
  }
}

export function writePlanDraft(draft: Omit<PlanDraftV1, "v">): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: 1, ...draft } satisfies PlanDraftV1));
  } catch {
    /* ignore */
  }
}

export function clearPlanDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function planDraftInProgress(): boolean {
  const d = readPlanDraft();
  return d != null && d.step < 3;
}
