import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { generateClientUuid } from "@/lib/supabaseArrivalInsert";
import {
  isBackendMissingError,
  type FeatureAvailabilityStatus,
} from "@/lib/featureAvailability";
import {
  computeLoyaltyBalanceFromLedger,
  findNextRewardProgress,
  type GuestOfWeekRecord,
  type LoyaltyLedgerEntry,
  type LoyaltyRules,
  type PublicGuestOfWeek,
  type RewardCatalogItem,
  type RewardRedemptionRow,
} from "@/lib/loyalty";
import { RewardsOverview } from "@/components/RewardsOverview";
import { GuestOfTheWeek } from "@/components/GuestOfTheWeek";

type DynamicLoyaltyDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        order: (col2: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { code?: string; message?: string; status?: number } | null }>;
        };
        maybeSingle: () => Promise<{ data: unknown | null; error: { code?: string; message?: string; status?: number } | null }>;
      };
      order: (col2: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: { code?: string; message?: string; status?: number } | null }>;
      };
      limit: (n: number) => Promise<{ data: unknown[] | null; error: { code?: string; message?: string; status?: number } | null }>;
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Container wiring Butcher Block Rewards + Guest of the Week subsection.
 * Honestly distinguishes an unconfigured/unconnected loyalty backend ("coming_soon")
 * from an active live program, never showing sample balances or invented winners.
 */
export function RewardsAndGuestSection() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<FeatureAvailabilityStatus>("loading");
  const [guestAvailability, setGuestAvailability] = useState<FeatureAvailabilityStatus>("coming_soon");
  const [rules, setRules] = useState<LoyaltyRules | null>(null);
  const [ledger, setLedger] = useState<LoyaltyLedgerEntry[]>([]);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([]);
  const [publicWinner, setPublicWinner] = useState<PublicGuestOfWeek | null>(null);
  const [myNomination, setMyNomination] = useState<GuestOfWeekRecord | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const loadAll = useCallback(async () => {
    const db = supabase as unknown as DynamicLoyaltyDb;

    const [rulesRes, catalogRes, winnerRes] = await Promise.all([
      db.from("loyalty_rules").select("*").eq("id", 1).maybeSingle(),
      db.from("rewards_catalog").select("*").order("points_cost", { ascending: true }).limit(24),
      db.from("public_guest_of_the_week").select("*").limit(1),
    ]);

    const loyaltyMissing = isBackendMissingError(rulesRes.error) || isBackendMissingError(catalogRes.error);
    const winnerMissing = isBackendMissingError(winnerRes.error);

    if (winnerMissing) {
      setGuestAvailability("coming_soon");
      setPublicWinner(null);
    } else if (!winnerRes.error && Array.isArray(winnerRes.data) && winnerRes.data[0]) {
      setGuestAvailability("available");
      setPublicWinner(winnerRes.data[0] as PublicGuestOfWeek);
    } else {
      setGuestAvailability("empty");
      setPublicWinner(null);
    }

    if (loyaltyMissing) {
      setRules(null);
      setCatalog([]);
      setLedger([]);
      setRedemptions([]);
      setAvailability("coming_soon");
      return;
    }

    const loadedRules = !rulesRes.error && rulesRes.data ? (rulesRes.data as LoyaltyRules) : null;
    setRules(loadedRules);
    setCatalog(!catalogRes.error && Array.isArray(catalogRes.data) ? (catalogRes.data as RewardCatalogItem[]) : []);

    if (!loadedRules?.enabled) {
      setAvailability("coming_soon");
      return;
    }

    if (!user?.id) {
      setAvailability("requires_sign_in");
      return;
    }

    const [ledgerRes, redRes, myGotwRes] = await Promise.all([
      db.from("loyalty_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      db.from("reward_redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      db.from("guest_of_the_week").select("*").eq("user_id", user.id).order("week_start", { ascending: false }).limit(1),
    ]);

    if (!ledgerRes.error && Array.isArray(ledgerRes.data)) {
      setLedger(ledgerRes.data as LoyaltyLedgerEntry[]);
    }
    if (!redRes.error && Array.isArray(redRes.data)) {
      setRedemptions(redRes.data as RewardRedemptionRow[]);
    }
    if (!myGotwRes.error && Array.isArray(myGotwRes.data) && myGotwRes.data[0]) {
      setMyNomination(myGotwRes.data[0] as GuestOfWeekRecord);
    } else {
      setMyNomination(null);
    }

    setAvailability("available");
  }, [user?.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const balance = computeLoyaltyBalanceFromLedger(ledger);
  const progress = findNextRewardProgress(balance, catalog);

  const handleRedeem = async (reward: RewardCatalogItem) => {
    if (!user?.id || redeemingId || availability !== "available") return;
    if (balance < reward.points_cost) {
      toast.error(`You need ${reward.points_cost - balance} more points to redeem this reward.`);
      return;
    }
    setRedeemingId(reward.id);
    try {
      const db = supabase as unknown as DynamicLoyaltyDb;
      const { error } = await db.rpc("redeem_loyalty_reward", {
        p_reward_id: reward.id,
        p_idempotency_key: `redeem:${user.id}:${reward.id}:${generateClientUuid()}`,
      });
      if (error) {
        toast.error(error.message || "Could not redeem reward.");
        return;
      }
      toast.success(`Voucher issued for ${reward.title}`);
      await loadAll();
    } finally {
      setRedeemingId(null);
    }
  };

  const handleWithdrawRecognition = async () => {
    if (!myNomination || withdrawing) return;
    setWithdrawing(true);
    try {
      const db = supabase as unknown as DynamicLoyaltyDb;
      const { error } = await db.rpc("withdraw_guest_of_week", { p_gotw_id: myNomination.id });
      if (error) {
        toast.error(error.message || "Could not withdraw recognition.");
        return;
      }
      toast.success("Your public recognition has been withdrawn.");
      await loadAll();
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <RewardsOverview
      availability={availability}
      pointsBalance={balance}
      programSubtitle={
        rules?.enabled
          ? `Earn verified points on qualifying visits (min. N$ ${rules.min_qualifying_nad})`
          : undefined
      }
      nextReward={
        progress.nextReward
          ? {
              title: progress.nextReward.title,
              pointsNeeded: progress.pointsNeeded,
              percent: progress.percent,
            }
          : null
      }
      rewards={catalog}
      vouchers={redemptions}
      activity={ledger}
      redeemingId={redeemingId}
      onRedeem={handleRedeem}
      guestOfTheWeekSlot={
        <GuestOfTheWeek
          availability={guestAvailability}
          winner={publicWinner}
          canWithdraw={Boolean(
            user &&
              publicWinner &&
              myNomination?.id === publicWinner.id &&
              myNomination.status === "accepted_published",
          )}
          withdrawing={withdrawing}
          onWithdraw={() => void handleWithdrawRecognition()}
        />
      }
    />
  );
}
