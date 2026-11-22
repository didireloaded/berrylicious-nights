import { useEffect } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  readPendingRedirect,
  sanitizeRedirectPath,
  savePendingRedirect,
} from "@/lib/authUtils";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { EmailVerificationState } from "@/components/auth/EmailVerificationState";
import { ProfileSetup } from "@/components/auth/ProfileSetup";

export type AuthScreenMode = "sign-in" | "sign-up" | "forgot" | "reset" | "verify" | "setup";

interface AuthLocationState {
  from?: string;
  email?: string;
}

interface AuthPageProps {
  mode?: AuthScreenMode;
}

function resolveMode(propMode: AuthScreenMode | undefined, queryMode: string | null): AuthScreenMode {
  if (propMode) return propMode;
  if (queryMode === "sign-up" || queryMode === "signup") return "sign-up";
  if (queryMode === "forgot") return "forgot";
  if (queryMode === "reset") return "reset";
  if (queryMode === "verify") return "verify";
  if (queryMode === "setup") return "setup";
  return "sign-in";
}

const AuthPage = ({ mode: propMode }: AuthPageProps) => {
  const { user, loading, isRecoverySession } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = (location.state as AuthLocationState | null) ?? null;
  const mode = resolveMode(propMode, searchParams.get("mode"));

  const rawFrom =
    state?.from ||
    searchParams.get("next") ||
    searchParams.get("redirect") ||
    readPendingRedirect("/home");
  const redirectTo = sanitizeRedirectPath(rawFrom, "/home");

  // Preserve safe intended destination across auth sub-screens and verification callbacks
  useEffect(() => {
    if (state?.from || searchParams.get("next") || searchParams.get("redirect")) {
      savePendingRedirect(redirectTo);
    }
  }, [state?.from, searchParams, redirectTo]);

  if (loading && mode !== "reset") {
    return <AuthLoadingState message="Checking your session…" />;
  }

  if (isRecoverySession && mode !== "reset") {
    return <Navigate to="/auth/reset" replace />;
  }

  // Already authenticated visitors skip sign-in / sign-up / forgot screens cleanly
  if (user && !isRecoverySession && (mode === "sign-in" || mode === "sign-up" || mode === "forgot")) {
    return <Navigate to={redirectTo} replace />;
  }

  // Optional profile setup requires an active authenticated session
  if (!user && mode === "setup") {
    return <Navigate to="/auth/sign-in" replace state={{ from: redirectTo }} />;
  }

  const backTarget =
    mode === "forgot" || mode === "verify" || mode === "reset"
      ? "/auth/sign-in"
      : redirectTo === "/admin" || redirectTo === "/messages"
        ? "/home"
        : redirectTo;

  return (
    <AuthLayout backTo={backTarget} hideBack={mode === "setup"}>
      {mode === "sign-in" && (
        <SignInForm redirectTo={redirectTo} initialEmail={state?.email} />
      )}
      {mode === "sign-up" && <SignUpForm redirectTo={redirectTo} />}
      {mode === "forgot" && (
        <ForgotPasswordForm initialEmail={state?.email} redirectTo={redirectTo} />
      )}
      {mode === "reset" && <ResetPasswordForm />}
      {mode === "verify" && (
        <EmailVerificationState initialEmail={state?.email} redirectTo={redirectTo} />
      )}
      {mode === "setup" && <ProfileSetup redirectTo={redirectTo} />}
    </AuthLayout>
  );
};

export default AuthPage;
