import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function friendlyRestaurantChatError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("foreign key") &&
    (m.includes("profiles") || m.includes("is not present in table"))
  ) {
    return "Chat couldn’t start: Supabase rejected the thread because public.restaurant_chats still pointed at public.profiles. Run migration 20260406220000_restaurant_chats_fk_auth_users.sql (links chats to auth.users), or ensure a profiles row exists for your user.";
  }
  const looksLikeMissingChatInfra =
    m.includes("schema cache") ||
    m.includes("pgrst205") ||
    m.includes("pgrst204") ||
    /\b42p01\b/.test(m) ||
    (m.includes("does not exist") &&
      (m.includes("restaurant_chats") || m.includes("restaurant_chat_messages")));
  if (looksLikeMissingChatInfra) {
    return "Messaging isn’t visible to the API yet. Run migrations through 20260406230000_ensure_restaurant_chat_rpc.sql on this Supabase project, then NOTIFY pgrst, 'reload schema'; Match VITE_SUPABASE_URL to that project. Details: supabase/manual/VERIFY_RESTAURANT_CHAT.sql.";
  }
  return raw;
}

function rpcNotDeployed(err: unknown): boolean {
  const m = String((err as { message?: string; code?: string })?.message ?? "").toLowerCase();
  const code = String((err as { code?: string })?.code ?? "");
  return (
    code === "PGRST202" ||
    code === "42883" ||
    m.includes("could not find the function") ||
    (m.includes("ensure_restaurant_chat_for_me") && m.includes("does not exist"))
  );
}

export async function ensureRestaurantChat(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ chatId: string | null; error: string | null }> {
  const { data: rpcId, error: rpcErr } = await (supabase as any).rpc("ensure_restaurant_chat_for_me");

  if (!rpcErr && typeof rpcId === "string" && rpcId.length > 0) {
    return { chatId: rpcId, error: null };
  }

  if (rpcErr && !rpcNotDeployed(rpcErr)) {
    return { chatId: null, error: friendlyRestaurantChatError(rpcErr.message) };
  }

  const { data: row, error: selErr } = await supabase
    .from("restaurant_chats")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) return { chatId: null, error: friendlyRestaurantChatError(selErr.message) };
  if (row?.id) return { chatId: row.id, error: null };

  const { data: inserted, error: insErr } = await supabase
    .from("restaurant_chats")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (insErr) return { chatId: null, error: friendlyRestaurantChatError(insErr.message) };
  return { chatId: inserted?.id ?? null, error: null };
}
