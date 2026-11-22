import { toast } from "sonner";
import { getOrderStageCopy, type OrderFulfillmentType } from "@/lib/orderLifecycle";
import { supabase } from "@/integrations/supabase/client";

const dedupe = new Map<string, number>();
const DEDUPE_MS = 10_000;

function pruneExpiredDedupe(store: Map<string, number>, now: number) {
  if (store.size < 32) return;
  for (const [k, timestamp] of store) {
    if (now - timestamp >= DEDUPE_MS) {
      store.delete(k);
    }
  }
}

/** Pure helper so dedupe behavior can be unit tested deterministically. */
export function shouldEmitStatusNotification(
  store: Map<string, number>,
  orderId: string,
  prevStatus: string | undefined,
  nextStatus: string,
  nowMs = Date.now(),
): boolean {
  if (!orderId || !nextStatus || prevStatus === nextStatus) return false;
  if (prevStatus === undefined) return false;
  const key = `${orderId}:${nextStatus}`;
  const last = store.get(key);
  if (last !== undefined && nowMs - last < DEDUPE_MS) return false;
  pruneExpiredDedupe(store, nowMs);
  store.set(key, nowMs);
  return true;
}

/** Toast + optional local browser alert (ONLY if user already granted permission). */
export function notifyOrderStatusTransition(
  orderId: string,
  prevStatus: string | undefined,
  nextStatus: string,
  orderType?: OrderFulfillmentType,
) {
  if (!shouldEmitStatusNotification(dedupe, orderId, prevStatus, nextStatus)) return;
  orderStatusToast(nextStatus, orderType);
  tryBrowserNotifyOrderStatus(nextStatus, orderType, orderId);
}

export function orderStatusToast(status: string, orderType?: OrderFulfillmentType) {
  const copy = getOrderStageCopy(status, orderType);
  toast(copy.label, { description: copy.notificationMessage });
}

export function tryBrowserNotifyOrderStatus(
  status: string,
  orderType?: OrderFulfillmentType,
  orderId?: string,
) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const copy = getOrderStageCopy(status, orderType);
  try {
    new Notification(copy.label, {
      body: copy.notificationMessage,
      tag: orderId ? `butcher-block-order-${orderId}-${status}` : `butcher-block-order-${status}`,
      silent: false,
    });
  } catch {
    /* ignore restricted browser notification contexts */
  }
}

export type PushSupportState =
  | "supported"
  | "denied"
  | "unsupported"
  | "missing_vapid";

export function getWebPushCapability(): PushSupportState {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const vapidKey = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? "").trim();
  if (!vapidKey) return "missing_vapid";
  return "supported";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Explicitly user-initiated notification permission request.
 * Never call automatically on page load.
 */
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

type DynamicPushTable = {
  from: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => Promise<{ error: { message?: string } | null }>;
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };
};

export async function subscribeUserToWebPush(
  userId: string,
): Promise<{ ok: boolean; status: "subscribed" | "in_app_only" | "denied" | "unsupported"; message: string }> {
  const permission = await requestOrderNotificationPermission();
  if (permission === "unsupported") {
    return {
      ok: false,
      status: "unsupported",
      message: "This browser does not support push alerts. In-app live updates remain active.",
    };
  }
  if (permission !== "granted") {
    return {
      ok: false,
      status: "denied",
      message: "Browser notifications are blocked. You can still follow live order updates inside the app.",
    };
  }

  const vapidKey = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? "").trim();
  if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      ok: true,
      status: "in_app_only",
      message: "Browser alerts enabled while the app is open. Background web push requires a configured VAPID key.",
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      }));
    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh ?? "";
    const authKey = json.keys?.auth ?? "";

    if (!subscription.endpoint || !p256dh || !authKey) {
      return {
        ok: false,
        status: "unsupported",
        message: "Browser returned an incomplete push subscription. In-app alerts remain active.",
      };
    }

    const db = supabase as unknown as DynamicPushTable;
    await db.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth_key: authKey,
        user_agent: navigator.userAgent.slice(0, 240),
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );

    return {
      ok: true,
      status: "subscribed",
      message: "Push subscription saved for your Butcher Block updates.",
    };
  } catch {
    return {
      ok: true,
      status: "in_app_only",
      message: "Foreground alerts enabled. Background web push is unavailable on this device.",
    };
  }
}

export async function unsubscribeUserFromWebPush(userId: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (!existing) return;
    const endpoint = existing.endpoint;
    await existing.unsubscribe();
    const db = supabase as unknown as DynamicPushTable;
    await db
      .from("push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
  } catch {
    /* ignore */
  }
}
