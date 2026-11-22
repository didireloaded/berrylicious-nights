#!/usr/bin/env node
/**
 * Local Supabase Backend Health Check for Butcher Block Steakhouse.
 * Verifies local PostgREST, GoTrue Auth, core tables, and authoritative RPCs
 * against an isolated local Supabase instance (default: http://127.0.0.1:54321).
 */

import { assertLocalOnlyEnv } from "./local-supabase-guard.mjs";

const SUPABASE_URL = (process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, "");
const ANON_KEY = process.env.LOCAL_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

async function checkEndpoint(label, url, options = {}) {
  const res = await fetch(url, options);
  const ok = res.status >= 200 && res.status < 400;
  return { label, status: res.status, ok };
}

async function main() {
  assertLocalOnlyEnv({ SUPABASE_URL });

  const headers = ANON_KEY
    ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const checks = [
    checkEndpoint("Auth settings (/auth/v1/settings)", `${SUPABASE_URL}/auth/v1/settings`, { headers }),
    checkEndpoint("Menu catalog table (public.menu_catalog)", `${SUPABASE_URL}/rest/v1/menu_catalog?select=id&limit=1`, { headers }),
    checkEndpoint("Sauce addons table (public.menu_sauce_addons)", `${SUPABASE_URL}/rest/v1/menu_sauce_addons?select=id&limit=1`, { headers }),
    checkEndpoint("Booked table times RPC", `${SUPABASE_URL}/rest/v1/rpc/booked_table_times`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_date: "2026-12-01" }),
    }),
    checkEndpoint("Active bookings count RPC", `${SUPABASE_URL}/rest/v1/rpc/active_bookings_count`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_date: "2026-12-01" }),
    }),
    checkEndpoint("Menu item disabled table", `${SUPABASE_URL}/rest/v1/menu_item_disabled?select=menu_item_id&limit=1`, { headers }),
  ];

  const results = await Promise.all(checks);
  let failures = 0;
  for (const r of results) {
    const tag = r.ok ? "PASS" : "FAIL";
    console.log(`[db-healthcheck] ${tag} (${r.status}) — ${r.label}`);
    if (!r.ok) failures++;
  }

  if (failures > 0) {
    console.error(`[db-healthcheck] ${failures} health check(s) failed.`);
    process.exit(1);
  }
  console.log("[db-healthcheck] All local Supabase services, tables, and RPCs are healthy.");
}

main().catch((err) => {
  console.error(`[db-healthcheck] Connection failed: ${err.message}`);
  console.error("Ensure local Supabase is running (`npm run db:start`) and LOCAL_SUPABASE_ANON_KEY is set.");
  process.exit(1);
});
