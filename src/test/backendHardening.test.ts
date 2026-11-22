import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { menuItems, PDF_SAUCE_ADDONS } from "@/data/menu";
import {
  isLegacySchemaFallbackEnabled,
  isMissingRpcError,
} from "@/lib/supabaseArrivalInsert";
import { assertLocalOnlyEnv } from "../../scripts/local-supabase-guard.mjs";
import { scanContentForSecrets } from "../../scripts/check-no-secrets.mjs";

describe("Backend Hardening, Security Guardrails & Catalog Parity", () => {
  it("disables legacy schema column-stripping fallback by default unless explicitly opted in", () => {
    expect(isLegacySchemaFallbackEnabled(undefined)).toBe(false);
    expect(isLegacySchemaFallbackEnabled("")).toBe(false);
    expect(isLegacySchemaFallbackEnabled("false")).toBe(false);
    expect(isLegacySchemaFallbackEnabled("true")).toBe(true);
    expect(isLegacySchemaFallbackEnabled("TRUE")).toBe(true);
  });

  it("distinguishes missing RPC deployment errors from business/security rejections", () => {
    expect(isMissingRpcError({ code: "PGRST202", message: "Could not find the function public.submit_order" })).toBe(true);
    expect(isMissingRpcError({ code: "42883", message: "function public.submit_order does not exist" })).toBe(true);

    // Real business/security rejections must NEVER trigger fallback
    expect(isMissingRpcError({ code: "P0001", message: "Menu item cc-rump is currently unavailable" })).toBe(false);
    expect(isMissingRpcError({ code: "42501", message: "Table session is expired or invalid" })).toBe(false);
    expect(isMissingRpcError({ code: "22023", message: "Unknown or inactive menu item" })).toBe(false);
  });

  it("blocks local database scripts from targeting remote or production Supabase hosts", () => {
    expect(() =>
      assertLocalOnlyEnv({ SUPABASE_URL: "https://dyrdlmankfpgjdgyxvsc.supabase.co" }),
    ).toThrow(/REFUSED/i);

    expect(() =>
      assertLocalOnlyEnv({ DATABASE_URL: "postgresql://postgres:pw@db.example.supabase.co:5432/postgres" }),
    ).toThrow(/REFUSED/i);

    expect(
      assertLocalOnlyEnv({ SUPABASE_URL: "http://127.0.0.1:54321", DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres" }),
    ).toEqual({ ok: true });
  });

  it("detects leaked private credentials and VITE_-exposed secrets in source", () => {
    const viteLeak = scanContentForSecrets("const k = import.meta.env.VITE_RESEND_API_KEY;", "src/lib/mail.ts");
    expect(viteLeak.length).toBeGreaterThan(0);

    const serviceRoleLeak = scanContentForSecrets("const key = process.env.SUPABASE_SERVICE_ROLE_KEY;", "src/pages/AdminPage.tsx");
    expect(serviceRoleLeak.length).toBeGreaterThan(0);

    const cleanClient = scanContentForSecrets("const url = import.meta.env.VITE_SUPABASE_URL;", "src/integrations/supabase/client.ts");
    expect(cleanClient).toEqual([]);
  });

  it("keeps the authoritative SQL menu catalog migration in 1:1 parity with src/data/menu.ts", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261124010000_backend_hardening_catalog_and_rpcs.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    for (const item of menuItems) {
      expect(sql).toContain(`('${item.id}',`);
    }
    for (const sauce of PDF_SAUCE_ADDONS) {
      expect(sql).toContain(`('${sauce.id.replace(/'/g, "''")}', ${sauce.price}, true)`);
    }
  });
});
