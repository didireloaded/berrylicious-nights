/**
 * Integer minor-currency-unit (cents) bill splitting engine & group-order authorization helpers.
 * Uses strict integer arithmetic so allocations ALWAYS sum to the exact bill total with zero floating-point drift.
 */

export type SplitMethod = "by_item" | "equal" | "custom";

export interface GroupParticipantSummary {
  id: string;
  display_name: string;
  role: "host" | "member";
  is_me?: boolean;
}

export interface GroupOrderItemSummary {
  id: string;
  participant_id: string;
  menu_item_id: string;
  item_name: string;
  unit_price_cents: number;
  quantity: number;
  modifiers?: Record<string, unknown>;
  note?: string | null;
  locked: boolean;
}

export interface BillAllocationInput {
  participant_id: string;
  amount_cents: number;
}

/** Converts a Namibian dollar amount (e.g. 335.5) into exact integer cents (33550). */
export function toCents(amountNad: number): number {
  if (!Number.isFinite(amountNad) || amountNad < 0) return 0;
  return Math.round(amountNad * 100);
}

/** Formats integer cents cleanly as Namibian Dollars (N$). */
export function formatCentsNAD(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const whole = Math.floor(Math.abs(safe) / 100);
  const rem = Math.abs(safe) % 100;
  const sign = safe < 0 ? "-" : "";
  if (rem === 0) return `${sign}N$ ${whole}`;
  return `${sign}N$ ${whole}.${String(rem).padStart(2, "0")}`;
}

/** Computes exact integer total across all group order items. */
export function computeGroupTotalCents(items: Pick<GroupOrderItemSummary, "unit_price_cents" | "quantity">[]): number {
  let sum = 0;
  for (const item of items) {
    sum += Math.max(0, Math.round(item.unit_price_cents)) * Math.max(0, Math.floor(item.quantity));
  }
  return sum;
}

/**
 * By-Item Split: assigns each participant the exact minor-unit subtotal of their own items.
 * Guaranteed exact sum === totalCents.
 */
export function calculateByItemSplit(
  participantIds: string[],
  items: Pick<GroupOrderItemSummary, "participant_id" | "unit_price_cents" | "quantity">[],
): BillAllocationInput[] {
  const totals = new Map<string, number>();
  for (const pid of participantIds) totals.set(pid, 0);

  for (const item of items) {
    const line = Math.max(0, Math.round(item.unit_price_cents)) * Math.max(0, Math.floor(item.quantity));
    totals.set(item.participant_id, (totals.get(item.participant_id) ?? 0) + line);
  }

  return Array.from(totals.entries()).map(([participant_id, amount_cents]) => ({
    participant_id,
    amount_cents,
  }));
}

/**
 * Equal Split: divides totalCents equally across selected participants and distributes
 * any integer remainder deterministically (+1 cent to the first `remainder` participants).
 * Guaranteed exact sum === totalCents with zero floating-point rounding error.
 */
export function calculateEqualSplit(
  selectedParticipantIds: string[],
  totalCents: number,
): BillAllocationInput[] {
  const uniqueIds = Array.from(new Set(selectedParticipantIds)).filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const safeTotal = Math.max(0, Math.round(totalCents));
  const baseShare = Math.floor(safeTotal / uniqueIds.length);
  const remainder = safeTotal % uniqueIds.length;

  return uniqueIds.map((participant_id, index) => ({
    participant_id,
    amount_cents: baseShare + (index < remainder ? 1 : 0),
  }));
}

/**
 * Custom Split Validator: enforces non-negative integer minor-unit shares summing to totalCents exactly.
 */
export function validateCustomSplit(
  allocations: BillAllocationInput[],
  totalCents: number,
): { ok: true; allocatedCents: number } | { ok: false; error: string; deltaCents: number } {
  if (allocations.length === 0) {
    return { ok: false, error: "Select at least one participant to split the bill.", deltaCents: -totalCents };
  }

  let sum = 0;
  for (const alloc of allocations) {
    if (!Number.isInteger(alloc.amount_cents) || alloc.amount_cents < 0) {
      return {
        ok: false,
        error: "Each participant share must be a valid non-negative amount.",
        deltaCents: 0,
      };
    }
    sum += alloc.amount_cents;
  }

  const delta = sum - totalCents;
  if (delta !== 0) {
    const diffFormatted = formatCentsNAD(Math.abs(delta));
    return {
      ok: false,
      error:
        delta > 0
          ? `Allocated shares exceed the bill total by ${diffFormatted}.`
          : `Allocated shares are short of the bill total by ${diffFormatted}.`,
      deltaCents: delta,
    };
  }

  return { ok: true, allocatedCents: sum };
}

/** Authorization helper: participant can only edit/remove their own unlocked items while group is open. */
export function canModifyGroupItem(
  item: Pick<GroupOrderItemSummary, "participant_id" | "locked">,
  callerParticipantId: string | null | undefined,
  groupStatus: string,
): boolean {
  if (groupStatus !== "open" || item.locked || !callerParticipantId) return false;
  return item.participant_id === callerParticipantId;
}

/** Authorization helper: only verified staff roles may settle a bill allocation. */
export function canRecordBillSettlement(staffRole: string | null | undefined): boolean {
  return staffRole === "admin" || staffRole === "manager" || staffRole === "waiter" || staffRole === "kitchen";
}
