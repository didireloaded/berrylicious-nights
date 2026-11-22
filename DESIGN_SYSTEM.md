# Butcher Block Steakhouse — Approved iOS-Style Design System

This document defines the approved visual design system and engineering guardrails for the **Butcher Block Steakhouse** (Am Weinberg Estate, Windhoek, Namibia) mobile-first PWA.

## 1. Visual Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Main background | `#121212` | Page canvas |
| Card surface | `#242424` | Menu cards, rows, summary panels, input fields |
| Elevated surface | `#303030` | Elevated controls, center cart tab, avatars, active hover states |
| Primary accent | `#FF5A1F` | Selected navigation, primary CTAs, active chips, key prices |
| Primary text | `#FFFFFF` | Headings, dish titles, primary labels |
| Secondary text | `#A3A3A3` | Descriptions, metadata, supporting copy |
| Subtle border | `rgba(255,255,255,0.10)` | Surface separation without heavy drop shadows |

## 2. Typography

- Primary typeface: **Manrope** (`system-ui, sans-serif` fallback).
- Page headings: expressive bold/extrabold (`28px–38px`), tight tracking (`-0.04em` to `-0.055em`).
- Ordinary readable body text: minimum `14px` with generous line height.
- Restrained uppercase eyebrow labels (`11px–12px`, `0.12em–0.16em` tracking).

## 3. Layout, Shape & Responsive Behavior

- **Mobile-first (`320px–560px`)**: Full-bleed edge-aware layouts respecting `env(safe-area-inset-*)` and `dvh` units.
- **Desktop (`>= 1024px`)**: Clean `SiteHeader` top navigation with wider balanced multi-column grids (`max-w-5xl` on catalog pages) — never a mobile bottom tab bar copied onto desktop.
- **Touch Targets**: All interactive buttons, steppers, and links maintain at least `44×44px` comfortable hit areas.
- **Icons**: Lucide icons used consistently across all screens; never use random emojis as UI icons.

## 4. Core Screens

1. **Welcome / Launch (`/`)**: Full-screen charcoal/black cinematic entry with the official Butcher Block logo, dark-vignetted close-up grill photography, and prominent `#FF5A1F` `Tap to Enter` pill transitioning smoothly into `/home`. Returning navigation to Home goes directly to `/home`.
2. **Home Dashboard (`/home`)**: Verified greeting & avatar, real active-order banner (when active), editorial `Premium Steaks & More` hero composition, 4 compact primary actions (`Order Food`, `Drinks`, `Reserve a Table`, `Events`), real featured grill dishes (`House Signatures`), active reservation card (when present), and live upcoming events.
3. **Food & Drinks Discovery (`/menu`, `/drinks`)**: Rounded search field + multi-criteria filter sheet (featured, favourites, price range, sort), horizontal circular category selector with `#FF5A1F` selected ring, full-width photographic editorial cards on mobile (`2-col` on tablet/desktop), real favourite toggle, and quick add-to-order.
4. **Item & Steak Detail (`/menu/:id`)**: Full-bleed food hero with back + real favourite toggle, dish title/price/description, inline cut/weight selector, doneness picker with official PDF guide, icon-grid complimentary side selector (`1 Included`), optional 14 PDF sauces, and sticky quantity + `#FF5A1F` `Add to Order` bar.
5. **Cart & Checkout (`/cart`)**: Clean vertical item rows with one-handed quantity controls, Pickup / Pre-order / Dine-in mode-specific fields, honest `N$` order summary (zero fake fees or fake payment forms), duplicate-submit protection, and real Supabase order submission.
6. **Reservations (`/booking`, `/booking/success`)**: Windhoek-local horizontal date strip + date picker, live Supabase `booked_table_times` availability with visibly disabled taken slots, pre-submit recheck, smart waitlist, and confirmed Reservation Number + QR code.
7. **Order Tracking & Receipt (`/order/:id`, `ActiveOrderBanner`)**: Real Supabase statuses (`Order received`, `Preparing`, `Ready for collection`, `Completed`), kitchen ETA only when genuinely set, compact progress bar, arrival QR code, and always-open itemized receipt.

## 5. Strictly Prohibited Patterns

- No fake payment methods, card entry screens, or fake payment confirmations.
- No fake delivery drivers, star ratings, delivery fees, or fabricated live countdowns.
- No purple/neon gradients, heavy glassmorphism, glowing borders, obstructive floating widgets, or generic SaaS bento grids.
- No unverified dish photography claimed as exact (`verifiedImage` remains truthful in `src/lib/menuArtwork.ts`).
