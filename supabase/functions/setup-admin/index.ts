import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Create admin user
  let userId: string | null = null;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: "test@berrylicious.com",
    password: "Admin123!",
    email_confirm: true,
  });

  if (authError) {
    // User might already exist
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existing = users?.find((u: any) => u.email === "test@berrylicious.com");
    if (existing) {
      userId = existing.id;
    } else {
      return new Response(JSON.stringify({ error: authError.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
  } else {
    userId = authData.user.id;
  }

  // Assign admin role
  const { error: roleError } = await supabase.from("user_roles").upsert(
    { user_id: userId, role: "admin" },
    { onConflict: "user_id,role" }
  );

  return new Response(
    JSON.stringify({ success: true, userId, roleError: roleError?.message ?? null }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
