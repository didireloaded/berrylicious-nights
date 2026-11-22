import { supabase as _supabase } from "@/integrations/supabase/client";
import { generateArrivalCode } from "@/lib/arrivalCode";

type DynamicTableResponse = {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string; details?: string; hint?: string } | null;
};

type DynamicSupabaseClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }>;
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

// Typed dynamic wrapper to keep compatibility across generated schema versions
const supabase = _supabase as unknown as DynamicSupabaseClient;

const MAX_ATTEMPTS = 14;

/**
 * Controlled schema-compatibility opt-in.
 * Disabled by default so Butcher Block never silently strips critical order or
 * booking metadata (`guest_access_token_hash`, `table_session_id`, `arrival_code`,
 * `occasion`) against an un-migrated schema.
 */
export function isLegacySchemaFallbackEnabled(
  flag: unknown = import.meta.env.VITE_ALLOW_LEGACY_SCHEMA_FALLBACK,
): boolean {
  return String(flag ?? "").trim().toLowerCase() === "true";
}

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

export function isMissingRpcError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const code = String(e.code ?? "");
  const msg = String(e.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("could not find the function") ||
    (msg.includes("does not exist") && msg.includes("function"))
  );
}

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
    blob.includes("occasion") ||
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

function stripExtendedBookingColumns(row: Record<string, unknown>): Record<string, unknown> {
  const { occasion: _occ, ...legacyRow } = row;
  void _occ;
  return legacyRow;
}

function schemaMismatchError(context: "order" | "booking"): Error {
  return new Error(
    `Database schema migration required before saving ${context} metadata. Apply the latest Supabase migrations or explicitly enable VITE_ALLOW_LEGACY_SCHEMA_FALLBACK only for staged rollouts.`,
  );
}

