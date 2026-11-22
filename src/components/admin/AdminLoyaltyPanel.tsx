import { useCallback, useEffect, useState } from "react";
import { Award, Check, Gift, Plus, RefreshCw, ShieldCheck, SlidersHorizontal, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getWindhoekDateISO } from "@/lib/windhoekDate";
import {
  getCurrentWeekStartISO,
  type GuestOfWeekRecord,
  type LoyaltyRules,
  type RewardCatalogItem,
  type RewardRedemptionRow,
} from "@/lib/loyalty";

interface ShortlistRow {
  user_id: string;
  display_name: string;
  completed_orders: number;
  verified_reviews: number;
  loyalty_events: number;
  community_score: number;
}

export function AdminLoyaltyPanel() {
  const [rules, setRules] = useState<LoyaltyRules>({
    enabled: false,
    points_per_nad: 0.1,
    min_qualifying_nad: 100,
    excluded_categories: [],
    excluded_item_ids: [],
    award_on_reservation_arrival: false,
    reservation_bonus_points: 0,
    points_expiry_days: 365,
  });
  const [excludedCsv, setExcludedCsv] = useState("");
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [vouchers, setVouchers] = useState<RewardRedemptionRow[]>([]);
  const [shortlist, setShortlist] = useState<ShortlistRow[]>([]);
  const [winners, setWinners] = useState<GuestOfWeekRecord[]>([]);
  const [newReward, setNewReward] = useState({
    title: "",
    description: "",
    category: "dessert" as RewardCatalogItem["category"],
    points_cost: 150,
  });
  const [nominationMsg, setNominationMsg] = useState(
    "Thank you for being a warm part of the Butcher Block Steakhouse community in Windhoek.",
  );
  const [nominationRewardId, setNominationRewardId] = useState<string>("");

  const raw = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (k: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown | null; error: unknown }> };
        order: (k: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
      update: (vals: Record<string, unknown>) => { eq: (k: string, v: unknown) => Promise<{ error: { message?: string } | null }> };
      insert: (vals: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const loadAll = useCallback(async () => {
    const [rulesRes, catRes, redRes, winRes, shortRes] = await Promise.all([
      raw.from("loyalty_rules").select("*").eq("id", 1).maybeSingle(),
      raw.from("rewards_catalog").select("*").order("points_cost", { ascending: true }).limit(50),
      raw.from("reward_redemptions").select("*").order("created_at", { ascending: false }).limit(40),
      raw.from("guest_of_the_week").select("*").order("week_start", { ascending: false }).limit(12),
      raw.rpc("compute_guest_of_week_shortlist", { p_days: 30 }),
    ]);

    if (!rulesRes.error && rulesRes.data) {
      const r = rulesRes.data as LoyaltyRules;
      setRules(r);
      setExcludedCsv((r.excluded_categories ?? []).join(", "));
    }
    if (!catRes.error && Array.isArray(catRes.data)) setCatalog(catRes.data as RewardCatalogItem[]);
    if (!redRes.error && Array.isArray(redRes.data)) setVouchers(redRes.data as RewardRedemptionRow[]);
    if (!winRes.error && Array.isArray(winRes.data)) setWinners(winRes.data as GuestOfWeekRecord[]);
    if (!shortRes.error && Array.isArray(shortRes.data)) setShortlist(shortRes.data as ShortlistRow[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveRules = async () => {
    const excluded_categories = excludedCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await raw
      .from("loyalty_rules")
      .update({
        enabled: rules.enabled,
        points_per_nad: Number(rules.points_per_nad),
        min_qualifying_nad: Number(rules.min_qualifying_nad),
        excluded_categories,
        points_expiry_days: rules.points_expiry_days ? Number(rules.points_expiry_days) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) {
      toast.error(error.message || "Could not save rules (ensure Phase 3 SQL migration is applied).");
      return;
    }
    toast.success("Loyalty rules saved");
    void loadAll();
  };

  const addReward = async () => {
    if (!newReward.title.trim()) return;
    const { error } = await raw.from("rewards_catalog").insert({
      title: newReward.title.trim(),
      description: newReward.description.trim() || null,
      category: newReward.category,
      points_cost: Math.max(1, Math.floor(Number(newReward.points_cost) || 100)),
      active: true,
    });
    if (error) {
      toast.error(error.message || "Could not add reward.");
      return;
    }
    setNewReward({ title: "", description: "", category: "dessert", points_cost: 150 });
    toast.success("Approved reward added to catalog");
    void loadAll();
  };

  const toggleReward = async (item: RewardCatalogItem) => {
    const { error } = await raw
      .from("rewards_catalog")
      .update({ active: !item.active, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message || "Failed to update reward");
      return;
    }
    void loadAll();
  };

  const markVoucherUsed = async (id: string) => {
    const { error } = await raw.rpc("mark_redemption_used", { p_redemption_id: id });
    if (error) {
      toast.error(error.message || "Could not mark voucher used");
      return;
    }
    toast.success("Voucher marked used");
    void loadAll();
  };

  const nominateCandidate = async (candidate: ShortlistRow) => {
    const weekStart = getCurrentWeekStartISO(getWindhoekDateISO());
    const { error } = await raw.rpc("nominate_guest_of_week", {
      p_week_start: weekStart,
      p_user_id: candidate.user_id,
      p_display_name: candidate.display_name,
      p_recognition_message: nominationMsg.trim(),
      p_reward_id: nominationRewardId || null,
      p_score_breakdown: {
        completed_orders: candidate.completed_orders,
        verified_reviews: candidate.verified_reviews,
        loyalty_events: candidate.loyalty_events,
        community_score: candidate.community_score,
      },
    });
    if (error) {
      toast.error(error.message || "Nomination failed");
      return;
    }
    toast.success(`Consent invitation sent to ${candidate.display_name} — will only publish if they accept.`);
    void loadAll();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Butcher Block Rewards &amp; Guest of the Week</h2>
          <p className="text-xs text-muted-foreground">
            Manage earning rules, approved rewards, voucher redemption verification, and consent-gated community recognition.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* 1. Configurable Rules */}
      <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Earning Rules
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={rules.enabled}
              onChange={(e) => setRules((r) => ({ ...r, enabled: e.target.checked }))}
              className="accent-primary"
            />
            Program enabled
          </label>
          <div>
            <label className="block text-[11px] text-muted-foreground">Points per N$ 1</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={rules.points_per_nad}
              onChange={(e) => setRules((r) => ({ ...r, points_per_nad: Number(e.target.value) }))}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground">Minimum N$ spend</label>
            <input
              type="number"
              min="0"
              value={rules.min_qualifying_nad}
              onChange={(e) => setRules((r) => ({ ...r, min_qualifying_nad: Number(e.target.value) }))}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground">Expiry (days)</label>
            <input
              type="number"
              min="30"
              value={rules.points_expiry_days ?? 365}
              onChange={(e) => setRules((r) => ({ ...r, points_expiry_days: Number(e.target.value) || null }))}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-muted-foreground">Excluded categories (comma-separated)</label>
            <input
              type="text"
              value={excludedCsv}
              onChange={(e) => setExcludedCsv(e.target.value)}
              placeholder="e.g. Shooters, Wine Bottles"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
            />
          </div>
          <button
            type="button"
            onClick={() => void saveRules()}
            className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            Save rules
          </button>
        </div>
      </section>

      {/* 2. Rewards Catalog + Voucher Verification */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gift className="h-4 w-4 text-primary" /> Approved Rewards Catalog
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newReward.title}
              onChange={(e) => setNewReward((v) => ({ ...v, title: e.target.value }))}
              placeholder="Reward title (e.g. Complimentary Side)"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <input
              type="number"
              min="1"
              value={newReward.points_cost}
              onChange={(e) => setNewReward((v) => ({ ...v, points_cost: Number(e.target.value) }))}
              placeholder="Points cost"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <input
              type="text"
              value={newReward.description}
              onChange={(e) => setNewReward((v) => ({ ...v, description: e.target.value }))}
              placeholder="Eligibility / terms"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => void addReward()}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add reward
            </button>
          </div>
          <div className="space-y-1.5">
            {catalog.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold text-foreground">{c.title}</span>
                  <span className="ml-2 text-primary font-bold">{c.points_cost} pts</span>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleReward(c)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                    c.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.active ? "Active" : "Paused"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Ticket className="h-4 w-4 text-primary" /> Customer Vouchers
          </h3>
          {vouchers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reward vouchers issued yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {vouchers.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-primary">{v.redemption_code}</span>
                    <span className="ml-2 text-muted-foreground">{v.status}</span>
                  </div>
                  {v.status === "issued" && (
                    <button
                      type="button"
                      onClick={() => void markVoucherUsed(v.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300"
                    >
                      <Check className="h-3 w-3" /> Mark used
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 3. Guest of the Week Shortlist & Consent Audit */}
      <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Award className="h-4 w-4 text-primary" /> Guest of the Week (Management Approval + Customer Consent)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shortlist balances visits, completed orders, and verified reviews — never raw spend alone. Selecting a guest sends a consent invite; nothing publishes without opt-in.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={nominationMsg}
            onChange={(e) => setNominationMsg(e.target.value)}
            placeholder="Approved recognition message"
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
          />
          <select
            value={nominationRewardId}
            onChange={(e) => setNominationRewardId(e.target.value)}
            aria-label="Optional award for Guest of the Week"
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
          >
            <option value="">No attached reward (recognition only)</option>
            {catalog.filter((c) => c.active).map((c) => (
              <option key={c.id} value={c.id}>
                Attach reward: {c.title}
              </option>
            ))}
          </select>
        </div>

        {shortlist.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No eligible shortlist candidates in the last 30 days yet (requires completed orders or verified reviews).
          </p>
        ) : (
          <div className="space-y-1.5">
            {shortlist.map((cand) => (
              <div key={cand.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                <div>
                  <span className="font-bold text-foreground">{cand.display_name}</span>
                  <span className="ml-2 text-muted-foreground">
                    Score {cand.community_score} · {cand.completed_orders} orders · {cand.verified_reviews} reviews
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void nominateCandidate(cand)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Approve &amp; Invite
                </button>
              </div>
            ))}
          </div>
        )}

        {winners.length > 0 && (
          <div className="border-t border-border/40 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recognition Audit History
            </p>
            <div className="space-y-1.5">
              {winners.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-xs">
                  <span>
                    <span className="font-mono text-muted-foreground">{w.week_start}</span>{" "}
                    <span className="font-semibold text-foreground">{w.approved_display_name}</span>
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
