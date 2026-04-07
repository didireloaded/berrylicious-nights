import type { PlanPeople, PlanVibe } from "@/lib/planMyNight";

export type HostMoodId = "date_night" | "quick_bite" | "drinks" | "group";

export const MOOD_CHIPS: { id: HostMoodId; label: string }[] = [
  { id: "date_night", label: "Date night" },
  { id: "quick_bite", label: "Quick bite" },
  { id: "drinks", label: "Drinks" },
  { id: "group", label: "Group" },
];

export const ENERGY_CHIPS = [
  { id: "relaxed" as const, label: "Relaxed" },
  { id: "lively" as const, label: "Lively" },
];

export const TIME_CHIPS: { time: string; label: string }[] = [
  { time: "18:00", label: "18:00 · Early doors" },
  { time: "19:30", label: "19:30 · Sweet spot" },
  { time: "21:00", label: "21:00 · Peak night" },
];

export function resolvePeopleVibe(
  mood: HostMoodId,
  energy: "relaxed" | "lively",
): { people: PlanPeople; vibe: PlanVibe } {
  switch (mood) {
    case "date_night":
      return { people: "date", vibe: energy === "relaxed" ? "chill" : "date_night" };
    case "quick_bite":
      return { people: "friends", vibe: energy === "relaxed" ? "quick_bite" : "party" };
    case "drinks":
      return { people: "friends", vibe: energy === "relaxed" ? "chill" : "party" };
    case "group":
      return { people: "group", vibe: energy === "relaxed" ? "chill" : "party" };
  }
}

export function guestCountForPeople(people: PlanPeople): number {
  switch (people) {
    case "just_me":
      return 1;
    case "date":
      return 2;
    case "friends":
      return 4;
    case "group":
      return 8;
  }
}
