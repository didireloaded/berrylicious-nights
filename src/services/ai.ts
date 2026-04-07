/** Lightweight plan + ETA helpers (no external AI). Menu-aware planning lives in `@/lib/planMyNight`. */

export type AiPlanItem = { id: string; name: string; price: number };

export type AiGeneratedPlan = {
  time: string;
  items: AiPlanItem[];
};

export function generatePlan(input: { vibe: string; people?: string }): AiGeneratedPlan {
  if (input.vibe === "date") {
    return {
      time: "19:30",
      items: [
        { id: "lamb", name: "Lamb Chops", price: 180 },
        { id: "wine", name: "Red Wine", price: 80 },
      ],
    };
  }

  return {
    time: "18:30",
    items: [{ id: "burger", name: "Chicken Burger", price: 90 }],
  };
}

export function estimateETA(ordersCount: number, itemsCount: number): number {
  return 10 + ordersCount * 2 + itemsCount * 2;
}
