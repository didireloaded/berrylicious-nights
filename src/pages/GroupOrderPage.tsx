import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  LogOut,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  Send,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTableSession } from "@/context/TableSessionContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { menuItems } from "@/data/menu";
import { generateClientUuid } from "@/lib/supabaseArrivalInsert";
import { isBackendMissingError } from "@/lib/featureAvailability";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import {
  calculateByItemSplit,
  calculateEqualSplit,
  canModifyGroupItem,
  computeGroupTotalCents,
  formatCentsNAD,
  toCents,
  validateCustomSplit,
  type BillAllocationInput,
  type GroupOrderItemSummary,
  type GroupParticipantSummary,
  type SplitMethod,
} from "@/lib/billSplit";
import { cn } from "@/lib/utils";

interface GroupStatePayload {
  found: boolean;
  authorized?: boolean;
  expired?: boolean;
  status?: string;
  table_display_name?: string;
  invite_code?: string;
  group?: {
    id: string;
    invite_code: string;
    table_display_name: string;
    status: string;
    invite_expires_at: string;
    submitted_order_id: string | null;
  };
  me?: {
    id: string;
    display_name: string;
    role: "host" | "member";
  } | null;
  participants?: GroupParticipantSummary[];
  items?: GroupOrderItemSummary[];
  allocations?: {
    id: string;
    participant_id: string;
    split_method: SplitMethod;
    amount_cents: number;
    bill_total_cents: number;
    payment_status: "unpaid" | "settled" | "void";
    settled_at: string | null;
    settlement_reference: string | null;
  }[];
}

type DynamicGroupRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export default function GroupOrderPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { session: tableSession, guestKey } = useTableSession();
  const { isUnavailable } = useMenuAvailability();

  const isCreateMode = !inviteCode || inviteCode === "new";
  const [displayName, setDisplayName] = useState(
    () =>
      profile?.display_name ||
      user?.user_metadata?.full_name ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("butcher-block-guest-name") || "" : ""),
  );
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(!isCreateMode);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [state, setState] = useState<GroupStatePayload | null>(null);
  const [activeTab, setActiveTab] = useState<"order" | "split">("order");
  const [showQr, setShowQr] = useState(false);
  const [searchMenu, setSearchMenu] = useState("");
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const submitKeyRef = useRef<string | null>(null);

  // Split bill controls
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("by_item");
  const [selectedEqualIds, setSelectedEqualIds] = useState<string[]>([]);
  const [customInputsNad, setCustomInputsNad] = useState<Record<string, string>>({});
  const [savingSplit, setSavingSplit] = useState(false);

  const rpc = supabase as unknown as DynamicGroupRpc;

  const loadGroupState = useCallback(async () => {
    if (isCreateMode || !inviteCode) return;
    const { data, error } = await rpc.rpc("get_group_order_state", {
      p_invite_code: inviteCode,
      p_guest_key: guestKey,
    });
    if (error && isBackendMissingError(error)) {
      setBackendUnavailable(true);
      setLoading(false);
      return;
    }
    if (!error && data && typeof data === "object") {
      const payload = data as GroupStatePayload;
      setState(payload);
      if (payload.participants && selectedEqualIds.length === 0) {
        setSelectedEqualIds(payload.participants.map((p) => p.id));
      }
    }
    setLoading(false);
  }, [isCreateMode, inviteCode, guestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isCreateMode || !inviteCode) return;
    setLoading(true);
    void loadGroupState();

    const channel = supabase
      .channel(`group-order-${inviteCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_orders" }, () => void loadGroupState())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_participants" }, () => void loadGroupState())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_order_items" }, () => void loadGroupState())
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_allocations" }, () => void loadGroupState())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isCreateMode, inviteCode, loadGroupState]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableSession || creating) return;
    setCreating(true);
    try {
      const { data, error } = await rpc.rpc("create_group_order", {
        p_session_id: tableSession.sessionId,
        p_session_token: tableSession.sessionToken,
        p_display_name: displayName.trim() || "Table Host",
        p_guest_key: guestKey,
      });
      if (error || !data || typeof data !== "object") {
        if (error && isBackendMissingError(error)) {
          setBackendUnavailable(true);
          return;
        }
        toast.error("Shared group ordering isn't available right now.");
        return;
      }
      const code = (data as { invite_code?: string }).invite_code;
      if (code) {
        toast.success("Group order created — share the link or QR code with your table");
        navigate(`/group/${code}`, { replace: true });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || joining) return;
    const cleaned = displayName.trim();
    if (!cleaned) {
      toast.error("Please enter your name so your table knows which dishes are yours.");
      return;
    }
    setJoining(true);
    try {
      const { error } = await rpc.rpc("join_group_order", {
        p_invite_code: inviteCode,
        p_display_name: cleaned,
        p_guest_key: guestKey,
      });
      if (error) {
        toast.error(error.message || "Could not join group order.");
        return;
      }
      try {
        localStorage.setItem("butcher-block-guest-name", cleaned);
      } catch {
        /* ignore */
      }
      toast.success("Joined table group order");
      await loadGroupState();
    } finally {
      setJoining(false);
    }
  };

  const handleAddMenuItem = async (item: (typeof menuItems)[number]) => {
    if (!state?.group?.id) return;
    if (isUnavailable(item.id) || item.priceLabel) {
      toast.error("This item is unavailable for online ordering.");
      return;
    }
    const basePrice = item.variations?.[0]?.price ?? item.price;
    const defaultWeight = item.variations?.[0]?.size;
    const { error } = await rpc.rpc("add_group_order_item", {
      p_group_order_id: state.group.id,
      p_menu_item_id: item.id,
      p_item_name: item.name,
      p_unit_price_cents: toCents(basePrice),
      p_quantity: 1,
      p_modifiers: defaultWeight ? { weight: defaultWeight } : {},
      p_note: null,
      p_guest_key: guestKey,
    });
    if (error) {
      toast.error(error.message || "Could not add item to group order.");
      return;
    }
    toast.success(`Added ${item.name} to shared table order`);
    await loadGroupState();
  };

  const handleUpdateQty = async (itemId: string, nextQty: number) => {
    const { error } = await rpc.rpc("update_group_order_item", {
      p_item_id: itemId,
      p_quantity: nextQty,
      p_guest_key: guestKey,
    });
    if (error) {
      toast.error(error.message || "Could not update item.");
      return;
    }
    await loadGroupState();
  };

  const handleLeaveGroup = async () => {
    if (!state?.group?.id) return;
    const { error } = await rpc.rpc("leave_group_order", {
      p_group_order_id: state.group.id,
      p_guest_key: guestKey,
    });
    if (error) {
      toast.error(error.message || "Could not leave group order.");
      return;
    }
    toast.success("You left the group order and your unsubmitted items were removed.");
    navigate("/menu");
  };

  const handleSubmitGroup = async () => {
    if (!state?.group?.id || submittingGroup) return;
    setSubmittingGroup(true);
    try {
      if (!submitKeyRef.current) {
        submitKeyRef.current = `grp-submit:${state.group.id}:${generateClientUuid()}`;
      }
      const { data, error } = await rpc.rpc("submit_group_order", {
        p_group_order_id: state.group.id,
        p_idempotency_key: submitKeyRef.current,
        p_guest_key: guestKey,
      });
      if (error) {
        toast.error(error.message || "Could not submit group order.");
        return;
      }
      submitKeyRef.current = null;
      toast.success("Group order sent to the Butcher Block kitchen!");
      const orderId = (data as { order_id?: string } | null)?.order_id;
      await loadGroupState();
      if (orderId) {
        setActiveTab("split");
      }
    } finally {
      setSubmittingGroup(false);
    }
  };

  const participants = useMemo(() => state?.participants ?? [], [state?.participants]);
  const items = useMemo(() => state?.items ?? [], [state?.items]);
  const allocations = useMemo(() => state?.allocations ?? [], [state?.allocations]);
  const me = state?.me ?? null;
  const group = state?.group ?? null;

  const participantById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const groupTotalCents = useMemo(() => computeGroupTotalCents(items), [items]);
  const mySubtotalCents = useMemo(
    () => (me ? computeGroupTotalCents(items.filter((i) => i.participant_id === me.id)) : 0),
    [items, me],
  );

  const filteredMenu = useMemo(() => {
    const q = searchMenu.trim().toLowerCase();
    const orderable = menuItems.filter((m) => !m.priceLabel && !isUnavailable(m.id));
    if (!q) return orderable.slice(0, 12);
    return orderable
      .filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
      .slice(0, 16);
  }, [searchMenu, isUnavailable]);

  const computedPreviewAllocations = useMemo((): BillAllocationInput[] => {
    if (participants.length === 0) return [];
    if (splitMethod === "by_item") {
      return calculateByItemSplit(
        participants.map((p) => p.id),
        items,
      );
    }
    if (splitMethod === "equal") {
      const targetIds = selectedEqualIds.length > 0 ? selectedEqualIds : participants.map((p) => p.id);
      return calculateEqualSplit(targetIds, groupTotalCents);
    }
    return participants.map((p) => ({
      participant_id: p.id,
      amount_cents: toCents(Number(customInputsNad[p.id] ?? "0") || 0),
    }));
  }, [splitMethod, participants, items, selectedEqualIds, groupTotalCents, customInputsNad]);

  const customValidation = useMemo(() => {
    if (splitMethod !== "custom") return { ok: true as const, allocatedCents: groupTotalCents };
    return validateCustomSplit(computedPreviewAllocations, groupTotalCents);
  }, [splitMethod, computedPreviewAllocations, groupTotalCents]);

  const handleSaveSplit = async () => {
    if (!group?.id || savingSplit) return;
    if ("error" in customValidation) {
      toast.error(customValidation.error);
      return;
    }
    setSavingSplit(true);
    try {
      const { error } = await rpc.rpc("save_group_bill_split", {
        p_group_order_id: group.id,
        p_split_method: splitMethod,
        p_allocations: computedPreviewAllocations,
        p_guest_key: guestKey,
      });
      if (error) {
        toast.error(error.message || "Could not save split bill allocation.");
        return;
      }
      toast.success("Bill split saved — show each share to your waiter to settle at the table.");
      await loadGroupState();
    } finally {
      setSavingSplit(false);
    }
  };

  const shareUrl =
    group?.invite_code && typeof window !== "undefined"
      ? `${window.location.origin}/group/${group.invite_code}`
      : "";

  const copyInvite = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${group?.table_display_name ?? "Butcher Block"} Group Order`,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Invite link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  if (backendUnavailable) {
    return (
      <div className="min-h-dvh bg-[#121212] px-5 pb-32 pt-[max(32px,env(safe-area-inset-top,0px))] text-white lg:pb-16">
        <div className="mx-auto max-w-[520px]">
          <FeatureAvailabilityState
            status="coming_soon"
            title="Shared group ordering is coming soon"
            description="Multi-phone shared table orders aren't connected yet. You can still build an order in your Cart and preview split bills right away."
            primaryAction={{ label: "Open Cart & Split Preview", to: "/cart" }}
            secondaryAction={{ label: "Browse Menu", to: "/menu" }}
          />
        </div>
      </div>
    );
  }

  // --- CREATE MODE ---
  if (isCreateMode) {
    return (
      <div className="min-h-dvh bg-[#121212] px-5 pb-32 pt-[max(24px,env(safe-area-inset-top,0px))] text-white lg:pb-16">
        <div className="mx-auto max-w-[520px]">
          <Link
            to="/menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white"
            aria-label="Back to menu"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <h1 className="mt-5 font-display text-[28px] font-extrabold tracking-[-0.035em] text-white">
            Group Table Ordering
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#A3A3A3]">
            Invite friends at your Butcher Block table to add their own steaks, drinks, and sides from their own phones — then split the bill accurately.
          </p>

          {!tableSession ? (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-[#242424] p-5 space-y-3">
              <p className="text-[15px] font-bold text-white">Scan your table QR code first</p>
              <p className="text-[13px] leading-relaxed text-[#A3A3A3]">
                Group ordering requires an active table session so the kitchen knows exactly which table to serve. Scan the Butcher Block placard on your table to start.
              </p>
              <Link
                to="/menu"
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[14px] font-bold text-white"
              >
                Back to Menu
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="mt-6 rounded-[24px] border border-white/10 bg-[#242424] p-5 space-y-4">
              <div className="rounded-2xl border border-[#FF5A1F]/30 bg-[#FF5A1F]/10 px-4 py-3 text-[13px] font-semibold text-white">
                Table: {tableSession.displayName} · {tableSession.area}
              </div>

              <div>
                <label htmlFor="host-name" className="mb-1.5 block text-[13px] font-semibold text-white">
                  Your name (Table Host)
                </label>
                <input
                  id="host-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white sm:text-[14px]"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-50"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                {creating ? "Creating group…" : "Create Group Order & Invite Code"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- LOADING / NOT FOUND / JOIN GATE ---
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#121212] text-[14px] text-[#A3A3A3]">
        Loading group order…
      </div>
    );
  }

  if (!state?.found) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#121212] px-6 text-center text-white">
        <p className="text-[18px] font-bold">Group order not found</p>
        <p className="mt-1 text-[14px] text-[#A3A3A3]">Check the invite code or ask your table host for a fresh QR code.</p>
        <Link to="/menu" className="mt-5 inline-flex min-h-[46px] items-center rounded-full bg-[#FF5A1F] px-6 text-[14px] font-bold text-white">
          Explore Menu
        </Link>
      </div>
    );
  }

  if (!state.authorized) {
    return (
      <div className="min-h-dvh bg-[#121212] px-5 pb-32 pt-[max(32px,env(safe-area-inset-top,0px))] text-white">
        <div className="mx-auto max-w-[460px] rounded-[24px] border border-white/10 bg-[#242424] p-6 space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 text-[12px] font-bold text-[#FF5A1F]">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {state.table_display_name ?? "Table Group Order"}
          </span>
          <h1 className="font-display text-[22px] font-extrabold text-white">Join Group Order</h1>
          {state.expired || state.status !== "open" ? (
            <p className="text-[14px] text-red-300">
              {state.expired
                ? "This invitation has expired."
                : "This group order has already been submitted and is closed to new participants."}
            </p>
          ) : (
            <form onSubmit={handleJoinGroup} className="space-y-4">
              <p className="text-[13px] text-[#A3A3A3]">
                Enter your name to add dishes to this table&apos;s shared order. Only participants at this table can see or edit items.
              </p>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your first name"
                className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white sm:text-[14px]"
              />
              <button
                type="submit"
                disabled={joining}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[14px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join Table Order"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- AUTHORIZED LIVE GROUP COLLABORATION VIEW ---
  const isHost = me?.role === "host";
  const isOpen = group?.status === "open";
  const settledCents = allocations
    .filter((a) => a.payment_status === "settled")
    .reduce((sum, a) => sum + a.amount_cents, 0);
  const outstandingCents = Math.max(0, groupTotalCents - settledCents);

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white lg:pb-16">
      <div className="mx-auto max-w-[600px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-3xl lg:pt-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#FF5A1F]">
              {group?.table_display_name} · {group?.status}
            </p>
            <h1 className="font-display text-[24px] font-extrabold tracking-[-0.03em] text-white">
              Group Order
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              aria-label="Show invite QR code"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
            >
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-[#242424] px-4 text-[13px] font-semibold text-white hover:bg-[#303030]"
            >
              <Share2 className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
              Invite
            </button>
          </div>
        </header>

        {showQr && shareUrl && (
          <div className="mt-4 rounded-[22px] border border-white/10 bg-[#242424] p-5 text-center space-y-3">
            <p className="text-[14px] font-bold text-white">Scan to join {group?.table_display_name}</p>
            <div className="inline-block rounded-2xl bg-white p-3">
              <QRCodeSVG value={shareUrl} size={160} level="M" />
            </div>
            <p className="font-mono text-[13px] font-bold text-[#FF5A1F]">{group?.invite_code}</p>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#303030] px-4 text-[12px] font-semibold text-white"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy link
            </button>
          </div>
        )}

        {/* Participants & Subtotals Summary */}
        <section className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[20px] border border-white/10 bg-[#242424] p-4">
            <p className="text-[12px] text-[#A3A3A3]">Your subtotal</p>
            <p className="mt-0.5 text-[20px] font-extrabold tabular-nums text-white">
              {formatCentsNAD(mySubtotalCents)}
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-[#242424] p-4">
            <p className="text-[12px] text-[#A3A3A3]">Group total ({participants.length} seated)</p>
            <p className="mt-0.5 text-[20px] font-extrabold tabular-nums text-[#FF5A1F]">
              {formatCentsNAD(groupTotalCents)}
            </p>
          </div>
        </section>

        {/* Order vs Split Bill Switcher */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#242424] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("order")}
            className={cn(
              "min-h-[42px] rounded-full text-[13px] font-bold transition-colors",
              activeTab === "order" ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
            )}
          >
            Shared Order ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("split")}
            className={cn(
              "min-h-[42px] rounded-full text-[13px] font-bold transition-colors",
              activeTab === "split" ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
            )}
          >
            Split the Bill
          </button>
        </div>

        {activeTab === "order" ? (
          <div className="mt-5 space-y-5">
            {group?.submitted_order_id && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-emerald-500/35 bg-emerald-500/10 p-4">
                <div>
                  <p className="text-[14px] font-bold text-white">Submitted to Kitchen</p>
                  <p className="text-[12px] text-emerald-200">
                    Items are locked. Need another round of drinks or desserts? Start a new batch.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/order/${group.submitted_order_id}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#FF5A1F] px-4 text-[12px] font-bold text-white"
                  >
                    <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" /> Track Kitchen
                  </Link>
                  <Link
                    to="/group/new"
                    className="inline-flex min-h-[40px] items-center rounded-full border border-white/15 bg-[#242424] px-3.5 text-[12px] font-semibold text-white"
                  >
                    New Round
                  </Link>
                </div>
              </div>
            )}

            {/* Shared Items List */}
            <section className="space-y-2.5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                Table Items
              </h2>
              {items.length === 0 ? (
                <p className="rounded-[20px] border border-white/10 bg-[#242424] p-5 text-[14px] text-[#A3A3A3]">
                  No items yet — everyone at the table can add dishes below.
                </p>
              ) : (
                items.map((item) => {
                  const owner = participantById.get(item.participant_id);
                  const editable = canModifyGroupItem(item, me?.id, group?.status ?? "");
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#242424] p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-white">{item.item_name}</p>
                        <p className="text-[12px] text-[#A3A3A3]">
                          {owner?.display_name ?? "Guest"} · {formatCentsNAD(item.unit_price_cents * item.quantity)}
                        </p>
                      </div>
                      {editable ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`Decrease ${item.item_name}`}
                            onClick={() => void handleUpdateQty(item.id, item.quantity - 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#303030] text-white"
                          >
                            {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5" />}
                          </button>
                          <span className="min-w-[20px] text-center text-[13px] font-bold tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Increase ${item.item_name}`}
                            onClick={() => void handleUpdateQty(item.id, item.quantity + 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#303030] text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[12px] font-bold text-white tabular-nums">
                          ×{item.quantity}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </section>

            {/* Quick Add from Butcher Block Menu while Open */}
            {isOpen && (
              <section className="rounded-[22px] border border-white/10 bg-[#242424] p-4 space-y-3">
                <h2 className="text-[15px] font-bold text-white">Add dishes to your share</h2>
                <input
                  type="search"
                  value={searchMenu}
                  onChange={(e) => setSearchMenu(e.target.value)}
                  placeholder="Search steaks, burgers, sides, drinks…"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] sm:text-[14px]"
                />
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredMenu.map((item) => {
                    const price = item.variations?.[0]?.price ?? item.price;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#181818] px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-white">{item.name}</p>
                          <p className="text-[12px] text-[#A3A3A3]">
                            {item.category} · <span className="font-bold text-[#FF5A1F]">N$ {price}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleAddMenuItem(item)}
                          aria-label={`Add ${item.name} to group order`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F] text-white hover:bg-[#E84D15]"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Host Submit or Member Leave */}
            {isOpen && (
              <div className="space-y-2.5">
                {isHost ? (
                  <button
                    type="button"
                    disabled={items.length === 0 || submittingGroup}
                    onClick={() => void handleSubmitGroup()}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-45"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {submittingGroup
                      ? "Sending to Kitchen…"
                      : `Submit Group Order · ${formatCentsNAD(groupTotalCents)}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleLeaveGroup()}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] text-[14px] font-semibold text-[#A3A3A3] hover:text-white"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Leave group &amp; remove my items
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* SPLIT THE BILL TAB (No fake payment gateways — honest payment requests settled with staff) */
          <div className="mt-5 space-y-4">
            <div className="rounded-[20px] border border-white/10 bg-[#242424] p-4 space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#A3A3A3]">Group bill total</span>
                <span className="font-bold tabular-nums text-white">{formatCentsNAD(groupTotalCents)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#A3A3A3]">Settled with staff</span>
                <span className="font-bold tabular-nums text-emerald-400">{formatCentsNAD(settledCents)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-[15px]">
                <span className="font-bold text-white">Outstanding balance</span>
                <span className="font-extrabold tabular-nums text-[#FF5A1F]">{formatCentsNAD(outstandingCents)}</span>
              </div>
              <p className="pt-1 text-[12px] leading-relaxed text-[#A3A3A3]">
                Split amounts are payment requests to settle directly with your Butcher Block server or at the till. Only authorized staff can mark shares as paid.
              </p>
            </div>

            {isHost && (
              <section className="rounded-[22px] border border-white/10 bg-[#242424] p-4 space-y-3.5">
                <p className="text-[14px] font-bold text-white">Configure split method</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: "by_item", label: "By Item" },
                      { id: "equal", label: "Equal Split" },
                      { id: "custom", label: "Custom" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSplitMethod(m.id)}
                      className={cn(
                        "min-h-[42px] rounded-xl border text-[13px] font-semibold transition-colors",
                        splitMethod === m.id
                          ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                          : "border-white/10 bg-[#181818] text-[#A3A3A3]",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {splitMethod === "equal" && (
                  <div className="space-y-1.5">
                    <p className="text-[12px] text-[#A3A3A3]">Choose participants sharing equally:</p>
                    <div className="flex flex-wrap gap-2">
                      {participants.map((p) => {
                        const active = selectedEqualIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setSelectedEqualIds((prev) =>
                                prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                              )
                            }
                            className={cn(
                              "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold",
                              active
                                ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                                : "border-white/10 bg-[#181818] text-[#A3A3A3]",
                            )}
                          >
                            {active && <Check className="h-3.5 w-3.5 text-[#FF5A1F]" />}
                            {p.display_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {splitMethod === "custom" && (
                  <div className="space-y-2">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-white">{p.display_name}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customInputsNad[p.id] ?? ""}
                          onChange={(e) =>
                            setCustomInputsNad((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="0.00"
                          className="h-10 w-28 rounded-xl border border-white/10 bg-[#181818] px-3 text-right text-[14px] tabular-nums text-white"
                        />
                      </div>
                    ))}
                    {"error" in customValidation && (
                      <p role="alert" className="text-[12px] font-semibold text-amber-300">
                        {customValidation.error}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5 border-t border-white/10 pt-3">
                  {computedPreviewAllocations.map((a) => (
                    <div key={a.participant_id} className="flex justify-between text-[13px]">
                      <span className="text-[#C4C4C4]">{participantById.get(a.participant_id)?.display_name ?? "Guest"}</span>
                      <span className="font-bold tabular-nums text-white">{formatCentsNAD(a.amount_cents)}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={savingSplit || "error" in customValidation}
                  onClick={() => void handleSaveSplit()}
                  className="flex min-h-[46px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[14px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-45"
                >
                  {savingSplit ? "Saving…" : "Save Bill Split for Settlement"}
                </button>
              </section>
            )}

            {/* Saved Payment Requests & Settlement Status */}
            <section className="space-y-2.5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                {isHost ? "Table Payment Requests" : "Your Payment Share"}
              </h2>
              {allocations.length === 0 ? (
                <p className="rounded-[20px] border border-white/10 bg-[#242424] p-4 text-[13px] text-[#A3A3A3]">
                  Bill shares will appear here once the group host saves a split or submits the group order.
                </p>
              ) : (
                allocations.map((alloc) => {
                  const p = participantById.get(alloc.participant_id);
                  return (
                    <div
                      key={alloc.id}
                      className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#242424] p-4"
                    >
                      <div>
                        <p className="text-[14px] font-bold text-white">{p?.display_name ?? "Participant"}</p>
                        <p className="text-[12px] text-[#A3A3A3]">
                          Split: {alloc.split_method.replace("_", " ")}
                          {alloc.settlement_reference ? ` · Ref ${alloc.settlement_reference}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-extrabold tabular-nums text-[#FF5A1F]">
                          {formatCentsNAD(alloc.amount_cents)}
                        </p>
                        <span
                          className={cn(
                            "mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase",
                            alloc.payment_status === "settled"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-[#303030] text-[#A3A3A3]",
                          )}
                        >
                          {alloc.payment_status === "settled" ? "Settled" : "Pay at table"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
