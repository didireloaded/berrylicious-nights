import { supabase } from "@/integrations/supabase/client";
import { generateArrivalCode } from "@/lib/arrivalCode";

const MAX_ATTEMPTS = 14;

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || Boolean(e.message?.toLowerCase().includes("duplicate key"));
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
    blob.includes("pgrst204") ||
    blob.includes("pgrst205")
  );
}

export async function insertBookingWithArrivalCode(
  row: Record<string, unknown>,
): Promise<{ arrival_code: string | null; assigned_table_code: string | null }> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = generateArrivalCode();
    const { data, error } = await supabase
      .from("bookings")
      .insert({ ...row, arrival_code })
      .select("*")
      .single();
    if (!error && data) {
      const row = data as { arrival_code?: string | null; assigned_table_code?: string | null };
      return {
        arrival_code: row.arrival_code ?? null,
        assigned_table_code: row.assigned_table_code ?? null,
      };
    }
    if (error && isSchemaCacheOrMissingColumnError(error)) {
      const { error: legErr } = await supabase.from("bookings").insert(row).select("id").single();
      if (!legErr) return { arrival_code: null, assigned_table_code: null };
      throw legErr ?? error;
    }
    if (!isUniqueViolation(error)) throw error;
  }
  throw new Error("Could not assign a unique arrival code");
}

export async function insertOrderWithArrivalCode(
  row: Record<string, unknown>,
): Promise<{ id: string; arrival_code: string | null }> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = generateArrivalCode();
    const { data, error } = await supabase
      .from("orders")
      .insert({ ...row, arrival_code })
      .select("id, arrival_code")
      .single();
    if (!error && data?.id) {
      return { id: data.id as string, arrival_code: (data.arrival_code as string) ?? null };
    }
    if (error && isSchemaCacheOrMissingColumnError(error)) {
      const { data: legacy, error: legErr } = await supabase.from("orders").insert(row).select("id").single();
      if (!legErr && legacy?.id) return { id: legacy.id as string, arrival_code: null };
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
  const { data: insertedOrder, error: orderErr } = await supabase
    .from("orders")
    .insert(opts.orderRow)
    .select("id")
    .single();
  if (orderErr || !insertedOrder?.id) throw orderErr ?? new Error("Order insert failed");
  const orderId = insertedOrder.id as string;
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

/** Same code on preorder order + linked booking (Plan my night). */
export async function insertOrderAndBookingWithSharedArrivalCode(opts: {
  orderRow: Record<string, unknown>;
  bookingWithoutPreOrder: Record<string, unknown>;
}): Promise<{ orderId: string; arrival_code: string | null }> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const arrival_code = generateArrivalCode();
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
    const orderId = insertedOrder?.id as string;
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
