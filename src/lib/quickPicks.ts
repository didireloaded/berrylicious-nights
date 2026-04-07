import { menuItems, type MenuItem } from "@/data/menu";

export type QuickPickId = "date_night" | "quick_lunch" | "drinks_only" | "group_night";

export type QuickPickConfig = {
  id: QuickPickId;
  label: string;
  tagline: string;
  suggestedTime: string;
  suggestedGuests: number;
  menuItemIds: string[];
};

export const quickPicks: QuickPickConfig[] = [
  {
    id: "date_night",
    label: "Date night",
    tagline: "Slow pace, shareable courses, wine.",
    suggestedTime: "19:30",
    suggestedGuests: 2,
    menuItemIds: ["18", "16", "13"],
  },
  {
    id: "quick_lunch",
    label: "Quick lunch",
    tagline: "In and out — still proper flavour.",
    suggestedTime: "12:30",
    suggestedGuests: 2,
    menuItemIds: ["8", "5", "15"],
  },
  {
    id: "drinks_only",
    label: "Drinks only",
    tagline: "Bar classics to start the night.",
    suggestedTime: "20:00",
    suggestedGuests: 2,
    menuItemIds: ["14", "19", "15"],
  },
  {
    id: "group_night",
    label: "Group night",
    tagline: "Big flavours for the whole table.",
    suggestedTime: "21:00",
    suggestedGuests: 6,
    menuItemIds: ["6", "3", "14"],
  },
];

export function menuItemsForQuickPick(ids: string[]): MenuItem[] {
  return ids
    .map((id) => menuItems.find((m) => m.id === id))
    .filter((m): m is MenuItem => m != null);
}
