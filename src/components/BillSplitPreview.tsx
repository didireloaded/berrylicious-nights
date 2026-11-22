import { useMemo, useState } from "react";
import { Info, Minus, Plus, ReceiptText, Users } from "lucide-react";
import {
  calculateByItemSplit,
  calculateEqualSplit,
  computeGroupTotalCents,
  formatCentsNAD,
  toCents,
  validateCustomSplit,
  type GroupOrderItemSummary,
  type GroupParticipantSummary,
  type SplitMethod,
} from "@/lib/billSplit";
import { cn } from "@/lib/utils";

export interface SplitPreviewCartItem {
  id: string;
  name: string;
  unitPriceNad: number;
  quantity: number;
  customizationSummary?: string;
}

export interface BillSplitPreviewProps {
  items: SplitPreviewCartItem[];
  className?: string;
}

/**
 * Local integer-cent split-bill calculator for a real cart controlled by the current user.
 * Supports Split Equally, Split by Ordered Items, and Custom Split.
 * Strictly a local calculation preview — never a payment, settled bill, or shared server record.
 */
export function BillSplitPreview({ items, className }: BillSplitPreviewProps) {
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [dinerCount, setDinerCount] = useState<number>(2);
  const [dinerNames, setDinerNames] = useState<Record<number, string>>({
    0: "You",
    1: "Guest 2",
  });
  const [itemOwners, setItemOwners] = useState<Record<string, string>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const participants: GroupParticipantSummary[] = useMemo(
    () =>
      Array.from({ length: dinerCount }, (_, idx) => ({
        id: `diner-${idx}`,
        display_name: dinerNames[idx]?.trim() || (idx === 0 ? "You" : `Guest ${idx + 1}`),
        role: idx === 0 ? "host" : "member",
      })),
    [dinerCount, dinerNames],
  );

  const normalizedItems: GroupOrderItemSummary[] = useMemo(
    () =>
      items.map((item) => {
        const ownerId = itemOwners[item.id];
        const validOwner = participants.some((p) => p.id === ownerId) ? ownerId : participants[0].id;
        return {
          id: item.id,
          participant_id: validOwner,
          menu_item_id: item.id,
          item_name: item.name,
          unit_price_cents: toCents(item.unitPriceNad),
          quantity: item.quantity,
          locked: false,
        };
      }),
    [items, itemOwners, participants],
  );

  const totalCents = useMemo(() => computeGroupTotalCents(normalizedItems), [normalizedItems]);

  const equalAllocations = useMemo(
    () => calculateEqualSplit(participants.map((p) => p.id), totalCents),
    [totalCents, participants],
  );

  const byItemAllocations = useMemo(
    () => calculateByItemSplit(participants.map((p) => p.id), normalizedItems),
    [normalizedItems, participants],
  );

  const customValidation = useMemo(() => {
    const inputs = participants.map((p) => {
      const parsed = Number.parseFloat(customAmounts[p.id] ?? "0");
      return {
        participant_id: p.id,
        amount_cents: Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0,
      };
    });
    return {
      inputs,
      check: validateCustomSplit(inputs, totalCents),
    };
  }, [participants, customAmounts, totalCents]);

  const activeAllocations =
    method === "equal"
      ? equalAllocations
      : method === "by_item"
        ? byItemAllocations
        : customValidation.inputs;

  const allocationById = new Map(activeAllocations.map((a) => [a.participant_id, a.amount_cents]));

  if (items.length === 0) {
    return (
      <div className={cn("rounded-[22px] border border-white/10 bg-[#242424] p-5 text-center", className)}>
        <ReceiptText className="mx-auto h-7 w-7 text-[#A3A3A3]" aria-hidden="true" />
        <p className="mt-3 text-[15px] font-bold text-white">Add items to preview a split</p>
        <p className="mt-1 text-[14px] leading-relaxed text-[#A3A3A3]">
          Once dishes or drinks are in your cart, you can preview equal, by-item, or custom shares here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Honest Non-Payment Preview Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-[#1B1B1B] px-3.5 py-3 text-[13px] leading-relaxed text-[#C4C4C4]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
        <p>
          Calculation preview only — not a payment, settled bill, or shared server record. Settle your final bill with your Butcher Block server.
        </p>
      </div>

      {/* People Counter */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#242424] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-white">People splitting</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease people splitting"
            disabled={dinerCount <= 2}
            onClick={() => setDinerCount((n) => Math.max(2, n - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#181818] text-white disabled:opacity-35"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <output aria-label="Number of people splitting" className="min-w-[26px] text-center text-[16px] font-extrabold tabular-nums text-white">
            {dinerCount}
          </output>
          <button
            type="button"
            aria-label="Increase people splitting"
            disabled={dinerCount >= 10}
            onClick={() => setDinerCount((n) => Math.min(10, n + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F] text-white disabled:opacity-35"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Split Method Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#181818] p-1" role="group" aria-label="Bill split method">
        {(
          [
            { id: "equal", label: "Equally" },
            { id: "by_item", label: "By items" },
            { id: "custom", label: "Custom" },
          ] as const
        ).map((m) => {
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => setMethod(m.id)}
              className={cn(
                "min-h-[44px] rounded-xl px-2 text-[13px] font-bold transition-colors",
                active ? "bg-[#FF5A1F] text-white" : "text-[#A3A3A3] hover:text-white",
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* By-item assignment controls */}
      {method === "by_item" && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
            Assign cart items
          </p>
          {items.map((item) => {
            const assignedId = itemOwners[item.id] ?? participants[0].id;
            const lineCents = toCents(item.unitPriceNad) * item.quantity;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#242424] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-white">
                    {item.quantity}× {item.name}
                  </p>
                  <p className="text-[12px] tabular-nums text-[#A3A3A3]">{formatCentsNAD(lineCents)}</p>
                </div>
                <select
                  aria-label={`Assign ${item.name} to guest`}
                  value={participants.some((p) => p.id === assignedId) ? assignedId : participants[0].id}
                  onChange={(e) =>
                    setItemOwners((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  className="min-h-[40px] shrink-0 rounded-xl border border-white/10 bg-[#181818] px-2.5 text-[13px] font-semibold text-white"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-Person Breakdown */}
      <div className="rounded-[22px] border border-white/10 bg-[#242424] p-4 space-y-3">
        <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
          <span className="text-[14px] font-semibold text-[#A3A3A3]">Cart total</span>
          <span className="text-[20px] font-extrabold tabular-nums text-[#FF5A1F]">
            {formatCentsNAD(totalCents)}
          </span>
        </div>

        <div className="space-y-2.5">
          {participants.map((p, idx) => {
            const shareCents = allocationById.get(p.id) ?? 0;
            return (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  aria-label={`Guest ${idx + 1} name`}
                  maxLength={24}
                  value={dinerNames[idx] ?? p.display_name}
                  onChange={(e) =>
                    setDinerNames((prev) => ({ ...prev, [idx]: e.target.value }))
                  }
                  className="min-h-[40px] w-36 rounded-xl border border-white/10 bg-[#181818] px-3 text-[14px] font-semibold text-white focus:border-[#FF5A1F] focus:outline-none"
                />

                {method === "custom" ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-[#A3A3A3]">N$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      inputMode="decimal"
                      aria-label={`Custom amount for ${p.display_name}`}
                      value={customAmounts[p.id] ?? ""}
                      onChange={(e) =>
                        setCustomAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      placeholder="0.00"
                      className="min-h-[40px] w-28 rounded-xl border border-white/10 bg-[#181818] px-3 text-right text-[14px] font-bold tabular-nums text-white focus:border-[#FF5A1F] focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-[16px] font-extrabold tabular-nums text-white">
                    {formatCentsNAD(shareCents)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {method === "custom" && (
          <div
            role="status"
            className={cn(
              "rounded-xl px-3 py-2 text-[13px] font-semibold",
              customValidation.check.ok
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-200",
            )}
          >
            {customValidation.check.ok
              ? `Custom amounts match the cart total (${formatCentsNAD(totalCents)}).`
              : "error" in customValidation.check
                ? customValidation.check.error
                : ""}
          </div>
        )}
      </div>
    </div>
  );
}
