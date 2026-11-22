import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Mail, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  consumePendingRedirect,
  hasCompletedProfileSetup,
  mapAuthError,
  markOnboardingCompleted,
  readAuthCallbackError,
  readPendingVerifyEmail,
  resolveWebmailInbox,
  savePendingVerifyEmail,
  validateEmailAddress,
} from "@/lib/authUtils";
import { AuthHeader } from "./AuthHeader";
import { AuthTextField } from "./AuthTextField";
import { AuthErrorMessage } from "./AuthErrorMessage";

const RESEND_COOLDOWN_SECONDS = 60;

interface EmailVerificationStateProps {
  initialEmail?: string;
  redirectTo: string;
}

export function EmailVerificationState({
  initialEmail = "",
  redirectTo,
}: EmailVerificationStateProps) {
  const { user, resendVerificationEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    () => initialEmail.trim() || readPendingVerifyEmail() || user?.email || "",
  );
  const [editingEmail, setEditingEmail] = useState(() => !initialEmail && !readPendingVerifyEmail() && !user?.email);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    const cbError = readAuthCallbackError(location.search, location.hash);
    return cbError ? mapAuthError(cbError, "verify").message : null;
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const resendLockRef = useRef(false);

  // If the customer arrived via a valid Supabase email verification callback link,
  // continue seamlessly to optional setup or their intended destination.
  useEffect(() => {
    if (user && user.email_confirmed_at) {
      markOnboardingCompleted();
      if (!hasCompletedProfileSetup(user.id)) {
        navigate("/auth/setup", { replace: true, state: { from: redirectTo } });
      } else {
        const target = consumePendingRedirect(redirectTo);
        navigate(target, { replace: true });
      }
    }
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const webmail = useMemo(() => resolveWebmailInbox(email), [email]);

  const handleResend = async () => {
    if (resendLockRef.current || cooldown > 0) return;

    const validationErr = validateEmailAddress(email);
    if (validationErr) {
      setEditingEmail(true);
      setErrorMsg(validationErr);
      return;
    }

    resendLockRef.current = true;
    setResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await resendVerificationEmail(email);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }
      savePendingVerifyEmail(email);
      setEditingEmail(false);
      setSuccessMsg("Verification email sent. Check your inbox and spam folder.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      resendLockRef.current = false;
      setResending(false);
    }
  };

  return (
    <div>
      <AuthHeader
        icon={<Mail className="h-7 w-7" aria-hidden="true" />}
        title="Check Your Inbox."
        subtitle="We've sent you an email to verify your account."
      />

      <div className="space-y-4">
        {email && !editingEmail && (
          <div className="rounded-2xl border border-white/10 bg-[#242424] px-4 py-3.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A3A3A3]">
              Verification sent to
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate text-[15px] font-semibold text-white">{email}</p>
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className="shrink-0 text-[13px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {editingEmail && (
          <AuthTextField
            id="verify-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            disabled={resending}
          />
        )}

        {errorMsg && <AuthErrorMessage message={errorMsg} variant="error" />}
        {successMsg && <AuthErrorMessage message={successMsg} variant="success" />}

        <div className="space-y-2.5 pt-2">
          {webmail && (
            <a
              href={webmail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bb-press flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {webmail.label}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || cooldown > 0}
            className={
              "bb-press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition-colors disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
              (webmail
                ? "border border-white/15 bg-[#242424] text-white hover:bg-[#303030]"
                : "bg-[#FF5A1F] text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15]")
            }
          >
            {resending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : cooldown > 0 ? (
              `Resend available in ${cooldown}s`
            ) : (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Resend Verification Email
              </>
            )}
          </button>

          <Link
            to="/auth/sign-in"
            state={{ email, from: redirectTo }}
            className="bb-press flex min-h-[48px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
