import { describe, expect, it } from "vitest";
import {
  buildTableQrUrl,
  canCustomerCancelServiceRequest,
  findDuplicateActiveServiceRequest,
  isTableSessionExpired,
  isValidTableCodeFormat,
} from "@/lib/tableService";

describe("Phase 4: QR Table Ordering & Waiter Service Requests", () => {
  it("validates table QR code formats and rejects malformed or injection strings", () => {
    expect(isValidTableCodeFormat("BB-T04-9F2A1B")).toBe(true);
    expect(isValidTableCodeFormat("T12_WIN")).toBe(true);
    expect(isValidTableCodeFormat("")).toBe(false);
    expect(isValidTableCodeFormat("ab")).toBe(false);
    expect(isValidTableCodeFormat("T1; DROP TABLE orders;")).toBe(false);
    expect(isValidTableCodeFormat("../admin")).toBe(false);
  });

  it("detects expired table sessions accurately", () => {
    const now = Date.parse("2026-11-22T18:00:00Z");
    expect(isTableSessionExpired({ expiresAt: "2026-11-22T22:00:00Z" }, now)).toBe(false);
    expect(isTableSessionExpired({ expiresAt: "2026-11-22T17:59:59Z" }, now)).toBe(true);
    expect(isTableSessionExpired({ expiresAt: "invalid-date" }, now)).toBe(true);
  });

  it("enforces service-request ownership for cancellation and blocks non-pending cancel", () => {
    expect(
      canCustomerCancelServiceRequest(
        { status: "pending", user_id: "u1", guest_session_key: null },
        { userId: "u1" },
      ),
    ).toBe(true);
    expect(
      canCustomerCancelServiceRequest(
        { status: "pending", user_id: "u1", guest_session_key: null },
        { userId: "u2" },
      ),
    ).toBe(false);
    expect(
      canCustomerCancelServiceRequest(
        { status: "acknowledged", user_id: "u1", guest_session_key: null },
        { userId: "u1" },
      ),
    ).toBe(false);
    expect(
      canCustomerCancelServiceRequest(
        { status: "pending", user_id: null, guest_session_key: "gk-1" },
        { guestKey: "gk-1" },
      ),
    ).toBe(true);
    expect(
      canCustomerCancelServiceRequest(
        { status: "pending", user_id: null, guest_session_key: "gk-1" },
        { guestKey: "gk-2" },
      ),
    ).toBe(false);
  });

  it("prevents duplicate active waiter requests of the same type", () => {
    const existing = [
      { id: "r1", request_type: "water" as const, status: "acknowledged" as const },
      { id: "r2", request_type: "cutlery" as const, status: "completed" as const },
    ];
    expect(findDuplicateActiveServiceRequest(existing, "water")?.id).toBe("r1");
    expect(findDuplicateActiveServiceRequest(existing, "cutlery")).toBeNull();
    expect(findDuplicateActiveServiceRequest(existing, "bill")).toBeNull();
  });

  it("builds safe QR destination URLs without exposing internal metadata", () => {
    expect(buildTableQrUrl("BB-T04-9F2A1B", "https://butcherblock.com.na/")).toBe(
      "https://butcherblock.com.na/table/BB-T04-9F2A1B",
    );
  });
});
