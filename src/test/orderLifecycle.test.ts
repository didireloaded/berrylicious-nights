import { describe, expect, it } from "vitest";
import {
  buildOrderNotificationEventKey,
  canTransitionOrderStatus,
  generateGuestAccessToken,
  getKitchenActionLabel,
  getNextKitchenStage,
  getOrderStageCopy,
  isActiveOrderStatus,
  sha256Hex,
} from "@/lib/orderLifecycle";
import { shouldEmitStatusNotification } from "@/lib/orderStatusNotify";

describe("Phase 1: Kitchen Order Lifecycle & Notification Deduplication", () => {
  it("enforces valid 6-stage kitchen status transitions and rejects illegal jumps", () => {
    expect(canTransitionOrderStatus("pending", "confirmed")).toBe(true);
    expect(canTransitionOrderStatus("pending", "preparing")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "preparing")).toBe(true);
    expect(canTransitionOrderStatus("preparing", "ready")).toBe(true);
    expect(canTransitionOrderStatus("ready", "handover")).toBe(true);
    expect(canTransitionOrderStatus("handover", "completed")).toBe(true);

    // Reject backwards, terminal, or duplicate transitions
    expect(canTransitionOrderStatus("pending", "pending")).toBe(false);
    expect(canTransitionOrderStatus("pending", "completed")).toBe(false);
    expect(canTransitionOrderStatus("completed", "preparing")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "confirmed")).toBe(false);
    expect(canTransitionOrderStatus("ready", "pending")).toBe(false);
  });

  it("advances kitchen stages cleanly in exact operational sequence", () => {
    expect(getNextKitchenStage("pending")).toBe("confirmed");
    expect(getNextKitchenStage("confirmed")).toBe("preparing");
    expect(getNextKitchenStage("preparing")).toBe("ready");
    expect(getNextKitchenStage("ready")).toBe("handover");
    expect(getNextKitchenStage("handover")).toBe("completed");
    expect(getNextKitchenStage("completed")).toBeNull();
    expect(getNextKitchenStage("cancelled")).toBeNull();

    expect(getKitchenActionLabel("ready", "dinein")).toBe("Send to table");
    expect(getKitchenActionLabel("ready", "pickup")).toBe("Ready at counter");
  });

  it("produces exact Butcher Block stage copy for dine-in vs pickup handover", () => {
    expect(getOrderStageCopy("pending", "dinein").notificationMessage).toBe(
      "Your order has been received by Butcher Block.",
    );
    expect(getOrderStageCopy("confirmed", "dinein").notificationMessage).toBe(
      "The kitchen has confirmed your order.",
    );
    expect(getOrderStageCopy("preparing", "dinein").notificationMessage).toBe(
      "Your food is being prepared.",
    );
    expect(getOrderStageCopy("ready", "pickup").notificationMessage).toBe(
      "Your order is ready.",
    );
    expect(getOrderStageCopy("handover", "dinein").notificationMessage).toBe(
      "Your food is on its way to your table.",
    );
    expect(getOrderStageCopy("handover", "pickup").notificationMessage).toBe(
      "Your order is ready for collection.",
    );
    expect(getOrderStageCopy("completed", "dinein").notificationMessage).toBe(
      "Enjoy your meal. We'd love to hear what you think.",
    );
  });

  it("identifies active vs terminal order statuses", () => {
    expect(isActiveOrderStatus("pending")).toBe(true);
    expect(isActiveOrderStatus("confirmed")).toBe(true);
    expect(isActiveOrderStatus("preparing")).toBe(true);
    expect(isActiveOrderStatus("ready")).toBe(true);
    expect(isActiveOrderStatus("handover")).toBe(true);
    expect(isActiveOrderStatus("completed")).toBe(false);
    expect(isActiveOrderStatus("cancelled")).toBe(false);
  });

  it("deduplicates repeated status notifications deterministically", () => {
    const key1 = buildOrderNotificationEventKey("ord-1", "preparing");
    const key2 = buildOrderNotificationEventKey("ord-1", "preparing");
    const key3 = buildOrderNotificationEventKey("ord-1", "ready");
    expect(key1).toBe("order:ord-1:preparing");
    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);

    const seen = new Map<string, number>();
    expect(shouldEmitStatusNotification(seen, "ord-1", "confirmed", "preparing", 1000)).toBe(true);
    // Repeated duplicate within dedupe window must be suppressed
    expect(shouldEmitStatusNotification(seen, "ord-1", "confirmed", "preparing", 2500)).toBe(false);
    // Same-status no-op must never notify
    expect(shouldEmitStatusNotification(seen, "ord-1", "preparing", "preparing", 9000)).toBe(false);
    // Advancing to next stage emits immediately
    expect(shouldEmitStatusNotification(seen, "ord-1", "preparing", "ready", 3000)).toBe(true);
  });

  it("generates opaque guest access tokens and deterministic SHA-256 hashes", async () => {
    const token = generateGuestAccessToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    const hashA = await sha256Hex(token);
    const hashB = await sha256Hex(token);
    expect(hashA).toBeTruthy();
    expect(hashA).toBe(hashB);
    expect(hashA?.length).toBe(64);
  });
});
