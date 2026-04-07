import { menuItems, type MenuItem } from "@/data/menu";

export type PlanPeople = "just_me" | "date" | "friends" | "group";
export type PlanVibe = "chill" | "date_night" | "party" | "quick_bite";

export function getMenuItem(id: string): MenuItem {
  const item = menuItems.find((m) => m.id === id);
  if (!item) throw new Error(`Unknown menu id: ${id}`);
  return item;
}

export interface GeneratedPlan {
  time: string;
  food: MenuItem;
  drink: MenuItem;
  /** How many times to add the drink SKU (e.g. rounds). */
  drinkCount: number;
  extras: MenuItem[];
  note: string;
}

export function generatePlan(
  people: PlanPeople,
  vibe: PlanVibe,
  time: string,
  guestCount: number,
): GeneratedPlan {
  let foodId: string;
  let drinkId: string;
  let note: string;

  switch (vibe) {
    case "chill":
      foodId = "2";
      drinkId = "17";
      note = "Soft lighting and a relaxed pace — perfect for unwinding.";
      break;
    case "date_night":
      foodId = "18";
      drinkId = "16";
      note = "Golden-hour energy with room to savour each course.";
      break;
    case "party":
      foodId = "6";
      drinkId = "14";
      note = "Peak-room energy — the bar and floor pick up after nine.";
      break;
    case "quick_bite":
      foodId = "8";
      drinkId = "19";
      note = "Bold flavours without a long sit-down — you’re in and out.";
      break;
  }

  if (vibe === "date_night" && people === "date") {
    note = "We’ve earmarked the quieter corners for pairs like you.";
  }
  if (people === "group") {
    note = `${note} Sharing plates work brilliantly for your table size.`;
  }
  if (people === "just_me") {
    note = `${note} Solo-friendly pacing throughout.`;
  }

  const extras: MenuItem[] = [];
  if (people === "group") {
    extras.push(getMenuItem("3"));
  }

  let drinkCount = 1;
  if (people === "friends" && vibe === "party") {
    drinkCount = Math.max(2, Math.min(guestCount, 6));
    note = "Your crew matches the room — we’ve lined up a round to match.";
  }

  return {
    time,
    food: getMenuItem(foodId),
    drink: getMenuItem(drinkId),
    drinkCount,
    extras,
    note,
  };
}
