import { useCallback, useEffect, useState } from "react";
import { Award, Check, Gift, History, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { generateClientUuid } from "@/lib/supabaseArrivalInsert";
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
import { cn } from "@/lib/utils";

type DynamicLoyaltyDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq?: (col: string, val: string | number | boolean) => unknown;
      order?: (col: string, opts: { ascending: boolean }) => unknown;
      limit?: (n: number) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
      maybeSingle?: () => Promise<{ data: unknown | null; error: { message?: string } | null }>;
    } & Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function RewardsAndGuestSection() {
  const { user, profile } = useAuth();
  const [subTab, setSubTab] = useState<"rewards" | "vouchers" | "activity">("rewards");
  const [rules, setRules] = useState<LoyaltyRules | null>(null);
  const [ledger, setLedger] = useState<LoyaltyLedgerEntry[]>([]);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([]);
  const [publicWinner, setPublicWinner] = useState<PublicGuestOfWeek | null>(null);
  const [myNomination, setMyNomination] = useState<GuestOfWeekRecord | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // Guest of the Week consent form state
  const [consentName, setConsentName] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [socialConsent, setSocialConsent] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    const raw = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: unknown) => {
            order: (k2: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
            maybeSingle: () => Promise<{ data: unknown | null; error: unknown }>;
          };
          order: (k2: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
          };
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };

    const [rulesRes, catalogRes, winnerRes] = await Promise.all([
      raw.from("loyalty_rules").select("*").eq("id", 1).maybeSingle(),
      raw.from("rewards_catalog").select("*").order("points_cost", { ascending: true }).limit(24),
      raw.from("public_guest_of_the_week").select("*").limit(1),
    ]);

    if (!rulesRes.error && rulesRes.data) setRules(rulesRes.data as LoyaltyRules);
    if (!catalogRes.error && Array.isArray(catalogRes.data)) {
      setCatalog(catalogRes.data as RewardCatalogItem[]);
    }
    if (!winnerRes.error && Array.isArray(winnerRes.data) && winnerRes.data[0]) {
      setPublicWinner(winnerRes.data[0] as PublicGuestOfWeek);
    } else {
      setPublicWinner(null);
    }

    if (user?.id) {
      const [ledgerRes, redRes, myGotwRes] = await Promise.all([
        raw.from("loyalty_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        raw.from("reward_redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        raw.from("guest_of_the_week").select("*").eq("user_id", user.id).order("week_start", { ascending: false }).limit(1),
      ]);
      if (!ledgerRes.error && Array.isArray(ledgerRes.data)) {
        setLedger(ledgerRes.data as LoyaltyLedgerEntry[]);
      }
      if (!redRes.error && Array.isArray(redRes.data)) {
        setRedemptions(redRes.data as RewardRedemptionRow[]);
      }
      if (!myGotwRes.error && Array.isArray(myGotwRes.data) && myGotwRes.data[0]) {
        const rec = myGotwRes.data[0] as GuestOfWeekRecord;
        setMyNomination(rec);
        setConsentName(rec.approved_display_name || profile?.display_name || "");
      } else {
        setMyNomination(null);
      }
    }
  }, [user?.id, profile?.display_name]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const balance = computeLoyaltyBalanceFromLedger(ledger);
  const progress = findNextRewardProgress(balance, catalog);
  const catalogById = new Map(catalog.map((c) => [c.id, c]));

  const handleRedeem = async (reward: RewardCatalogItem) => {
    if (!user?.id || redeemingId) return;
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
      setSubTab("vouchers");
      await loadAll();
    } finally {
      setRedeemingId(null);
    }
  };

  const handleRespondConsent = async (accept: boolean) => {
    if (!myNomination || consentSubmitting) return;
    setConsentSubmitting(true);
    try {
      const db = supabase as unknown as DynamicLoyaltyDb;
      const { error } = await db.rpc("respond_guest_of_week_consent", {
        p_gotw_id: myNomination.id,
        p_accept: accept,
        p_display_name: consentName.trim() || myNomination.approved_display_name,
        p_photo_consent: accept ? photoConsent : false,
        p_social_consent: accept ? socialConsent : false,
        p_photo_url: null,
      });
      if (error) {
        toast.error(error.message || "Could not update your recognition choice.");
        return;
      }
      toast.success(
        accept ? "Thank you — your Guest of the Week recognition is now published." : "Invitation declined.",
      );
      await loadAll();
    } finally {
      setConsentSubmitting(false);
    }
  };

  const handleWithdrawRecognition = async () => {
    if (!myNomination || consentSubmitting) return;
    setConsentSubmitting(true);
    try {
      const db = supabase as unknown as DynamicLoyaltyDb;
      const { error } = await db.rpc("withdraw_guest_of_week", { p_gotw_id: myNomination.id });
      if (error) {
        toast.error(error.message || "Could not withdraw recognition.");
        return;
      }
      toast.success("Your Guest of the Week recognition has been withdrawn from public display.");
      await loadAll();
    } finally {
      setConsentSubmitting(false);
    }
  };

  return (
    <div id="rewards" className="space-y-4">
      {/* Butcher Block Rewards Card */}
      {user && (
        <section className="rounded-[24px] border border-white/10 bg-[#242424] p-5" aria-labelledby="bb-rewards-heading">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="bb-rewards-heading" className="text-[17px] font-bold text-white">
                  Butcher Block Rewards
                </h2>
                <p className="text-[13px] text-[#A3A3A3]">
                  {rules?.enabled
                    ? `Earn points on qualifying paid orders (min. N$ ${rules.min_qualifying_nad})`
                    : "Auditable points ledger — earning activates once management enables rules"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[24px] font-extrabold leading-none tabular-nums text-[#FF5A1F]">{balance}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#A3A3A3]">pts</p>
            </div>
          </div>

          {progress.nextReward && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#1B1B1B] p-3.5">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate font-semibold text-white">Next: {progress.nextReward.title}</span>
                <span className="shrink-0 font-bold tabular-nums text-[#FF5A1F]">
                  {progress.pointsNeeded === 0 ? "Ready to redeem" : `${progress.pointsNeeded} pts to go`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#303030]">
                <div className="h-full rounded-full bg-[#FF5A1F] transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}

          {/* Sub-tabs */}
          <div className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-[#181818] p-1">
            {(
              [
                { id: "rewards", label: "Rewards", icon: Gift },
                { id: "vouchers", label: `Vouchers (${redemptions.filter((r) => r.status === "issued").length})`, icon: Ticket },
                { id: "activity", label: "Activity", icon: History },
              ] as const
            ).map((t) => {
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={cn(
                    "min-h-[38px] rounded-full px-2 text-[12px] font-semibold transition-colors",
                    active ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {subTab === "rewards" && (
              catalog.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[13px] text-[#A3A3A3]">
                  No active rewards have been published by Butcher Block management yet. Your verified points balance will be ready as soon as approved rewards are listed.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {catalog.map((reward) => {
                    const affordable = balance >= reward.points_cost;
                    return (
                      <div
                        key={reward.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-white">{reward.title}</p>
                          {reward.description && (
                            <p className="mt-0.5 text-[12px] text-[#A3A3A3]">{reward.description}</p>
                          )}
                          <p className="mt-1 text-[12px] font-bold tabular-nums text-[#FF5A1F]">
                            {reward.points_cost} pts
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!affordable || redeemingId === reward.id}
                          onClick={() => void handleRedeem(reward)}
                          className="min-h-[42px] shrink-0 rounded-full bg-[#FF5A1F] px-4 text-[12px] font-bold text-white hover:bg-[#E84D15] disabled:bg-[#303030] disabled:text-[#737373]"
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
              redemptions.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[13px] text-[#A3A3A3]">
                  Redeemed Butcher Block reward vouchers will appear here with your staff verification code.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {redemptions.map((red) => (
                    <div
                      key={red.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-white">
                          {catalogById.get(red.reward_id)?.title ?? "Butcher Block Reward"}
                        </p>
                        <p className="mt-0.5 font-mono text-[13px] font-bold text-[#FF5A1F]">
                          {red.redemption_code}
                        </p>
                        <p className="text-[12px] text-[#A3A3A3]">
                          {red.source === "guest_of_the_week" ? "Guest of the Week award" : `${red.points_spent} pts`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase",
                          red.status === "issued"
                            ? "bg-[#FF5A1F]/15 text-[#FF5A1F]"
                            : "bg-[#303030] text-[#A3A3A3]",
                        )}
                      >
                        {red.status}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

            {subTab === "activity" && (
              ledger.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-4 text-[13px] text-[#A3A3A3]">
                  Points activity appears automatically after qualifying orders are completed and confirmed paid.
                </p>
              ) : (
                <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#1B1B1B] px-3.5">
                  {ledger.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-white">
                          {row.note || row.entry_type}
                        </p>
                        <p className="text-[11px] text-[#A3A3A3]">
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
          </div>
        </section>
      )}

      {/* Pending Guest of the Week Opt-In Consent Prompt (for nominated user only) */}
      {user && myNomination?.status === "approved_pending_consent" && (
        <section className="rounded-[24px] border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 p-5" aria-label="Guest of the Week invitation">
          <div className="flex items-center gap-2 text-[#FF5A1F]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <p className="text-[12px] font-bold uppercase tracking-[0.12em]">You&apos;ve Been Nominated</p>
          </div>
          <h3 className="mt-1 font-display text-[19px] font-extrabold text-white">
            Butcher Block Guest of the Week
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#E5E5E5]">
            &ldquo;{myNomination.recognition_message}&rdquo;
          </p>
          <p className="mt-2 text-[13px] text-[#A3A3A3]">
            Participation is completely voluntary. Your name is only published if you accept below.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="gotw-display-name" className="mb-1 block text-[12px] font-semibold text-white">
                Public display name
              </label>
              <input
                id="gotw-display-name"
                type="text"
                value={consentName}
                onChange={(e) => setConsentName(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#181818] px-3.5 text-[14px] text-white"
              />
            </div>

            <label className="flex items-start gap-2.5 text-[13px] text-[#E5E5E5]">
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(e) => setPhotoConsent(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#FF5A1F]"
              />
              <span>Separate permission: I consent to displaying an approved photo alongside my name.</span>
            </label>

            <label className="flex items-start gap-2.5 text-[13px] text-[#E5E5E5]">
              <input
                type="checkbox"
                checked={socialConsent}
                onChange={(e) => setSocialConsent(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#FF5A1F]"
              />
              <span>Separate permission: Butcher Block may feature my approved recognition on social media.</span>
            </label>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                disabled={consentSubmitting}
                onClick={() => void handleRespondConsent(true)}
                className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#FF5A1F] px-5 text-[14px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-50"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Accept &amp; Publish
              </button>
              <button
                type="button"
                disabled={consentSubmitting}
                onClick={() => void handleRespondConsent(false)}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-white/15 bg-[#242424] px-5 text-[14px] font-semibold text-white hover:bg-[#303030] disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Published Guest of the Week Community Spotlight (only when genuinely accepted & published) */}
      {publicWinner && (
        <section className="rounded-[24px] border border-white/10 bg-[#242424] p-5" aria-labelledby="gotw-public-heading">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
              <h2 id="gotw-public-heading" className="text-[15px] font-bold text-white">
                Guest of the Week
              </h2>
            </div>
            <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[11px] font-semibold text-[#A3A3A3]">
              Week of {publicWinner.week_start}
            </span>
          </div>

          <div className="mt-3.5 flex items-start gap-3.5">
            {publicWinner.approved_photo_url && (
              <img
                src={publicWinner.approved_photo_url}
                alt={publicWinner.approved_display_name}
                className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold text-white">{publicWinner.approved_display_name}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#C4C4C4]">{publicWinner.recognition_message}</p>
              {publicWinner.reward_title && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 text-[12px] font-semibold text-[#FF5A1F]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Awarded: {publicWinner.reward_title}
                </p>
              )}
            </div>
          </div>

          {user && myNomination?.id === publicWinner.id && myNomination.status === "accepted_published" && (
            <button
              type="button"
              disabled={consentSubmitting}
              onClick={() => void handleWithdrawRecognition()}
              className="mt-4 text-[13px] font-semibold text-[#A3A3A3] underline-offset-4 hover:text-white hover:underline"
            >
              Withdraw my public recognition
            </button>
          )}
        </section>
      )}
    </div>
  );
}
