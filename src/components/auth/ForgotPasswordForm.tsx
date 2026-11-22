import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { validateEmailAddress } from "@/lib/authUtils";
import { AuthHeader } from "./AuthHeader";
import { AuthTextField } from "./AuthTextField";
import { AuthErrorMessage } from "./AuthErrorMessage";

const RESEND_COOLDOWN_SECONDS = 60;

interface ForgotPasswordFormProps {
  initialEmail?: string;
  redirectTo: string;
}

export function ForgotPasswordForm({
  initialEmail = "",
  redirectTo,
}: ForgotPasswordFormProps) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendReset = async () => {
    if (submitLockRef.current || cooldown > 0) return;

    const nextEmailErr = validateEmailAddress(email);
    setEmailError(nextEmailErr);
    setFormError(null);
    if (nextEmailErr) return;

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      // Always show a neutral confirmation message without confirming whether the email exists
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendReset();
  };

  if (sent) {
    return (
      <div>
        <AuthHeader
          icon={<MailCheck className="h-7 w-7" aria-hidden="true" />}
          title="Check Your Email."
          subtitle="If an eligible account matches that email, we've sent password reset instructions."
        />

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#242424] px-4 py-3.5 text-[14px] leading-relaxed text-[#D4D4D4]">
            Look for an email from Butcher Block sent to{" "}
            <span className="font-semibold text-white">{email.trim()}</span>. If it doesn&apos;t appear in a minute, check your spam or junk folder.
          </div>

          {formError && <AuthErrorMessage message={formError} variant="error" />}

          <button
            type="button"
            disabled={submitting || cooldown > 0}
            onClick={() => void sendReset()}
            className="bb-press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] px-6 text-[15px] font-semibold text-white hover:bg-[#303030] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : cooldown > 0 ? (
              `Resend link in ${cooldown}s`
            ) : (
              "Send Reset Link Again"
            )}
          </button>

          <Link
            to="/auth/sign-in"
            state={{ email: email.trim(), from: redirectTo }}
            className="bb-press flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[15px] font-bold text-white hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthHeader
        icon={<KeyRound className="h-7 w-7" aria-hidden="true" />}
        title="Forgot Your Password?"
        subtitle="No problem. Enter your email and we'll help you get back in."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <AuthErrorMessage message={formError} variant="error" />}

        <AuthTextField
          id="forgot-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
            if (formError) setFormError(null);
          }}
          error={emailError}
          disabled={submitting}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="bb-press mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Sending Reset Link…
            </>
          ) : (
            "Send Reset Link"
          )}
        </button>

        <Link
          to="/auth/sign-in"
          state={{ email: email.trim(), from: redirectTo }}
          className="bb-press flex min-h-[48px] w-full items-center justify-center rounded-full text-[14px] font-semibold text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          Back to Sign In
        </Link>
      </form>
    </div>
  );
}
