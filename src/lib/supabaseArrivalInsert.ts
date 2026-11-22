import { supabase as _supabase } from "@/integrations/supabase/client";
import { generateArrivalCode } from "@/lib/arrivalCode";

type DynamicTableResponse = {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string; details?: string; hint?: string } | null;
};

type DynamicSupabaseClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<DynamicTableResponse>;
      };
    } & Promise<DynamicTableResponse>;
    delete: () => {
      eq: (column: string, value: string) => Promise<DynamicTableResponse>;
    };
  };
};

// Typed dynamic wrapper to avoid mismatches when auto-generated types lag behind migrations
const supabase = _supabase as unknown as DynamicSupabaseClient;

const MAX_ATTEMPTS = 14;

export function generateClientUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || Boolean(e.message?.toLowerCase().includes("duplicate key"));
}

function isPrimaryKeyIdDuplicate(err: unknown): boolean {
  if (!isUniqueViolation(err)) return false;
  const e = err as { message?: string; details?: string };
  const blob = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return blob.includes("_pkey") || blob.includes("key (id)=");
}

export function isBookingSlotConflictError(err: unknown): boolean {
  if (!isUniqueViolation(err)) return false;
  const e = err as { message?: string; details?: string };
  const blob = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return blob.includes("bookings_date_time") || blob.includes("key (date, time)=");
}

/**
 * PostgREST often reports unknown columns as "... not found in the schema cache".
 * If `arrival_code` (or related) migrations aren’t applied yet, fall back to legacy inserts.
 */
function isSchemaCacheOrMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  const blob = [e.message, e.details, e.hint, String(e.code ?? "")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("schema cache") ||
    blob.includes("arrival_code") ||
    blob.includes("arrival_verified") ||
    blob.includes("assigned_table") ||
    blob.includes("guest_access_token_hash") ||
    blob.includes("table_number") ||
    blob.includes("table_session_id") ||
    blob.includes("pgrst204") ||
    blob.includes("pgrst205")
  );
}

function stripExtendedOrderColumns(row: Record<string, unknown>): Record<string, unknown> {
  const {
    guest_access_token_hash: _g,
    table_number: _tn,
    table_session_id: _ts,
    ...legacyRow
  } = row;
  void _g;
  void _tn;
  void _ts;
  return legacyRow;
}

/**
 * Guests (`user_id == null`) are allowed to INSERT into `bookings` and `orders`,
 * but RLS restricts SELECT to `auth.uid() = user_id` or admins. Calling `.select()`
 * on a guest insert causes Postgres to evaluate the SELECT policy on RETURNING and fail
 * with 42501. Passing a client-generated UUID and inserting without `.select()` lets
 * guest orders and bookings succeed cleanly against the server.
 */
export async function insertBookingWithArrivalCode(
  row: Record<string, unknown>,
): Promise<{ booking_id: string | null; arrival_code: string | null; assigned_table_code: string | null }> {
  const isGuest = !row.user_id;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = generateArrivalCode();
    if (isGuest) {
      const id = generateClientUuid();
      const { error } = await supabase.from("bookings").insert({ ...row, id, arrival_code });
      if (!error) {
        return { booking_id: id, arrival_code, assigned_table_code: null };
      }
      if (isBookingSlotConflictError(error)) throw error;
      if (isSchemaCacheOrMissingColumnError(error)) {
        const legacyId = generateClientUuid();
        const { error: legErr } = await supabase.from("bookings").insert({ ...row, id: legacyId });
        if (!legErr) return { booking_id: legacyId, arrival_code: null, assigned_table_code: null };
        throw legErr ?? error;
      }
      if (!isUniqueViolation(error)) throw error;
      continue;
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert({ ...row, arrival_code })
      .select("*")
      .single();
    if (!error && data) {
      const inserted = data as { id?: string | null; arrival_code?: string | null; assigned_table_code?: string | null };
      return {
        booking_id: inserted.id ? String(inserted.id) : null,
        arrival_code: inserted.arrival_code ?? null,
        assigned_table_code: inserted.assigned_table_code ?? null,
      };
    }
    if (error && isBookingSlotConflictError(error)) throw error;
    if (error && isSchemaCacheOrMissingColumnError(error)) {
      const { data: legacy, error: legErr } = await supabase.from("bookings").insert(row).select("id").single();
      if (!legErr) {
        return {
          booking_id: legacy?.id ? String(legacy.id) : null,
          arrival_code: null,
          assigned_table_code: null,
        };
      }
      throw legErr ?? error;
    }
    if (!isUniqueViolation(error)) throw error;
  }
  throw new Error("Could not assign a unique arrival code");
}

/**
 * Inserts an order with optional client-generated `idempotencyId` so retries after
 * dropped connections or double taps cannot create duplicate kitchen tickets.
 */
