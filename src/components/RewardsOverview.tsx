import { useState, type ReactNode } from "react";
import { Gift, History, Ticket } from "lucide-react";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import type {
  LoyaltyLedgerEntry,
  RewardCatalogItem,
  RewardRedemptionRow,
} from "@/lib/loyalty";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { cn } from "@/lib/utils";

export interface RewardsOverviewProps {
  availability: FeatureAvailabilityStatus;
  pointsBalance?: number;
  programSubtitle?: string;
  nextReward?: {
    title: string;
    pointsNeeded: number;
    percent: number;
  } | null;
  rewards?: RewardCatalogItem[];
  vouchers?: RewardRedemptionRow[];
  activity?: LoyaltyLedgerEntry[];
  redeemingId?: string | null;
  onRedeem?: (reward: RewardCatalogItem) => void;
  /** Guest of the Week subsection rendered inside the Rewards experience */
  guestOfTheWeekSlot?: ReactNode;
}

/**
 * Premium Butcher Block Rewards membership overview.
 * Never fabricates points balances, reward tiers, or earning claims when
 * the loyalty backend is not active.
 */
export function RewardsOverview({
  availability,
  pointsBalance = 0,
  programSubtitle,
  nextReward,
  rewards = [],
  vouchers = [],
  activity = [],
  redeemingId = null,
  onRedeem,
  guestOfTheWeekSlot,
}: RewardsOverviewProps) {
  const [subTab, setSubTab] = useState<"rewards" | "vouchers" | "activity">("rewards");
  const catalogById = new Map(rewards.map((c) => [c.id, c]));

  return (
    <section
      id="rewards"
      aria-labelledby="bb-rewards-heading"
      className="rounded-[24px] border border-white/10 bg-[#242424] p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="bb-rewards-heading" className="font-display text-[18px] font-extrabold tracking-[-0.025em] text-white">
              Butcher Block Rewards
            </h2>
            <p className="mt-0.5 text-[14px] text-[#A3A3A3]">
              {availability === "available"
                ? programSubtitle || "Your verified Butcher Block membership"
                : "Our dining membership is preparing to launch"}
            </p>
          </div>
        </div>

        {availability === "available" && (
          <div className="shrink-0 text-right">
            <p className="font-display text-[28px] font-extrabold leading-none tabular-nums text-[#FF5A1F]">
              {pointsBalance}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
              points
            </p>
          </div>
        )}
      </div>

      {/* Honest availability state when loyalty backend is not connected */}
      {availability === "loading" && (
        <FeatureAvailabilityState
          compact
          status="loading"
          title="Checking membership status"
          description="Loading Butcher Block Rewards."
          className="bg-[#1B1B1B]"
        />
      )}

      {availability === "requires_sign_in" && (
        <FeatureAvailabilityState
          compact
          status="requires_sign_in"
          title="Sign in to access Butcher Block Rewards"
          description="Membership points and rewards are tied to your Butcher Block account once the program launches."
          primaryAction={{ label: "Sign in", to: "/auth" }}
          className="bg-[#1B1B1B]"
        />
      )}

      {(availability === "coming_soon" || availability === "temporarily_unavailable" || availability === "error") && (
        <FeatureAvailabilityState
          compact
          status={availability}
          title="Butcher Block Rewards is coming soon"
          description="Soon you'll earn verified points on qualifying visits and redeem approved Butcher Block rewards directly from your profile. Points are not yet accruing."
          className="bg-[#1B1B1B]"
        />
      )}

      {/* Connected Membership View */}
      {availability === "available" && (
        <>
          {nextReward && (
            <div className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4">
              <div className="flex items-center justify-between gap-2 text-[14px]">
                <span className="truncate font-semibold text-white">Next: {nextReward.title}</span>
                <span className="shrink-0 font-bold tabular-nums text-[#FF5A1F]">
                  {nextReward.pointsNeeded === 0 ? "Ready to redeem" : `${nextReward.pointsNeeded} pts to go`}
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#303030]">
                <div
                  className="h-full rounded-full bg-[#FF5A1F] transition-all"
                  style={{ width: `${nextReward.percent}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1 rounded-full bg-[#181818] p-1">
            {(
              [
                { id: "rewards", label: "Rewards", icon: Gift },
                { id: "vouchers", label: `Vouchers (${vouchers.filter((r) => r.status === "issued").length})`, icon: Ticket },
                { id: "activity", label: "History", icon: History },
              ] as const
            ).map((t) => {
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={cn(
                    "min-h-[40px] rounded-full px-2 text-[13px] font-semibold transition-colors",
                    active ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {subTab === "rewards" && (
            rewards.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[14px] leading-relaxed text-[#A3A3A3]">
                No rewards have been published yet. Approved Butcher Block rewards will appear here once active.
              </p>
            ) : (
              <div className="space-y-2.5">
                {rewards.map((reward) => {
                  const affordable = pointsBalance >= reward.points_cost;
                  return (
                    <div
                      key={reward.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-white">{reward.title}</p>
                        {reward.description && (
                          <p className="mt-0.5 text-[13px] text-[#A3A3A3]">{reward.description}</p>
                        )}
                        <p className="mt-1 text-[13px] font-bold tabular-nums text-[#FF5A1F]">
                          {reward.points_cost} pts
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!affordable || redeemingId === reward.id || !onRedeem}
                        onClick={() => onRedeem?.(reward)}
                        className="min-h-[44px] shrink-0 rounded-full bg-[#FF5A1F] px-4 text-[13px] font-bold text-white hover:bg-[#E84D15] disabled:bg-[#303030] disabled:text-[#737373]"
                      >
                        {redeemingId === reward.id ? "Issuing…" : "Redeem"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {subTab === "vouchers" && (
            vouchers.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[14px] leading-relaxed text-[#A3A3A3]">
                Redeemed reward vouchers will appear here with your staff verification code.
              </p>
            ) : (
              <div className="space-y-2.5">
                {vouchers.map((red) => (
                  <div
                    key={red.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-white">
                        {catalogById.get(red.reward_id)?.title ?? "Butcher Block Reward"}
                      </p>
                      <p className="mt-0.5 font-mono text-[14px] font-bold text-[#FF5A1F]">
                        {red.redemption_code}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#303030] px-2.5 py-1 text-[11px] font-bold uppercase text-[#A3A3A3]">
                      {red.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {subTab === "activity" && (
            activity.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[14px] leading-relaxed text-[#A3A3A3]">
                Reward history will appear here once qualifying visits are recorded.
              </p>
            ) : (
              <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#1B1B1B] px-4">
                {activity.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">
                        {row.note || row.entry_type}
                      </p>
                      <p className="text-[12px] text-[#A3A3A3]">
                        {new Date(row.created_at).toLocaleDateString("en-GB", {
                          timeZone: "Africa/Windhoek",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[14px] font-bold tabular-nums",
                        row.points > 0 ? "text-emerald-400" : "text-[#A3A3A3]",
                      )}
                    >
                      {row.points > 0 ? `+${row.points}` : row.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Guest of the Week subsection inside Rewards */}
      {guestOfTheWeekSlot && (
        <div className="border-t border-white/10 pt-5">{guestOfTheWeekSlot}</div>
      )}
    </section>
  );
}
