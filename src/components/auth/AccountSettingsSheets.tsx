import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { validatePasswordValue } from "@/lib/authUtils";
import { AuthTextField } from "./AuthTextField";
import { PasswordInput } from "./PasswordInput";
import { AuthErrorMessage } from "./AuthErrorMessage";

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileSheet({ open, onOpenChange }: EditProfileSheetProps) {
  const { user, profile, updateProfileDetails } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (open) {
      setDisplayName(
        profile?.display_name || String(user?.user_metadata?.full_name ?? ""),
      );
      setPhone(profile?.phone || "");
      setNameError(null);
      setFormError(null);
    }
  }, [open, profile?.display_name, profile?.phone, user?.user_metadata?.full_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;

    const cleaned = displayName.trim();
    if (cleaned.length < 2) {
      setNameError("Enter your name (at least 2 characters).");
      return;
    }

    saveLockRef.current = true;
    setSaving(true);
    setNameError(null);
    setFormError(null);

    try {
      const res = await updateProfileDetails({ displayName: cleaned, phone });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      toast.success("Profile updated");
      onOpenChange(false);
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[520px] rounded-t-[28px] border-t border-white/10 bg-[#1A1A1A] px-6 pb-[max(28px,env(safe-area-inset-bottom,0px))] pt-5 text-white"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-white">
            Edit Profile
          </SheetTitle>
          <SheetDescription className="text-[14px] text-[#A3A3A3]">
            Update your Butcher Block account details.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {formError && <AuthErrorMessage message={formError} variant="error" />}

          <AuthTextField
            id="edit-profile-name"
            name="name"
            type="text"
            autoComplete="name"
            label="Full name"
            placeholder="Your full name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            disabled={saving}
            required
          />

          <AuthTextField
            id="edit-profile-phone"
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            label="Phone number (optional)"
            placeholder="+264 81 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={saving}
          />

          <button
            type="submit"
            disabled={saving}
            className="bb-press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[15px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

interface ChangePasswordSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordSheet({ open, onOpenChange }: ChangePasswordSheetProps) {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (open) {
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      setConfirmError(null);
      setFormError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;

    const nextPassErr = validatePasswordValue(newPassword);
    const nextConfirmErr = !confirmPassword
      ? "Confirm your new password."
      : newPassword !== confirmPassword
        ? "Passwords don't match."
        : null;

    setPasswordError(nextPassErr);
    setConfirmError(nextConfirmErr);
    setFormError(null);
    if (nextPassErr || nextConfirmErr) return;

    saveLockRef.current = true;
    setSaving(true);

    try {
      const res = await updatePassword(newPassword);
      if (res.error) {
        setFormError(res.error);
        return;
      }
      toast.success("Password updated");
      onOpenChange(false);
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[520px] rounded-t-[28px] border-t border-white/10 bg-[#1A1A1A] px-6 pb-[max(28px,env(safe-area-inset-bottom,0px))] pt-5 text-white"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-white">
            Change Password
          </SheetTitle>
          <SheetDescription className="text-[14px] text-[#A3A3A3]">
            Choose a new password for your Butcher Block account.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {formError && <AuthErrorMessage message={formError} variant="error" />}

          <PasswordInput
            id="change-password-new"
            name="new-password"
            autoComplete="new-password"
            label="New password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (passwordError) setPasswordError(null);
              if (formError) setFormError(null);
            }}
            error={passwordError}
            showRequirement
            disabled={saving}
            required
          />

          <PasswordInput
            id="change-password-confirm"
            name="confirm-new-password"
            autoComplete="new-password"
            label="Confirm new password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmError) setConfirmError(null);
              if (formError) setFormError(null);
            }}
            error={confirmError}
            disabled={saving}
            required
          />

          <button
            type="submit"
            disabled={saving}
            className="bb-press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[15px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating…
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
