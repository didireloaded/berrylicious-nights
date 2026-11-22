import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  clearPrivateAccountState,
  hasCompletedOnboarding,
  mapAuthError,
  markOnboardingCompleted,
  readAuthCallbackError,
  resolveWebmailInbox,
  sanitizeRedirectPath,
  validateEmailAddress,
  validatePasswordValue,
} from "@/lib/authUtils";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { PasswordInput } from "@/components/auth/PasswordInput";

describe("Authentication & Onboarding Security and Validation Helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("blocks open redirects and auth/onboarding redirect loops", () => {
    expect(sanitizeRedirectPath("https://evil.example/phish")).toBe("/home");
    expect(sanitizeRedirectPath("//evil.example/phish")).toBe("/home");
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/home");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/home");
    expect(sanitizeRedirectPath("/")).toBe("/home");
    expect(sanitizeRedirectPath("/auth")).toBe("/home");
    expect(sanitizeRedirectPath("/auth/sign-in")).toBe("/home");
    expect(sanitizeRedirectPath("/onboarding")).toBe("/home");

    // Valid internal routes preserve path, query, and hash
    expect(sanitizeRedirectPath("/cart")).toBe("/cart");
    expect(sanitizeRedirectPath("/menu/cc-ribeye")).toBe("/menu/cc-ribeye");
    expect(sanitizeRedirectPath("/profile?tab=orders#recent")).toBe("/profile?tab=orders#recent");
    expect(sanitizeRedirectPath("/admin")).toBe("/admin");
  });

  it("persists onboarding completion and recognizes legacy welcome flag", () => {
    expect(hasCompletedOnboarding()).toBe(false);
    localStorage.setItem("bb-welcome-seen", "1");
    expect(hasCompletedOnboarding()).toBe(true);

    localStorage.clear();
    sessionStorage.clear();
    markOnboardingCompleted();
    expect(hasCompletedOnboarding()).toBe(true);
  });

  it("validates email addresses and Supabase 6-character minimum passwords", () => {
    expect(validateEmailAddress("")).not.toBeNull();
    expect(validateEmailAddress("not-an-email")).not.toBeNull();
    expect(validateEmailAddress("guest@butcherblock.na")).toBeNull();

    expect(validatePasswordValue("")).not.toBeNull();
    expect(validatePasswordValue("12345")).not.toBeNull();
    expect(validatePasswordValue("123456")).toBeNull();
  });

  it("maps Supabase auth errors to helpful non-leaking customer messages", () => {
    const creds = mapAuthError({ message: "Invalid login credentials" }, "sign-in");
    expect(creds.message).toMatch(/didn't match/i);
    expect(creds.needsVerification).toBeUndefined();

    const unverified = mapAuthError({ message: "Email not confirmed" }, "sign-in");
    expect(unverified.needsVerification).toBe(true);

    const network = mapAuthError(new TypeError("Failed to fetch"), "sign-in");
    expect(network.isNetworkError).toBe(true);
    expect(network.message).toMatch(/connection/i);

    const rateLimited = mapAuthError({ message: "For security purposes, you can only request this after 42 seconds" }, "reset");
    expect(rateLimited.isRateLimited).toBe(true);

    const expired = mapAuthError({ message: "Email link is invalid or has expired" }, "reset");
    expect(expired.message).toMatch(/expired/i);
  });

  it("parses Supabase callback error parameters from hash or search", () => {
    expect(readAuthCallbackError("", "#error=access_denied&error_description=Email+link+is+invalid+or+has+expired")).toBe(
      "Email link is invalid or has expired",
    );
    expect(readAuthCallbackError("?error_code=otp_expired", "")).toBe("otp_expired");
    expect(readAuthCallbackError("", "")).toBeNull();
  });

  it("returns reliable webmail inbox links only for known providers", () => {
    expect(resolveWebmailInbox("didi@gmail.com")?.label).toBe("Open Gmail");
    expect(resolveWebmailInbox("didi@icloud.com")?.label).toBe("Open iCloud Mail");
    expect(resolveWebmailInbox("didi@customcompany.na")).toBeNull();
  });

  it("clears private account client state on sign-out while preserving guest cart & onboarding", () => {
    localStorage.setItem("berrylicious-cart", JSON.stringify([{ id: "cc-ribeye", name: "Rib Eye", price: 335, quantity: 1 }]));
    localStorage.setItem("bb-onboarding-complete", "1");
    localStorage.setItem("berrylicious-orders", JSON.stringify([{ id: "ord-1" }]));
    localStorage.setItem("berrylicious-bookings", JSON.stringify([{ id: "bk-1" }]));
    localStorage.setItem("butcher-block-favorites", JSON.stringify(["cc-ribeye"]));
    localStorage.setItem("butcher-block-guest-name", "Didi");

    clearPrivateAccountState();

    // Private account data removed
    expect(localStorage.getItem("berrylicious-orders")).toBeNull();
    expect(localStorage.getItem("berrylicious-bookings")).toBeNull();
    expect(localStorage.getItem("butcher-block-favorites")).toBeNull();
    expect(localStorage.getItem("butcher-block-guest-name")).toBeNull();

    // Cart and onboarding state preserved
    expect(localStorage.getItem("berrylicious-cart")).toContain("cc-ribeye");
    expect(localStorage.getItem("bb-onboarding-complete")).toBe("1");
  });
});

describe("OnboardingFlow & PasswordInput UI", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("walks through all 3 onboarding steps and exposes real guest, sign-in, and sign-up actions", () => {
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <OnboardingFlow />
      </MemoryRouter>,
    );

    expect(screen.getByText("A Cut Above the Rest.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^skip$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText("Find Your Perfect Cut.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByText("Make Yourself at Home.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i already have an account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explore as guest/i })).toBeInTheDocument();

    // Ensure no decorative social login buttons exist
    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/continue with apple/i)).not.toBeInTheDocument();
  });

  it("toggles password visibility accessibly in PasswordInput", () => {
    render(<PasswordInput id="pw-test" label="Password" value="secret1" onChange={() => undefined} showRequirement />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: /hide password/i })).toHaveAttribute("aria-pressed", "true");
  });
});
