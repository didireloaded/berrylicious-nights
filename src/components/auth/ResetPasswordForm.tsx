import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  mapAuthError,
  markOnboardingCompleted,
  readAuthCallbackError,
  validatePasswordValue,
} from "@/lib/authUtils";
import { AuthHeader } from "./AuthHeader";
import { PasswordInput } from "./PasswordInput";
import { AuthErrorMessage } from "./AuthErrorMessage";

export function ResetPasswordForm() {
  const { user, loading, isRecoverySession, updatePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const submitLockRef = useRef(false);

  const callbackError = readAuthCallbackError(location.search, location.hash);

  // Give Supabase Auth a short window to exchange a recovery hash/code before deciding link is invalid
  useEffect(() => {
    if (callbackError) {
      setCheckingLink(false);
      return;
    }
    if (user || isRecoverySession) {
      setCheckingLink(false);
      return;
    }
    if (loading) return;
    const timer = window.setTimeout(() => setCheckingLink(false), 600);
    return () => window.clearTimeout(timer);
  }, [callbackError, user, isRecoverySession, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const nextPasswordErr = validatePasswordValue(password);
    const nextConfirmErr = !confirmPassword
      ? "Confirm your new password."
      : password !== confirmPassword
        ? "Passwords don't match."
        : null;

    setPasswordError(nextPasswordErr);
    setConfirmError(nextConfirmErr);
    setFormError(null);

    if (nextPasswordErr || nextConfirmErr) return;

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const result = await updatePassword(password);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      markOnboardingCompleted();
      setUpdated(true);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  if (checkingLink || loading) {
    return (
      <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#FF5A1F]" aria-hidden="true" />
        <p className="text-[15px] text-[#A3A3A3]">Verifying your reset link…</p>
      </div>
    );
  }

  if (updated) {
    return (
      <div>
        <AuthHeader
          icon={<CheckCircle2 className="h-7 w-7" aria-hidden="true" />}
          title="Password Updated."
          subtitle="Your new password is saved and you're signed in to Butcher Block."
        />
        <button
          type="button"
          onClick={() => navigate("/home", { replace: true })}
          className="bb-press flex min-h-[54px] w-full items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Continue to Butcher Block
        </button>
      </div>
    );
  }

  // Invalid, expired, or missing recovery session
  if (callbackError || (!user && !isRecoverySession)) {
    const friendly = callbackError
      ? mapAuthError(callbackError, "reset").message
      : "This password reset link is missing, expired, or has already been used.";

    return (
      <div>
        <AuthHeader
          icon={<ShieldAlert className="h-7 w-7" aria-hidden="true" />}
          title="Reset Link Expired."
          subtitle={friendly}
        />

        <div className="space-y-3">
          <Link
            to="/auth/forgot"
            className="bb-press flex min-h-[54px] w-full items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Request a New Reset Link
          </Link>
          <Link
            to="/auth/sign-in"
            className="bb-press flex min-h-[48px] w-full items-center justify-center rounded-full border border-white/10 bg-[#242424] px-6 text-[14px] font-semibold text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
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
        title="Set a New Password."
        subtitle="Choose a strong new password for your Butcher Block account."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <AuthErrorMessage message={formError} variant="error" />}

        <PasswordInput
          id="reset-password"
          name="new-password"
          autoComplete="new-password"
          label="New password"
          placeholder="Enter a new password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError(null);
            if (formError) setFormError(null);
          }}
          error={passwordError}
          showRequirement
          disabled={submitting}
          required
        />

        <PasswordInput
          id="reset-confirm-password"
          name="confirm-new-password"
          autoComplete="new-password"
          label="Confirm new password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (confirmError) setConfirmError(null);
            if (formError) setFormError(null);
          }}
          error={confirmError}
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
              Updating Password…
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>
    </div>
  );
}
