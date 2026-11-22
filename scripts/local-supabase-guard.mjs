#!/usr/bin/env node
/**
 * Safety guardrail preventing local database scripts (`db:reset`, `db:test`, `db:start`)
 * from ever accidentally targeting a remote or production Supabase project.
 */

const FORBIDDEN_HOST_PATTERNS = [
  /\.supabase\.co$/i,
  /\.supabase\.in$/i,
  /\.supabase\.net$/i,
];

export function assertLocalOnlyEnv(env = process.env) {
  const candidates = [
    ["SUPABASE_DB_URL", env.SUPABASE_DB_URL],
    ["DATABASE_URL", env.DATABASE_URL],
    ["SUPABASE_URL", env.SUPABASE_URL],
  ].filter(([, val]) => typeof val === "string" && val.trim().length > 0);

  for (const [name, raw] of candidates) {
    let hostname = "";
    try {
      hostname = new URL(raw).hostname.toLowerCase();
    } catch {
      continue;
    }
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "host.docker.internal";
    if (!isLocal || FORBIDDEN_HOST_PATTERNS.some((re) => re.test(hostname))) {
      throw new Error(
        `REFUSED: ${name} points to non-local host "${hostname}". Local database scripts may ONLY target localhost / 127.0.0.1.`,
      );
    }
  }

  if (env.SUPABASE_ACCESS_TOKEN && env.ALLOW_REMOTE_SUPABASE !== "1") {
    // Do not fail simply because a developer has a CLI token, unless linking/pushing explicitly
    return { ok: true, warning: "SUPABASE_ACCESS_TOKEN is set in shell; local commands stay isolated with --local / local Docker." };
  }
  return { ok: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const res = assertLocalOnlyEnv(process.env);
    if (res.warning) console.warn(`[local-supabase-guard] ${res.warning}`);
    console.log("[local-supabase-guard] OK — environment is safe for isolated local Supabase operations.");
  } catch (err) {
    console.error(`[local-supabase-guard] ${err.message}`);
    process.exit(1);
  }
}
