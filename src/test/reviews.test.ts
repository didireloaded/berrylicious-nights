import { describe, expect, it } from "vitest";
import {
  canEditReview,
  extractReviewableDishesFromOrder,
  normalizeReviewMenuItemId,
  summarizeRecurringComplaints,
  validateReviewDraft,
} from "@/lib/reviews";

describe("Phase 2: Verified Food Ratings & Review Eligibility", () => {
  it("grants review eligibility only for completed orders and deduplicates repeated lines", () => {
    const items = [
      { id: "cc-ribeye::350g|Medium Rare|Chips|", name: "Rib Eye", qty: 1 },
      { id: "cc-ribeye::350g|Well Done|Mash|", name: "Rib Eye", qty: 1 },
      { id: "6", name: "T-Bone", qty: 1 },
    ];

    expect(extractReviewableDishesFromOrder("pending", items)).toEqual([]);
    expect(extractReviewableDishesFromOrder("preparing", items)).toEqual([]);
    expect(extractReviewableDishesFromOrder("cancelled", items)).toEqual([]);

    const eligible = extractReviewableDishesFromOrder("completed", items);
    expect(eligible).toEqual([
      { menuItemId: "cc-ribeye", name: "Rib Eye" },
      { menuItemId: "6", name: "T-Bone" },
    ]);
  });

  it("normalizes customized cart line IDs cleanly to canonical menu item IDs", () => {
    expect(normalizeReviewMenuItemId("cc-ribeye::350g|Medium Rare|Chips|")).toBe("cc-ribeye");
    expect(normalizeReviewMenuItemId("6")).toBe("6");
    expect(normalizeReviewMenuItemId("")).toBeNull();
  });

  it("validates star range and enforces the review edit window", () => {
    expect(validateReviewDraft({ rating: 5, comment: "Charcoal sear was spot on." })).toEqual({ ok: true });
    expect(validateReviewDraft({ rating: 0 })).toMatchObject({ ok: false });
    expect(validateReviewDraft({ rating: 6 })).toMatchObject({ ok: false });
    expect(validateReviewDraft({ rating: 4.5 })).toMatchObject({ ok: false });

    const now = Date.parse("2026-11-22T18:00:00Z");
    expect(canEditReview("2026-11-25T18:00:00Z", now)).toBe(true);
    expect(canEditReview("2026-11-20T18:00:00Z", now)).toBe(false);
  });

  it("surfaces recurring dish complaints for restaurant management without counting removed rows", () => {
    const complaints = summarizeRecurringComplaints([
      { menu_item_id: "cc-ribeye", menu_item_name: "Rib Eye", rating: 2, status: "published" },
      { menu_item_id: "cc-ribeye", menu_item_name: "Rib Eye", rating: 1, status: "published" },
      { menu_item_id: "6", menu_item_name: "T-Bone", rating: 2, status: "published" },
      { menu_item_id: "6", menu_item_name: "T-Bone", rating: 1, status: "removed" },
      { menu_item_id: "12", menu_item_name: "Burger", rating: 5, status: "published" },
    ]);
    expect(complaints).toEqual([{ menuItemId: "cc-ribeye", name: "Rib Eye", lowRatingCount: 2 }]);
  });
});
