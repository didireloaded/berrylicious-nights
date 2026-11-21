import { toast } from "sonner";

const MESSAGES: Record<string, { title: string; body: string }> = {
  pending: { title: "Order received", body: "We’ve got your order in the kitchen queue." },
  preparing: { title: "Being prepared", body: "The kitchen is working on your order." },
  ready: { title: "Ready", body: "Your order is ready — head over when you are." },
  completed: { title: "Enjoy", body: "Thanks for dining with Butcher Block Steakhouse tonight." },
};

const dedupe = new Map<string, number>();
const DEDUPE_MS = 5000;

function pruneExpiredDedupe(now: number) {
  if (dedupe.size < 32) return;
  for (const [k, timestamp] of dedupe) {
    if (now - timestamp >= DEDUPE_MS) {
      dedupe.delete(k);
    }
  }
}

/** Toast + optional browser notification when status actually changes (deduped). */
export function notifyOrderStatusTransition(orderId: string, prevStatus: string | undefined, nextStatus: string) {
  if (!nextStatus || prevStatus === undefined || prevStatus === nextStatus) return;
  const key = `${orderId}:${nextStatus}`;
  const now = Date.now();
  const last = dedupe.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  pruneExpiredDedupe(now);
  dedupe.set(key, now);
  orderStatusToast(nextStatus);
  tryBrowserNotifyOrderStatus(nextStatus);
}

export function orderStatusToast(status: string) {
  const m = MESSAGES[status] ?? { title: "Order update", body: `Status: ${status}` };
  toast(m.title, { description: m.body });
}

export function tryBrowserNotifyOrderStatus(status: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const m = MESSAGES[status] ?? { title: "Order update", body: `Status: ${status}` };
  try {
    new Notification(m.title, { body: m.body, tag: "berrylicious-order", silent: false });
  } catch {
    /* ignore */
  }
}

export async function requestOrderNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
