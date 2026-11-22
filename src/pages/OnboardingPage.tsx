import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default function OnboardingPage() {
  const { isRecoverySession } = useAuth();

  if (isRecoverySession) {
    return <Navigate to="/auth/reset" replace />;
  }

  return <OnboardingFlow />;
}
