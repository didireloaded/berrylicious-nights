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
      note = "We'll keep the pace easy — no rushing, just good food and a solid drink.";
      break;
    case "date_night":
      foodId = "18";
      drinkId = "16";
      note = "We've got a nice spot picked out. Expect warm lighting and something special on the table.";
      break;
    case "party":
      foodId = "6";
      drinkId = "14";
      note = "Things really pick up after nine — you're walking into the best part of the night.";
      break;
    case "quick_bite":
      foodId = "8";
      drinkId = "19";
      note = "In and out with something proper — no compromises, just no waiting around.";
      break;
  }

  if (vibe === "date_night" && people === "date") {
    note = "We'll seat you somewhere quieter — a little more private, a little more yours.";
  }
  if (people === "group") {
    note = `${note} For your group, sharing plates are the move — more variety, more fun.`;
  }
  if (people === "just_me") {
    note = `${note} Flying solo? We love that. We'll keep it smooth.`;
  }

  const extras: MenuItem[] = [];
  if (people === "group") {
    extras.push(getMenuItem("3"));
  }

  let drinkCount = 1;
  if (people === "friends" && vibe === "party") {
    drinkCount = Math.max(2, Math.min(guestCount, 6));
    note = "Your whole crew's coming through — we've got a round ready when you arrive.";
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
