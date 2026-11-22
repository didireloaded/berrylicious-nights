import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import {
  clearPrivateAccountState,
  getAuthRedirectUrl,
  mapAuthError,
} from "@/lib/authUtils";

export interface Profile {
  display_name: string | null;
  phone: string | null;
  total_orders: number;
  total_visits: number;
  last_order: unknown;
  favorite_items?: string[] | null;
  loyalty_points?: number | null;
}

export type StaffRole = "admin" | "manager" | "kitchen" | "waiter" | null;

export interface SignInResult {
  error: string | null;
  needsVerification?: boolean;
}

export interface SignUpResult {
  error: string | null;
  needsVerification?: boolean;
  sessionCreated?: boolean;
}

export interface AuthActionResult {
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isRecoverySession: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  staffRole: StaffRole;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, name: string) => Promise<SignUpResult>;
  resendVerificationEmail: (email: string) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  updateProfileDetails: (details: { displayName: string; phone?: string }) => Promise<AuthActionResult>;
  clearRecoverySession: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEV_ADMIN_EMAILS = new Set(
  (import.meta.env.VITE_DEV_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean),
);

function detectUrlRecoveryParam(): boolean {
  if (typeof window === "undefined") return false;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState<boolean>(detectUrlRecoveryParam);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const inflightUserLoadRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, phone, total_orders, total_visits, last_order, favorite_items")
      .eq("user_id", userId)
      .maybeSingle();
    if (activeUserIdRef.current === userId) {
      setProfile(data ?? null);
    }
  }, []);

  const checkAdmin = useCallback(async (userId: string, email?: string | null) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (activeUserIdRef.current !== userId) return;

    const roles = (data ?? []).map((r) => String(r.role));
    if (roles.includes("admin")) {
      setIsAdmin(true);
      setStaffRole("admin");
      return;
    }
    if (roles.includes("manager")) {
      setIsAdmin(true);
      setStaffRole("manager");
      return;
    }
    if (roles.includes("kitchen")) {
      setIsAdmin(false);
      setStaffRole("kitchen");
      return;
    }
    if (roles.includes("waiter")) {
      setIsAdmin(false);
      setStaffRole("waiter");
      return;
    }
    if (import.meta.env.DEV && email && DEV_ADMIN_EMAILS.has(email.toLowerCase())) {
      setIsAdmin(true);
      setStaffRole("admin");
      return;
    }
    setIsAdmin(false);
    setStaffRole(null);
  }, []);

  const loadUserMetadata = useCallback(
    async (nextUser: User) => {
      if (inflightUserLoadRef.current === nextUser.id) return;
      inflightUserLoadRef.current = nextUser.id;
      try {
        await Promise.all([fetchProfile(nextUser.id), checkAdmin(nextUser.id, nextUser.email)]);
      } finally {
        if (inflightUserLoadRef.current === nextUser.id) {
          inflightUserLoadRef.current = null;
        }
      }
    },
    [fetchProfile, checkAdmin],
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      const nextUser = nextSession?.user ?? null;
      const prevId = activeUserIdRef.current;
      const nextId = nextUser?.id ?? null;
      activeUserIdRef.current = nextId;
      setSession(nextSession);
      setUser(nextUser);

      if (nextUser) {
        if (prevId !== nextId) {
          setTimeout(() => {
            if (mounted && activeUserIdRef.current === nextUser.id) {
              void loadUserMetadata(nextUser);
            }
          }, 0);
        }
      } else {
        inflightUserLoadRef.current = null;
        setProfile(null);
        setIsAdmin(false);
        setStaffRole(null);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
      } else if (event === "SIGNED_OUT") {
        setIsRecoverySession(false);
      }
      applySession(nextSession);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        applySession(initialSession);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        applySession(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserMetadata]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const mapped = mapAuthError(error, "sign-in");
        return { error: mapped.message, needsVerification: mapped.needsVerification };
      }
      setIsRecoverySession(false);
      return { error: null };
    } catch (err) {
      const mapped = mapAuthError(err, "sign-in");
      return { error: mapped.message, needsVerification: mapped.needsVerification };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<SignUpResult> => {
    try {
      const cleanedName = name.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: cleanedName },
          emailRedirectTo: getAuthRedirectUrl("/auth/verify"),
        },
      });
      if (error) {
        const mapped = mapAuthError(error, "sign-up");
        return { error: mapped.message };
      }

      // When email confirmation is enabled and an account already exists, Supabase may return
      // a user object with an empty identities array rather than exposing a duplicate-email error.
      const sessionCreated = Boolean(data.session);
      if (sessionCreated && data.user?.id) {
        // Ensure profile has display_name without creating duplicates (trigger already inserts row)
        await supabase
          .from("profiles")
          .upsert(
            { user_id: data.user.id, display_name: cleanedName || data.user.email || null },
            { onConflict: "user_id" },
          );
      }

      return {
        error: null,
        needsVerification: !sessionCreated,
        sessionCreated,
      };
    } catch (err) {
      const mapped = mapAuthError(err, "sign-up");
      return { error: mapped.message };
    }
  }, []);

  const resendVerificationEmail = useCallback(async (email: string): Promise<AuthActionResult> => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthRedirectUrl("/auth/verify"),
        },
      });
      if (error) {
        const mapped = mapAuthError(error, "verify");
        return { error: mapped.message };
      }
      return { error: null };
    } catch (err) {
      const mapped = mapAuthError(err, "verify");
      return { error: mapped.message };
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthRedirectUrl("/auth/reset"),
      });
      if (error) {
        const mapped = mapAuthError(error, "reset");
        if (mapped.isNetworkError || mapped.isRateLimited) {
          return { error: mapped.message };
        }
        // Do not leak whether a given email address exists on recovery
        return { error: null };
      }
      return { error: null };
    } catch (err) {
      const mapped = mapAuthError(err, "reset");
      return { error: mapped.message };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        const mapped = mapAuthError(error, "reset");
        return { error: mapped.message };
      }
      setIsRecoverySession(false);
      return { error: null };
    } catch (err) {
      const mapped = mapAuthError(err, "reset");
      return { error: mapped.message };
    }
  }, []);

  const updateProfileDetails = useCallback(
    async ({ displayName, phone }: { displayName: string; phone?: string }): Promise<AuthActionResult> => {
      const activeUserId = activeUserIdRef.current;
      if (!activeUserId) {
        return { error: "Please sign in to update your profile." };
      }
      const cleanedName = displayName.trim();
      const cleanedPhone = phone !== undefined ? phone.trim() || null : undefined;

      try {
        const updatePayload: {
          user_id: string;
          display_name: string | null;
          phone?: string | null;
        } = {
          user_id: activeUserId,
          display_name: cleanedName || null,
        };
        if (cleanedPhone !== undefined) {
          updatePayload.phone = cleanedPhone;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(updatePayload, { onConflict: "user_id" });

        if (profileError) {
          return { error: mapAuthError(profileError).message };
        }

        if (cleanedName) {
          await supabase.auth.updateUser({ data: { full_name: cleanedName } });
        }

        await fetchProfile(activeUserId);
        return { error: null };
      } catch (err) {
        return { error: mapAuthError(err).message };
      }
    },
    [fetchProfile],
  );

  const clearRecoverySession = useCallback(() => {
    setIsRecoverySession(false);
  }, []);

  const signOut = useCallback(async () => {
    clearPrivateAccountState();
    setIsRecoverySession(false);
    try {
      await supabase.auth.signOut();
    } catch {
      // Even if network fails, clear local user state safely
      activeUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setStaffRole(null);
    }
  }, []);

  const isStaff = isAdmin || staffRole !== null;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      isRecoverySession,
      isAdmin,
      isStaff,
      staffRole,
      signIn,
      signUp,
      resendVerificationEmail,
      requestPasswordReset,
      updatePassword,
      updateProfileDetails,
      clearRecoverySession,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      isRecoverySession,
      isAdmin,
      isStaff,
      staffRole,
      signIn,
      signUp,
      resendVerificationEmail,
      requestPasswordReset,
      updatePassword,
      updateProfileDetails,
      clearRecoverySession,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
