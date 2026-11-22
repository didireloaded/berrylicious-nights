#!/usr/bin/env node
/**
 * Fast, zero-dependency secret & client-bundle leakage scanner.
 * Scans `src/`, `scripts/`, `supabase/`, and `.github/` to block accidental
 * commits of private service keys, third-party API secrets, or forbidden
 * `VITE_` browser exposure of backend credentials.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SCAN_DIRS = ["src", "scripts", "supabase", ".github"];
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".yml", ".yaml", ".toml", ".json", ".html", ".css",
]);

export const SECRET_RULES = [
  {
    name: "Supabase service_role key in client source",
    clientOnly: true,
    pattern: /SUPABASE_SERVICE_ROLE_KEY/i,
  },
  {
    name: "Private backend key exposed via VITE_ prefix",
    clientOnly: false,
    pattern: /\bVITE_[A-Z0-9_]*(SERVICE_ROLE|SECRET_KEY|PRIVATE_KEY|RESEND_API_KEY|TURNSTILE_SECRET)\b/,
  },
  {
    name: "Hardcoded Resend live API key",
    clientOnly: false,
    pattern: /\bre_[A-Za-z0-9_]{24,}\b/,
  },
  {
    name: "Hardcoded Stripe live/restricted key",
    clientOnly: false,
    pattern: /\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}\b/,
  },
  {
    name: "Hardcoded AWS access key",
    clientOnly: false,
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "Hardcoded private key block",
    clientOnly: false,
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "Hardcoded Supabase service_role JWT",
    clientOnly: false,
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]*InJvbGUiOiJzZXJ2aWNlX3JvbGUi[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/,
  },
];

export function scanContentForSecrets(content, relPath) {
  const findings = [];
  const isClientSource = relPath.startsWith("src/") || relPath.startsWith("dist/");
  const isScannerSelf = relPath === "scripts/check-no-secrets.mjs" || relPath.endsWith("backendHardening.test.ts");
  if (isScannerSelf) return findings;

  const lines = content.split("\n");
  for (const rule of SECRET_RULES) {
    if (rule.clientOnly && !isClientSource) continue;
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        findings.push({ file: relPath, line: i + 1, rule: rule.name });
      }
    }
  }
  return findings;
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const allFindings = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(path.join(repoRoot, dir))) {
      const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
      const content = fs.readFileSync(file, "utf8");
      allFindings.push(...scanContentForSecrets(content, rel));
    }
  }

  if (allFindings.length > 0) {
    console.error("[check-no-secrets] Potential leaked secrets detected:");
    for (const f of allFindings) {
      console.error(`  - ${f.file}:${f.line} — ${f.rule}`);
    }
    process.exit(1);
  }
  console.log("[check-no-secrets] PASS — zero secret leaks detected across src/, scripts/, supabase/, and .github/.");
}
