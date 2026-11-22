import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useAboutSheet } from "@/context/AboutSheetContext";
import {
  markOnboardingCompleted,
  savePendingRedirect,
  savePendingVerifyEmail,
  validateEmailAddress,
  validatePasswordValue,
} from "@/lib/authUtils";
import { AuthHeader } from "./AuthHeader";
import { AuthTextField } from "./AuthTextField";
import { PasswordInput } from "./PasswordInput";
import { AuthErrorMessage } from "./AuthErrorMessage";

interface SignUpFormProps {
  redirectTo: string;
}

export function SignUpForm({ redirectTo }: SignUpFormProps) {
  const { signUp } = useAuth();
  const { openAbout } = useAboutSheet();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const cleanedName = fullName.trim();
    const nextNameErr =
      cleanedName.length < 2 ? "Enter your full name." : null;
    const nextEmailErr = validateEmailAddress(email);
    const nextPasswordErr = validatePasswordValue(password);
    const nextConfirmErr = !confirmPassword
      ? "Confirm your password."
      : password !== confirmPassword
        ? "Passwords don't match."
        : null;

    setNameError(nextNameErr);
    setEmailError(nextEmailErr);
    setPasswordError(nextPasswordErr);
    setConfirmError(nextConfirmErr);
    setFormError(null);

    if (nextNameErr || nextEmailErr || nextPasswordErr || nextConfirmErr) return;

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      savePendingRedirect(redirectTo);
      const result = await signUp(email, password, cleanedName);
      if (result.error) {
        setFormError(result.error);
        return;
      }

      markOnboardingCompleted();

      if (result.sessionCreated) {
        toast.success("Account created");
        navigate("/auth/setup", { replace: true, state: { from: redirectTo } });
        return;
      }

      savePendingVerifyEmail(email);
      navigate("/auth/verify", {
        replace: true,
        state: { email: email.trim(), from: redirectTo },
      });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleExploreAsGuest = () => {
    markOnboardingCompleted();
    navigate(redirectTo === "/admin" || redirectTo === "/messages" ? "/home" : redirectTo, {
      replace: true,
    });
  };

  return (
    <div>
      <AuthHeader
        title="Join the Table."
        subtitle="Create your account and make every visit feel familiar."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <AuthErrorMessage message={formError} variant="error" />}

        <AuthTextField
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          label="Full name"
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            if (nameError) setNameError(null);
            if (formError) setFormError(null);
          }}
          error={nameError}
          disabled={submitting}
          required
        />

        <AuthTextField
          id="signup-email"
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

        <PasswordInput
          id="signup-password"
          name="password"
          autoComplete="new-password"
          label="Password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError(null);
            if (confirmError && confirmPassword === e.target.value) setConfirmError(null);
            if (formError) setFormError(null);
          }}
          error={passwordError}
          showRequirement
          disabled={submitting}
          required
        />

        <PasswordInput
          id="signup-confirm-password"
          name="confirm-password"
          autoComplete="new-password"
          label="Confirm password"
          placeholder="Re-enter your password"
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
              Creating Account…
            </>
          ) : (
            "Create Account"
          )}
        </button>

        <p className="pt-1 text-center text-[13px] leading-relaxed text-[#A3A3A3]">
          Your account is managed securely for Butcher Block Steakhouse, Windhoek.{" "}
          <button
            type="button"
            onClick={openAbout}
            className="font-semibold text-white/85 underline underline-offset-4 hover:text-[#FF5A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded"
          >
            Restaurant details &amp; contact
          </button>
        </p>
      </form>

      <div className="mt-6 space-y-3 text-center">
        <p className="text-[14px] text-[#A3A3A3]">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            state={{ from: redirectTo }}
            className="inline-flex min-h-[44px] items-center font-semibold text-white underline-offset-4 hover:text-[#FF5A1F] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded"
          >
            Sign In
          </Link>
        </p>

        <button
          type="button"
          onClick={handleExploreAsGuest}
          className="bb-press inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-white/10 bg-[#242424] px-5 text-[14px] font-semibold text-[#D4D4D4] hover:bg-[#303030] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          Explore as Guest
        </button>
      </div>
    </div>
  );
}
