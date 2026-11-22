import { describe, expect, it } from "vitest";
import {
  calculateCommunityRecognitionScore,
  calculateQualifyingOrderPoints,
  computeLoyaltyBalanceFromLedger,
  findNextRewardProgress,
  getCurrentWeekStartISO,
  type LoyaltyRules,
} from "@/lib/loyalty";

const SAMPLE_RULES: LoyaltyRules = {
  enabled: true,
  points_per_nad: 0.1, // 1 point per N$ 10
  min_qualifying_nad: 150,
  excluded_categories: ["Shooters"],
  excluded_item_ids: ["excluded-item"],
  award_on_reservation_arrival: false,
  reservation_bonus_points: 0,
  points_expiry_days: 365,
};

describe("Phase 3: Butcher Block Rewards & Guest of the Week", () => {
  it("never awards spend-based points for unpaid or incomplete orders", () => {
    const items = [{ id: "cc-ribeye", category: "Choice Cuts", price: 335, qty: 1 }];
    expect(
      calculateQualifyingOrderPoints({ status: "pending", payment_status: "unpaid", total: 335, items }, SAMPLE_RULES),
    ).toBe(0);
    expect(
      calculateQualifyingOrderPoints({ status: "completed", payment_status: "unpaid", total: 335, items }, SAMPLE_RULES),
    ).toBe(0);
    expect(
      calculateQualifyingOrderPoints({ status: "preparing", payment_status: "paid", total: 335, items }, SAMPLE_RULES),
    ).toBe(0);
    expect(
      calculateQualifyingOrderPoints({ status: "completed", payment_status: "paid", total: 335, items }, SAMPLE_RULES),
    ).toBe(33);
  });

  it("enforces excluded categories, excluded items, minimum spend, and disabled program", () => {
    const items = [
      { id: "cc-ribeye", category: "Choice Cuts", price: 200, qty: 1 },
      { id: "shot-1", category: "Shooters", price: 90, qty: 1 },
      { id: "excluded-item", category: "Sides", price: 60, qty: 1 },
    ];
    // Eligible is only N$ 200 -> 20 pts
    expect(
      calculateQualifyingOrderPoints({ status: "completed", payment_status: "paid", total: 350, items }, SAMPLE_RULES),
    ).toBe(20);

    // Below minimum qualifying N$ 150 -> 0 pts
    expect(
      calculateQualifyingOrderPoints(
        { status: "completed", payment_status: "paid", total: 120, items: [{ id: "a", category: "Sides", price: 120, qty: 1 }] },
        SAMPLE_RULES,
      ),
    ).toBe(0);

    // Program disabled -> 0 pts
    expect(
      calculateQualifyingOrderPoints(
        { status: "completed", payment_status: "paid", total: 335, items },
        { ...SAMPLE_RULES, enabled: false },
      ),
    ).toBe(0);
  });

  it("computes unexpired balance accurately across earns, redemptions, reversals, and expirations", () => {
    const now = Date.parse("2026-11-22T18:00:00Z");
    const balance = computeLoyaltyBalanceFromLedger(
      [
        { points: 50, expires_at: "2027-01-01T00:00:00Z" },
        { points: 40, expires_at: "2026-01-01T00:00:00Z" }, // expired -> ignored
        { points: 30, expires_at: null },
        { points: -25, expires_at: null }, // redeemed
        { points: -15, expires_at: null }, // reversed refund
      ],
      now,
    );
    expect(balance).toBe(40);
  });

  it("calculates next reward progress and handles empty catalogs honestly", () => {
    expect(findNextRewardProgress(40, [])).toEqual({ nextReward: null, pointsNeeded: 0, percent: 0 });
    const progress = findNextRewardProgress(40, [
      {
        id: "r1",
        title: "Complimentary Side Dish",
        description: null,
        category: "side",
        points_cost: 100,
        active: true,
        expires_at: null,
        terms: null,
      },
    ]);
    expect(progress.nextReward?.title).toBe("Complimentary Side Dish");
    expect(progress.pointsNeeded).toBe(60);
    expect(progress.percent).toBe(40);
  });

  it("caps Guest of the Week community scoring so raw order volume cannot dominate alone", () => {
    const whaleNoReviews = calculateCommunityRecognitionScore({
      completedOrders: 50,
      verifiedReviews: 0,
      loyaltyEvents: 1,
      totalVisits: 2,
    });
    const engagedRegular = calculateCommunityRecognitionScore({
      completedOrders: 4,
      verifiedReviews: 4,
      loyaltyEvents: 4,
      totalVisits: 6,
    });
    expect(engagedRegular).toBeGreaterThan(whaleNoReviews);
    expect(getCurrentWeekStartISO("2026-11-22")).toBe("2026-11-16");
  });
});
