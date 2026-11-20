# Berrylicious product design and implementation guardrails

This is the existing Berrylicious Windhoek restaurant PWA, not a generic food-delivery demo.

## Design reference (approved 20 November 2026)
The primary screens follow the uploaded mobile concept featuring a full-bleed food hero, large editorial sans-serif headings, floating circular food visuals, a curved price panel and a restrained floating navigation pill. Adapt the composition to Berrylicious and Namibia rather than copying sample sushi products, USD prices, fake users or features.

- Background **#121212**, surface **#242424**, white text, muted gray secondary text
- Accent orange **#FF5A1F**, used for key actions and selected states, never gradients for decoration
- **Manrope** typography with deliberate size hierarchy and substantial breathing room
- Mobile-first, centered `max-w-[560px]` on desktop, no fake phone chrome
- Lucide icons, genuine navigation, accessible buttons and focus states
- Key screens: immersive landing (`/`), discovery (`/menu`), item detail (`/menu/:id`)
- Floating navigation on internal app screens with menu, real cart, search focus and the existing chat assistant
- Motion is minimal and respects reduced-motion; avoid excessive parallax and animate-on-scroll clutter

## Non-negotiable quality bar
Never ship generic AI-generated design patterns: no purple or neon gradients, glassmorphism everywhere, illegible 9px labels, random badge collections, meaningless glowing borders, repetitive bento-card layouts, fake activity, generic landing copy or decorative AI features that do nothing.

Each action must work using existing React Router, Supabase and application state. Maintain authenticated account access, reservation constraints, live ordering, cart pricing, waitlist, order tracking and admin functionality. Never invent hours, restaurant capacity, menu prices, promotions, special offers, staff recommendations or recent sales claims.

## Images
Legacy food assets show categories and are **illustrative**, not verified images of individual dishes. `menuArtwork(item)` exposes whether the image matches the exact dish. Only set `verifiedImage: true` in `src/data/menu.ts` after the restaurant provides or confirms a photograph of that specific dish. Replace with genuine approved food photography when available. Do not add unsplash placeholders or AI-generated photos.

## Product and engineering rules
- Namibia currency is **N$**, never example USD
- Restaurant business dates follow **Africa/Windhoek**
- Don't add undocumented charges or call a pickup charge a delivery fee
- Check the available reservation slot and reconfirm at submission
- Real AI chat is the existing `RestaurantChatSheet` behind `RestaurantAssistantContext`, which may ask guests to sign in
- Keep code organized, accessible and responsive at 320px, 375px and 390px
- Do not rewrite Supabase tables, RLS, auth or admin security just for design
- Check `npm run build`, `npm test` and TypeScript. Report failures, never invent results
- **Do not auto-publish production** until preview QA is complete

Note: the current public hostname references Butchers Block while the app is branded Berrylicious. Confirm final branding before any production release.


## November 2026 reference expansion

- Search has a real featured-only toggle, not a cosmetic filter switch.
- The category scroller uses circular photos with an orange selected ring. Category photos are illustrative and the visible category labels come from the actual menu.
- Quick action pills Ask / Menu / Contact / Explore must navigate to real features. "Ask" opens the existing assistant, which requires authentication where the app already requires it. Contact opens the actual About/contact sheet.
- The order banner must read real order state from Supabase when authorized. If only a local snapshot is available, clearly label it as last-known. Never invent drivers, ratings, exact ETAs, phone numbers or addresses.
- A floating cart summary shows actual quantities and totals and stays clear of the primary bottom navigation.
- The cart uses list rows, 44px-or-better quantity targets and an accurate N$ order summary. The real checkout currently places restaurant orders. There is **no integrated card-payment gateway**, so never show a fake Visa card, "Pay now" button, promo form or payment success.
- No placeholder maps or map/list toggle for a single restaurant. Add a map feature only when backed by verified locations and an actual map service.
- Avoid hard-coded USD prices, demo users, app reviews, Unsplash random photos and fake offer prices.
- Photo-led screens must remain usable on 320-390px phones, and every floating element must leave room for buttons and the safe area.
