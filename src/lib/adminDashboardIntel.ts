/**
 * Heuristic “kitchen brain” for the admin dashboard — no external AI API.
 * Tunes ETAs, load signals, and short operator hints from live order shape + queue depth.
 */

export type KitchenLoad = "low" | "medium" | "high";

export type AdminOrderLike = {
  id: string;
  status: string;
  created_at: string;
  items?: unknown;
  total?: number;
  order_type?: string | null;
};

export function groupOrdersByKitchenStatus(orders: AdminOrderLike[]) {
  const active = orders.filter((o) => o.status !== "completed");
  return {
    pending: active.filter((o) => o.status === "pending"),
    preparing: active.filter((o) => o.status === "preparing"),
    ready: active.filter((o) => o.status === "ready"),
    completed: orders.filter((o) => o.status === "completed"),
  };
}

function lineCount(order: AdminOrderLike): number {
  if (!Array.isArray(order.items)) return 0;
  return order.items.reduce((n, it: { qty?: number }) => n + (Number(it?.qty) > 0 ? Number(it.qty) : 1), 0);
}

/** Suggested prep minutes for a ticket given current kitchen queue (not persisted). */
export function estimatePrepMinutes(order: AdminOrderLike, activeNonCompletedCount: number): number {
  const lines = lineCount(order);
  const base = 10;
  const itemFactor = Math.min(lines * 2, 24);
  const loadFactor = Math.min(Math.max(0, activeNonCompletedCount - 1) * 1.5, 20);
  return Math.round(Math.min(45, base + itemFactor + loadFactor));
}

export function inferredPriority(order: AdminOrderLike): "high" | "normal" {
  if (order.order_type === "dinein") return "high";
  return "normal";
}

export function kitchenLoadLevel(pending: number, preparing: number, ready: number): KitchenLoad {
  const score = pending * 2 + preparing + ready * 0.5;
  if (score >= 14) return "high";
  if (score >= 6) return "medium";
  return "low";
}

export function ordersPerMinuteLastWindow(orders: AdminOrderLike[], windowMinutes: number): number {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const recent = orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  return windowMinutes > 0 ? recent.length / windowMinutes : 0;
}

export function buildDashboardHints(input: {
  grouped: ReturnType<typeof groupOrdersByKitchenStatus>;
  ordersPerMinute: number;
  bookingsNextWindow: number;
}): string[] {
  const hints: string[] = [];
  const { pending, preparing } = input.grouped;
  if (pending.length >= 4) {
    hints.push("Kitchen queue long — start with the oldest pending tickets.");
  }
  if (pending.length >= 2 && preparing.length === 0) {
    hints.push("Nothing on the pass — pull the next pending order.");
  }
  if (input.ordersPerMinute > 1.2) {
    hints.push("High demand — prioritize smaller / faster tickets.");
  }
  if (preparing.length >= 5) {
    hints.push("Many orders cooking — hold new large tickets until one clears.");
  }
  if (input.bookingsNextWindow >= 3) {
    hints.push("Several tables in the next 10 minutes — sync floor with kitchen.");
  }
  return hints.slice(0, 4);
}

/** Bookings for `date` with time between now and now + minutes (same calendar day). */
export function bookingsInNextMinutes(
  bookings: { date: string; time: string; status?: string }[],
  now: Date,
  windowMinutes: number,
): number {
  const today = now.toISOString().split("T")[0];
  const windowEnd = now.getTime() + windowMinutes * 60 * 1000;
  return bookings.filter((b) => {
    if (b.date !== today) return false;
    if (b.status === "cancelled") return false;
    const parts = String(b.time).split(":");
    const hh = parseInt(parts[0] ?? "", 10);
    const mm = parseInt(parts[1] ?? "0", 10);
    if (Number.isNaN(hh)) return false;
    const at = new Date(now);
    at.setHours(hh, Number.isNaN(mm) ? 0 : mm, 0, 0);
    const t = at.getTime();
    return t >= now.getTime() && t <= windowEnd;
  }).length;
}

export function revenueTodayCompleted(orders: AdminOrderLike[], todayIso: string): number {
  return orders
    .filter((o) => o.status === "completed" && String(o.created_at).split("T")[0] === todayIso)
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
}

export function getNextOrderStatus(status: string): string | null {
  if (status === "pending") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "completed";
  return null;
}

/** Rough snapshot from the orders currently loaded in the admin client (not full warehouse analytics). */
export function aggregateShiftAnalytics(orders: AdminOrderLike[]) {
  const itemCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  for (const o of orders) {
    const h = new Date(o.created_at).getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    if (Array.isArray(o.items)) {
      for (const it of o.items as { name?: string; qty?: number }[]) {
        const name = it?.name?.trim() || "Unknown";
        const q = Number(it?.qty) > 0 ? Number(it.qty) : 1;
        itemCounts.set(name, (itemCounts.get(name) ?? 0) + q);
      }
    }
  }
  let peakHour = 19;
  let peakN = 0;
  hourCounts.forEach((n, h) => {
    if (n > peakN) {
      peakN = n;
      peakHour = h;
    }
  });
  let topItem = "—";
  let topN = 0;
  itemCounts.forEach((n, name) => {
    if (n > topN) {
      topN = n;
      topItem = name;
    }
  });
  return {
    totalOrders: orders.length,
    peakHour: `${String(peakHour).padStart(2, "0")}:00`,
    mostOrdered: topItem,
  };
}
