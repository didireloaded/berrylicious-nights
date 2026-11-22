export const ONBOARDING_STORAGE_KEY = "bb-onboarding-complete";
export const LEGACY_WELCOME_STORAGE_KEY = "bb-welcome-seen";
export const AUTH_RETURN_TO_KEY = "bb-auth-return-to";
export const PENDING_VERIFY_EMAIL_KEY = "bb-pending-verify-email";
export const PROFILE_SETUP_DONE_KEY = "bb-profile-setup-done";
export const AUTH_SIGNED_OUT_EVENT = "bb-auth-signed-out";

/** Actual minimum password length enforced by the configured Supabase Auth instance. */
export const MIN_PASSWORD_LENGTH = 6;

const DISALLOWED_REDIRECT_PREFIXES = ["/auth", "/onboarding"];

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1" ||
      localStorage.getItem(LEGACY_WELCOME_STORAGE_KEY) === "1" ||
      sessionStorage.getItem(ONBOARDING_STORAGE_KEY) === "1" ||
      sessionStorage.getItem(LEGACY_WELCOME_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    localStorage.setItem(LEGACY_WELCOME_STORAGE_KEY, "1");
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    sessionStorage.setItem(LEGACY_WELCOME_STORAGE_KEY, "1");
  } catch {
    /* ignore storage quota / private mode errors */
  }
}

export function hasCompletedProfileSetup(userId?: string | null): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return localStorage.getItem(`${PROFILE_SETUP_DONE_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

export function markProfileSetupCompleted(userId?: string | null): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${PROFILE_SETUP_DONE_KEY}:${userId}`, "1");
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Strictly validates an internal post-auth redirect target.
 * Prevents open redirects (`//evil.com`, `https://...`, `javascript:...`)
 * and prevents auth/onboarding redirect loops.
 */
export function sanitizeRedirectPath(candidate: unknown, fallback = "/home"): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  if (/[\r\n]/.test(trimmed)) return fallback;

  try {
    const parsed = new URL(trimmed, "https://butcherblock.local");
    if (parsed.origin !== "https://butcherblock.local") return fallback;
    const pathname = parsed.pathname;
    if (pathname === "/") return fallback;
    if (DISALLOWED_REDIRECT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function savePendingRedirect(path: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const safe = sanitizeRedirectPath(path, "");
    if (safe) sessionStorage.setItem(AUTH_RETURN_TO_KEY, safe);
    else sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  } catch {
    /* ignore */
  }
}

export function readPendingRedirect(fallback = "/home"): string {
  if (typeof window === "undefined") return fallback;
  try {
    return sanitizeRedirectPath(sessionStorage.getItem(AUTH_RETURN_TO_KEY), fallback);
  } catch {
    return fallback;
  }
}

export function consumePendingRedirect(fallback = "/home"): string {
  const target = readPendingRedirect(fallback);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    } catch {
      /* ignore */
    }
  }
  return target;
}

export function savePendingVerifyEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    if (email.trim()) sessionStorage.setItem(PENDING_VERIFY_EMAIL_KEY, email.trim().toLowerCase());
    else sessionStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

export function readPendingVerifyEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function getAuthRedirectUrl(path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return safePath;
  return `${window.location.origin}${safePath}`;
}

export function validateEmailAddress(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address.";
  // Practical RFC-compatible email validation without rejecting valid TLDs
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return "Enter a valid email address (for example, name@example.com).";
  }
  return null;
}