export async function insertBookingWithArrivalCode(
  row: Record<string, unknown>,
): Promise<{ booking_id: string | null; arrival_code: string | null; assigned_table_code: string | null }> {
  const isGuest = !row.user_id;
  const allowLegacy = isLegacySchemaFallbackEnabled();

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
        if (!allowLegacy) throw schemaMismatchError("booking");
        const legacyId = generateClientUuid();
        const { error: legErr } = await supabase
          .from("bookings")
          .insert({ ...stripExtendedBookingColumns(row), id: legacyId });
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
      if (!allowLegacy) throw schemaMismatchError("booking");
      const { data: legacy, error: legErr } = await supabase
        .from("bookings")
        .insert(stripExtendedBookingColumns(row))
        .select("id")
        .single();
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

export interface InsertedOrderResult {
  id: string;
  arrival_code: string | null;
  total?: number;
  items?: unknown;
  status?: string;
  created_at?: string;
  deduplicated?: boolean;
  pricedByServer?: boolean;
}

/**
 * Submits an order using the authoritative server-pricing `submit_order` RPC first.
 * Falls back to a direct table insert ONLY if `submit_order` is not yet deployed on
 * the target Supabase instance, and refuses to silently drop metadata columns unless
 * `VITE_ALLOW_LEGACY_SCHEMA_FALLBACK=true` is explicitly configured.
 */
export async function insertOrderWithArrivalCode(
  row: Record<string, unknown>,
  options?: {
    idempotencyId?: string;
    preferredArrivalCode?: string;
    tableSessionToken?: string | null;
    orderMeta?: Record<string, unknown> | null;
  },
): Promise<InsertedOrderResult> {
  const isGuest = !row.user_id;
  const stableId = options?.idempotencyId || generateClientUuid();
  const allowLegacy = isLegacySchemaFallbackEnabled();

  // 1. Prefer authoritative server-priced, idempotent, atomic `submit_order` RPC
  const rpcRes = await supabase.rpc("submit_order", {
    p_items: row.items,
    p_order_type: typeof row.order_type === "string" ? row.order_type : "pickup",
    p_idempotency_key: stableId,
    p_table_number: typeof row.table_number === "string" ? row.table_number : null,
    p_table_session_id: typeof row.table_session_id === "string" ? row.table_session_id : null,
    p_table_session_token: options?.tableSessionToken ?? null,
    p_guest_access_token_hash:
      typeof row.guest_access_token_hash === "string" ? row.guest_access_token_hash : null,
    p_order_meta: options?.orderMeta ?? null,
  });

  if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === "object") {
    const payload = rpcRes.data as Record<string, unknown>;
    if (typeof payload.id === "string" && payload.id.length > 0) {
      return {
        id: payload.id,
        arrival_code: typeof payload.arrival_code === "string" ? payload.arrival_code : null,
        total: typeof payload.total === "number" ? payload.total : Number(payload.total ?? row.total),
        items: payload.items ?? row.items,
        status: typeof payload.status === "string" ? payload.status : "pending",
        created_at: typeof payload.created_at === "string" ? payload.created_at : undefined,
        deduplicated: Boolean(payload.deduplicated),
        pricedByServer: true,
      };
    }
  }

  // Propagate real server validation/availability/session errors immediately — never bypass them
  if (rpcRes.error && !isMissingRpcError(rpcRes.error)) {
    throw rpcRes.error;
  }

  // 2. Controlled fallback ONLY when `submit_order` RPC is not yet deployed on target project
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = i === 0 && options?.preferredArrivalCode ? options.preferredArrivalCode : generateArrivalCode();
    if (isGuest) {
      const { error } = await supabase.from("orders").insert({ ...row, id: stableId, arrival_code });
      if (!error) {
        return { id: stableId, arrival_code, pricedByServer: false };
      }
      if (isPrimaryKeyIdDuplicate(error)) {
        return { id: stableId, arrival_code, deduplicated: true, pricedByServer: false };
      }
      if (isSchemaCacheOrMissingColumnError(error)) {
        if (!allowLegacy) throw schemaMismatchError("order");
        const { error: legErr } = await supabase
          .from("orders")
          .insert({ ...stripExtendedOrderColumns(row), id: stableId });
        if (!legErr) return { id: stableId, arrival_code: null, pricedByServer: false };
        if (isPrimaryKeyIdDuplicate(legErr)) {
          return { id: stableId, arrival_code: null, deduplicated: true, pricedByServer: false };
        }
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
      return { id: String(data.id), arrival_code: (data.arrival_code as string) ?? null, pricedByServer: false };
    }
    if (error && isPrimaryKeyIdDuplicate(error)) {
      return { id: stableId, arrival_code, deduplicated: true, pricedByServer: false };
    }
    if (error && isSchemaCacheOrMissingColumnError(error)) {
      if (!allowLegacy) throw schemaMismatchError("order");
      const { data: legacy, error: legErr } = await supabase
        .from("orders")
        .insert({ ...stripExtendedOrderColumns(row), id: stableId })
        .select("id")
        .single();
      if (!legErr && legacy?.id) return { id: String(legacy.id), arrival_code: null, pricedByServer: false };
      if (legErr && isPrimaryKeyIdDuplicate(legErr)) {
        return { id: stableId, arrival_code: null, deduplicated: true, pricedByServer: false };
      }
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
    const { error: orderErr } = await supabase
      .from("orders")
      .insert({ ...stripExtendedOrderColumns(opts.orderRow), id: orderId });
    if (orderErr) throw orderErr;
    const { error: bookErr } = await supabase.from("bookings").insert({
      ...stripExtendedBookingColumns(opts.bookingWithoutPreOrder),
      pre_order: { order_id: orderId },
    });
    if (bookErr) throw bookErr;
    return { orderId, arrival_code: null };
  }

  const { data: insertedOrder, error: orderErr } = await supabase
    .from("orders")
    .insert(stripExtendedOrderColumns(opts.orderRow))
    .select("id")
    .single();
  if (orderErr || !insertedOrder?.id) throw orderErr ?? new Error("Order insert failed");
  const orderId = String(insertedOrder.id);
  const { error: bookErr } = await supabase.from("bookings").insert({
    ...stripExtendedBookingColumns(opts.bookingWithoutPreOrder),
    pre_order: { order_id: orderId },
  });
  if (bookErr) {
    await supabase.from("orders").delete().eq("id", orderId);
    throw bookErr;
  }
  return { orderId, arrival_code: null };
}

/** Same code on preorder order + linked booking (strict schema requirement unless legacy fallback opted in). */
export async function insertOrderAndBookingWithSharedArrivalCode(opts: {
  orderRow: Record<string, unknown>;
  bookingWithoutPreOrder: Record<string, unknown>;
}): Promise<{ orderId: string; arrival_code: string | null }> {
  const isGuest = !opts.orderRow.user_id;
  const allowLegacy = isLegacySchemaFallbackEnabled();

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = generateArrivalCode();
    if (isGuest) {
      const orderId = generateClientUuid();
      const { error: orderErr } = await supabase
        .from("orders")
        .insert({ ...opts.orderRow, id: orderId, arrival_code });
      if (orderErr) {
        if (isSchemaCacheOrMissingColumnError(orderErr)) {
          if (!allowLegacy) throw schemaMismatchError("order");
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
          if (!allowLegacy) throw schemaMismatchError("booking");
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
        if (!allowLegacy) throw schemaMismatchError("order");
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
        if (!allowLegacy) throw schemaMismatchError("booking");
        return await insertOrderAndBookingLegacy(opts);
      }
      if (isUniqueViolation(bookErr)) continue;
      throw bookErr;
    }
    return { orderId, arrival_code };
  }
  throw new Error("Could not assign a unique arrival code");
}
