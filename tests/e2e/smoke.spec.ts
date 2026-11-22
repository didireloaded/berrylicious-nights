import { expect, test } from "@playwright/test";

test.describe("Butcher Block Steakhouse — CI Smoke & Security Checks", () => {
  test("first-time onboarding, guest entry, cart persistence, and open-redirect protection", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    // 1. Fresh visit lands on 3-step onboarding with bottom navigation hidden
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /A Cut Above the Rest/i })).toBeVisible();
    await expect(page.locator('nav[aria-label="Primary navigation"]')).toHaveCount(0);

    await page.getByRole("button", { name: /^Get Started$/i }).click();
    await expect(page.getByRole("heading", { name: /Find Your Perfect Cut/i })).toBeVisible();

    await page.getByRole("button", { name: /^Continue$/i }).click();
    await expect(page.getByRole("heading", { name: /Make Yourself at Home/i })).toBeVisible();

    // 2. Explore as Guest -> enters /home and persists onboarding completion
    await page.getByRole("button", { name: /^Explore as Guest$/i }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('nav[aria-label="Primary navigation"]')).toHaveCount(1);

    // Returning visitor visiting `/` skips onboarding automatically
    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);

    // 3. Browse compact Food menu and add item to cart
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: /Our Menu/i })).toBeVisible();
    await page.locator('article button[aria-label^="Add "]').first().click();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /Your Cart/i })).toBeVisible();
    const cartCountBeforeAuth = await page.evaluate(
      () => JSON.parse(localStorage.getItem("berrylicious-cart") || "[]").length,
    );
    expect(cartCountBeforeAuth).toBeGreaterThanOrEqual(1);

    // 4. Open-redirect protection on auth route + cart stays intact
    await page.goto("/auth/sign-in?next=https://evil.example/phish");
    await expect(page.getByRole("heading", { name: /Welcome Back/i })).toBeVisible();
    await expect(page.locator('nav[aria-label="Primary navigation"]')).toHaveCount(0);
    await page.getByRole("button", { name: /Continue as Guest/i }).click();
    await expect(page).toHaveURL(/\/home$/);

    const cartCountAfterAuth = await page.evaluate(
      () => JSON.parse(localStorage.getItem("berrylicious-cart") || "[]").length,
    );
    expect(cartCountAfterAuth).toBe(cartCountBeforeAuth);

    // 5. Sign-up validation & expired reset-link recovery guidance
    await page.goto("/auth/sign-up");
    await expect(page.getByRole("heading", { name: /Join the Table/i })).toBeVisible();
    await page.fill("#signup-name", "Smoke Guest");
    await page.fill("#signup-email", "smoke@butcherblock.local");
    await page.fill("#signup-password", "secret1");
    await page.fill("#signup-confirm-password", "mismatch");
    await page.getByRole("button", { name: /^Create Account$/i }).click();
    await expect(page.getByText(/Passwords don't match/i)).toBeVisible();

    await page.goto("/auth/reset#error=access_denied&error_code=otp_expired");
    await expect(page.getByRole("heading", { name: /Reset Link Expired/i })).toBeVisible();

    // 6. Zero horizontal overflow on mobile viewport across key routes
    for (const route of ["/home", "/menu", "/drinks", "/cart", "/booking", "/profile", "/auth/sign-in"]) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `Horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    }

    expect(pageErrors).toEqual([]);
  });
});
