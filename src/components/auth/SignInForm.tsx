import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  consumePendingRedirect,
  markOnboardingCompleted,
  savePendingRedirect,
  savePendingVerifyEmail,
  validateEmailAddress,
} from "@/lib/authUtils";
import { AuthHeader } from "./AuthHeader";
import { AuthTextField } from "./AuthTextField";
import { PasswordInput } from "./PasswordInput";
import { AuthErrorMessage } from "./AuthErrorMessage";

interface SignInFormProps {
  redirectTo: string;
  initialEmail?: string;
}

export function SignInForm({ redirectTo, initialEmail = "" }: SignInFormProps) {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const nextEmailErr = validateEmailAddress(email);
    const nextPasswordErr = password ? null : "Enter your password.";

    setEmailError(nextEmailErr);
    setPasswordError(nextPasswordErr);
    setFormError(null);
    setNeedsVerification(false);

    if (nextEmailErr || nextPasswordErr) return;

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setFormError(result.error);
        setNeedsVerification(Boolean(result.needsVerification));
        return;
      }

      markOnboardingCompleted();
      const target = consumePendingRedirect(redirectTo);
      toast.success("Welcome back to Butcher Block");
      navigate(target, { replace: true });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleGoVerify = () => {
    savePendingVerifyEmail(email);
    savePendingRedirect(redirectTo);
    navigate("/auth/verify", {
      state: { email: email.trim(), from: redirectTo },
    });
  };

  const handleContinueAsGuest = () => {
    markOnboardingCompleted();
    navigate(redirectTo === "/admin" || redirectTo === "/messages" ? "/home" : redirectTo, {
      replace: true,
    });
  };

  return (
    <div>
      <AuthHeader
        title="Welcome Back."
        subtitle="Sign in to pick up where you left off."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <AuthErrorMessage
            message={formError}
            variant="error"
            actionLabel={needsVerification ? "Verify email address" : undefined}
            onAction={needsVerification ? handleGoVerify : undefined}
          />
        )}

        <AuthTextField
          id="signin-email"
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

        <div className="space-y-2">
          <PasswordInput
            id="signin-password"
            name="password"
            autoComplete="current-password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
              if (formError) setFormError(null);
            }}
            error={passwordError}
            disabled={submitting}
            required
          />

          <div className="flex justify-end">
            <Link
              to="/auth/forgot"
              state={{ email: email.trim(), from: redirectTo }}
              className="inline-flex min-h-[44px] items-center px-1 text-[14px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bb-press mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(255,90,31,0.28)] hover:bg-[#E84D15] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Signing In…
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="mt-7 space-y-3 text-center">
        <p className="text-[14px] text-[#A3A3A3]">
          New to Butcher Block?{" "}
          <Link
            to="/auth/sign-up"
            state={{ from: redirectTo }}
            className="inline-flex min-h-[44px] items-center font-semibold text-white underline-offset-4 hover:text-[#FF5A1F] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded"
          >
            Create an account
          </Link>
        </p>

        <button
          type="button"
          onClick={handleContinueAsGuest}
          className="bb-press inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-white/10 bg-[#242424] px-5 text-[14px] font-semibold text-[#D4D4D4] hover:bg-[#303030] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
