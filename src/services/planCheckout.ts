import { supabase } from "@/integrations/supabase/client";
import type { GeneratedPlan } from "@/lib/planMyNight";
import { saveOrderSnapshotForTracking } from "@/lib/orderTrackingStorage";
import { insertOrderAndBookingWithSharedArrivalCode } from "@/lib/supabaseArrivalInsert";

const SERVICE_FEE = 20;
const DEFAULT_ETA_MINUTES = 25;

export type OrderLine = { name: string; qty: number; price: number };

export function buildOrderLinesFromPlan(plan: GeneratedPlan): OrderLine[] {
  const lines: OrderLine[] = [
    { name: plan.food.name, qty: 1, price: plan.food.price },
    ...plan.extras.map((x) => ({ name: x.name, qty: 1, price: x.price })),
  ];
  if (plan.drinkCount > 0) {
    lines.push({
      name: plan.drink.name,
      qty: plan.drinkCount,
      price: plan.drink.price,
    });
  }
  return lines;
}

function subtotal(lines: OrderLine[]) {
  return lines.reduce((s, l) => s + l.price * l.qty, 0);
}

/**
 * Creates a preorder + booking for tonight, returns new order id for /order/:id.
 */
export async function executePlanBookAndOrder(opts: {
  plan: GeneratedPlan;
  guestCount: number;
  userId: string | null;
  guestName?: string | null;
}): Promise<string> {
  const lines = buildOrderLinesFromPlan(opts.plan);
  const sub = subtotal(lines);
  const total = sub + SERVICE_FEE;
  const today = new Date().toISOString().split("T")[0];
  const nowIso = new Date().toISOString();

  const orderRow = {
    user_id: opts.userId,
    items: lines,
    total,
    status: "pending",
    order_type: "preorder",
    eta_minutes: DEFAULT_ETA_MINUTES,
    eta_set_at: nowIso,
  };

  const bookingWithoutPreOrder = {
    user_id: opts.userId,
    guest_name: opts.userId ? null : (opts.guestName?.trim() || "Guest"),
    guest_phone: null,
    date: today,
    time: opts.plan.time,
    guests: opts.guestCount,
    special_requests: `Plan My Night — ${opts.plan.note}`.slice(0, 900),
  };

  const { orderId, arrival_code } = await insertOrderAndBookingWithSharedArrivalCode({
    orderRow,
    bookingWithoutPreOrder,
  });

  const { data: orderRowFull } = await supabase.from("orders").select("*").eq("id", orderId).single();

  saveOrderSnapshotForTracking({
    id: orderId,
    items: orderRowFull?.items ?? lines,
    total: Number(orderRowFull?.total ?? total),
    status: (orderRowFull?.status as string) ?? "pending",
    order_type: orderRowFull?.order_type as string | undefined,
    eta_minutes: orderRowFull?.eta_minutes as number | null | undefined,
    eta_set_at: orderRowFull?.eta_set_at as string | null | undefined,
    created_at: orderRowFull?.created_at as string | undefined,
    arrival_code,
  });

  try {
    const existing = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
    existing.push({
      id: orderId,
      items: lines,
      total,
      status: "pending",
      order_type: "preorder",
      createdAt: nowIso,
      arrival_code,
    });
    localStorage.setItem("berrylicious-orders", JSON.stringify(existing));
  } catch {
    /* ignore */
  }

  return orderId;
}