export async function insertOrderWithArrivalCode(
  row: Record<string, unknown>,
  options?: { idempotencyId?: string; preferredArrivalCode?: string },
): Promise<{ id: string; arrival_code: string | null; deduplicated?: boolean }> {
  const isGuest = !row.user_id;
  const stableId = options?.idempotencyId || generateClientUuid();

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = i === 0 && options?.preferredArrivalCode ? options.preferredArrivalCode : generateArrivalCode();
    if (isGuest) {
      const { error } = await supabase.from("orders").insert({ ...row, id: stableId, arrival_code });
      if (!error) {
        return { id: stableId, arrival_code };
      }
      if (isPrimaryKeyIdDuplicate(error)) {
        return { id: stableId, arrival_code, deduplicated: true };
      }
      if (isSchemaCacheOrMissingColumnError(error)) {
        const { error: legErr } = await supabase
          .from("orders")
          .insert({ ...stripExtendedOrderColumns(row), id: stableId });
        if (!legErr) return { id: stableId, arrival_code: null };
        if (isPrimaryKeyIdDuplicate(legErr)) return { id: stableId, arrival_code: null, deduplicated: true };
        throw legErr ?? error;
      }
      if (!isUniqueViolation(error)) throw error;
      continue;
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({ ...row, id: stableId, arrival_code })
      .select("id, arrival_code")
      .single();
    if (!error && data?.id) {
      return { id: String(data.id), arrival_code: (data.arrival_code as string) ?? null };
    }
    if (error && isPrimaryKeyIdDuplicate(error)) {
      return { id: stableId, arrival_code, deduplicated: true };
    }
    if (error && isSchemaCacheOrMissingColumnError(error)) {
      const { data: legacy, error: legErr } = await supabase
        .from("orders")
        .insert({ ...stripExtendedOrderColumns(row), id: stableId })
        .select("id")
        .single();
      if (!legErr && legacy?.id) return { id: String(legacy.id), arrival_code: null };
      if (legErr && isPrimaryKeyIdDuplicate(legErr)) return { id: stableId, arrival_code: null, deduplicated: true };
      throw legErr ?? error;
    }
    if (!isUniqueViolation(error)) throw error;
  }
  throw new Error("Could not assign a unique arrival code");
}

async function insertOrderAndBookingLegacy(opts: {
  orderRow: Record<string, unknown>;
  bookingWithoutPreOrder: Record<string, unknown>;
}): Promise<{ orderId: string; arrival_code: null }> {
  const isGuest = !opts.orderRow.user_id;
  if (isGuest) {
    const orderId = generateClientUuid();
    const { error: orderErr } = await supabase.from("orders").insert({ ...opts.orderRow, id: orderId });
    if (orderErr) throw orderErr;
    const { error: bookErr } = await supabase.from("bookings").insert({
      ...opts.bookingWithoutPreOrder,
      pre_order: { order_id: orderId },
    });
    if (bookErr) throw bookErr;
    return { orderId, arrival_code: null };
  }

  const { data: insertedOrder, error: orderErr } = await supabase
    .from("orders")
    .insert(opts.orderRow)
    .select("id")
    .single();
  if (orderErr || !insertedOrder?.id) throw orderErr ?? new Error("Order insert failed");
  const orderId = String(insertedOrder.id);
  const { error: bookErr } = await supabase.from("bookings").insert({
    ...opts.bookingWithoutPreOrder,
    pre_order: { order_id: orderId },
  });
  if (bookErr) {
    await supabase.from("orders").delete().eq("id", orderId);
    throw bookErr;
  }
  return { orderId, arrival_code: null };
}

/** Same code on preorder order + linked booking. */
export async function insertOrderAndBookingWithSharedArrivalCode(opts: {
  orderRow: Record<string, unknown>;
  bookingWithoutPreOrder: Record<string, unknown>;
}): Promise<{ orderId: string; arrival_code: string | null }> {
  const isGuest = !opts.orderRow.user_id;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = generateArrivalCode();
    if (isGuest) {
      const orderId = generateClientUuid();
      const { error: orderErr } = await supabase
        .from("orders")
        .insert({ ...opts.orderRow, id: orderId, arrival_code });
      if (orderErr) {
        if (isSchemaCacheOrMissingColumnError(orderErr)) {
          return await insertOrderAndBookingLegacy(opts);
        }
        if (isUniqueViolation(orderErr)) continue;
        throw orderErr;
      }
      const { error: bookErr } = await supabase.from("bookings").insert({
        ...opts.bookingWithoutPreOrder,
        arrival_code,
        pre_order: { order_id: orderId },
      });
      if (bookErr) {
        if (isSchemaCacheOrMissingColumnError(bookErr)) {
          return await insertOrderAndBookingLegacy(opts);
        }
        if (isUniqueViolation(bookErr)) continue;
        throw bookErr;
      }
      return { orderId, arrival_code };
    }

    const { data: insertedOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({ ...opts.orderRow, arrival_code })
      .select("id")
      .single();
    if (orderErr) {
      if (isSchemaCacheOrMissingColumnError(orderErr)) {
        return await insertOrderAndBookingLegacy(opts);
      }
      if (isUniqueViolation(orderErr)) continue;
      throw orderErr;
    }
    const orderId = String(insertedOrder?.id ?? "");
    const { error: bookErr } = await supabase.from("bookings").insert({
      ...opts.bookingWithoutPreOrder,
      arrival_code,
      pre_order: { order_id: orderId },
    });
    if (bookErr) {
      await supabase.from("orders").delete().eq("id", orderId);
      if (isSchemaCacheOrMissingColumnError(bookErr)) {
        return await insertOrderAndBookingLegacy(opts);
      }
      if (isUniqueViolation(bookErr)) continue;
      throw bookErr;
    }
    return { orderId, arrival_code };
  }
  throw new Error("Could not assign a unique arrival code");
}
