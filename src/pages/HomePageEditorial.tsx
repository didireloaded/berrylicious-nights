import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { hasCompletedOnboarding } from "@/lib/authUtils";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";

/**
 * Root app entry (`/`):
 * - Restores active Supabase session cleanly before routing (prevents auth/onboarding flashes)
 * - Redirects password recovery callbacks directly to `/auth/reset`
 * - Sends returning visitors and signed-in customers directly to `/home`
 * - Presents the 3-step Butcher Block iOS onboarding flow to first-time guests
 */
export default function HomePageEditorial() {
  const { user, loading, isRecoverySession } = useAuth();
  const [searchParams] = useSearchParams();
  const forceIntro = searchParams.get("intro") === "1" || searchParams.get("onboarding") === "1";

  if (loading) {
    return <AuthLoadingState />;
  }

  if (isRecoverySession) {
    return <Navigate to="/auth/reset" replace />;
  }

  if (!forceIntro && (user || hasCompletedOnboarding())) {
    return <Navigate to="/home" replace />;
  }

  return <OnboardingFlow />;
}
