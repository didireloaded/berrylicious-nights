/** Browser-local time → copy and recommended slot hints for the home hero. */

export type HomeDayPart = "morning" | "midday" | "afternoon" | "evening" | "late";

export type HomeTimeContext = {
  part: HomeDayPart;
  /** Hero title, e.g. "Tonight" / "Today" */
  heroTitle: string;
  /** Short line under the title */
  heroSubtitle: string;
  /** Suggested reservation / arrival time HH:mm */
  suggestedSlot: string;
};

function hour(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

export function getHomeTimeContext(now = new Date()): HomeTimeContext {
  const h = hour(now);

  if (h >= 23 || h < 5) {
    return {
      part: "late",
      heroTitle: "Late lounge",
      heroSubtitle: "Drinks, small plates, and the room still humming.",
      suggestedSlot: "21:00",
    };
  }
  if (h < 11) {
    return {
      part: "morning",
      heroTitle: "Good morning",
      heroSubtitle: "Coffee, brunch energy, and a slow start done right.",
      suggestedSlot: "10:30",
    };
  }
  if (h < 15) {
    return {
      part: "midday",
      heroTitle: "Today",
      heroSubtitle: "Lunch windows are open — walk in or book a table.",
      suggestedSlot: "12:30",
    };
  }
  if (h < 17) {
    return {
      part: "afternoon",
      heroTitle: "Today",
      heroSubtitle: "Afternoon catch-ups before the room turns up.",
      suggestedSlot: "18:00",
    };
  }
  if (h < 22) {
    return {
      part: "evening",
      heroTitle: "Tonight",
      heroSubtitle: "Dinner, cocktails, and the main event.",
      suggestedSlot: "19:30",
    };
  }
  return {
    part: "late",
    heroTitle: "Tonight",
    heroSubtitle: "Last tables and the bar in full swing.",
    suggestedSlot: "21:00",
  };
}