export function validatePasswordValue(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export interface MappedAuthError {
  message: string;
  needsVerification?: boolean;
  isRateLimited?: boolean;
  isNetworkError?: boolean;
}

export function mapAuthError(rawError: unknown, context: "sign-in" | "sign-up" | "reset" | "verify" = "sign-in"): MappedAuthError {
  const raw =
    typeof rawError === "string"
      ? rawError
      : rawError && typeof rawError === "object" && "message" in rawError
        ? String((rawError as { message?: unknown }).message ?? "")
        : "";

  const lower = raw.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("offline")
  ) {
    return {
      message: "We couldn't reach Butcher Block right now. Check your internet connection and try again.",
      isNetworkError: true,
    };
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429") ||
    lower.includes("for security purposes, you can only request this after")
  ) {
    return {
      message: "Too many attempts right now. Please wait a moment before trying again.",
      isRateLimited: true,
    };
  }

  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return {
      message: "Your email hasn't been verified yet. Check your inbox or request a fresh verification link.",
      needsVerification: true,
    };
  }

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid email or password")
  ) {
    return {
      message: "That email and password didn't match. Check your details and try again.",
    };
  }

  if (lower.includes("user already registered") || lower.includes("already exists") || lower.includes("already been registered")) {
    return {
      message: "An account with this email already exists. Try signing in instead.",
    };
  }

  if (lower.includes("password should be at least") || lower.includes("weak password")) {
    return {
      message: `Please choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (lower.includes("same password") || lower.includes("different from the old password")) {
    return {
      message: "Please choose a new password that differs from your current password.",
    };
  }

  if (
    lower.includes("expired") ||
    lower.includes("invalid token") ||
    lower.includes("otp_expired") ||
    lower.includes("access_denied")
  ) {
    return {
      message:
        context === "reset"
          ? "This password reset link has expired or was already used. Request a fresh link below."
          : "This verification link has expired or was already used. Request a new email below.",
    };
  }

  if (lower.includes("signup is disabled") || lower.includes("signups not allowed")) {
    return {
      message: "New account registration is currently unavailable. You can still browse and order as a guest.",
    };
  }

  if (lower.includes("session_not_found") || lower.includes("auth session missing")) {
    return {
      message: "Your session has expired. Please sign in again to continue.",
    };
  }

  if (context === "reset") {
    return {
      message: "We couldn't update your password right now. Please request a fresh reset link and try again.",
    };
  }

  return {
    message: raw.trim() || "Something went wrong. Please try again in a moment.",
  };
}

/**
 * Returns a reliable consumer webmail inbox link ONLY for well-known email providers.
 * Returns null for custom or unknown domains so we never show a dead/broken button.
 */
export function resolveWebmailInbox(email: string): { label: string; url: string } | null {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { label: "Open Gmail", url: "https://mail.google.com/" };
  }
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") {
    return { label: "Open iCloud Mail", url: "https://www.icloud.com/mail" };
  }
  if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com") {
    return { label: "Open Outlook", url: "https://outlook.live.com/mail/" };
  }
  if (domain === "yahoo.com" || domain === "ymail.com") {
    return { label: "Open Yahoo Mail", url: "https://mail.yahoo.com/" };
  }
  if (domain === "proton.me" || domain === "protonmail.com") {
    return { label: "Open Proton Mail", url: "https://mail.proton.me/" };
  }
  return null;
}

/**
 * Parses Supabase auth redirect error parameters from either hash (#error=...) or search (?error=...).
 */
export function readAuthCallbackError(search: string, hash: string): string | null {
  const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const errorDesc =
    hashParams.get("error_description") ||
    searchParams.get("error_description") ||
    hashParams.get("error_code") ||
    searchParams.get("error_code") ||
    hashParams.get("error") ||
    searchParams.get("error");
  if (!errorDesc) return null;
  return errorDesc.replace(/\+/g, " ");
}

/**
 * Clears private account-scoped client state on sign-out while preserving
 * non-sensitive cart items and onboarding completion.
 */
export function clearPrivateAccountState(): void {
  if (typeof window === "undefined") return;
  const localKeysToClear = [
    "berrylicious-orders",
    "berrylicious-bookings",
    "berrylicious-current-order",
    "butcher-block-favorites",
    "butcher-block-guest-name",
    "butcher-block-guest-phone",
  ];
  const sessionKeysToClear = [
    "berrylicious-session-booking",
    PENDING_VERIFY_EMAIL_KEY,
    AUTH_RETURN_TO_KEY,
  ];

  try {
    for (const key of localKeysToClear) {
      localStorage.removeItem(key);
    }
    for (const key of sessionKeysToClear) {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore storage errors */
  }

  window.dispatchEvent(new CustomEvent<string[]>("bb-favorites-updated", { detail: [] }));
  window.dispatchEvent(new CustomEvent(AUTH_SIGNED_OUT_EVENT));
}
