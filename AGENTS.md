# Butcher Block Steakhouse — Project Rules & Guardrails

## Approved iOS-Style Design System (November 2026)

This is the production web application and mobile-first PWA for **Butcher Block Steakhouse** (Am Weinberg Estate, 13 Jan Jonker Street, Klein Windhoek, Windhoek, Namibia · Est. 2003).

- **Palette**: Main background `#121212`, card surfaces `#242424`, elevated surfaces `#303030`, primary orange `#FF5A1F` (used selectively for active navigation, primary CTAs, key prices, and selected states), primary text `#FFFFFF`, secondary text `#A3A3A3`, subtle borders `rgba(255,255,255,0.10)`.
- **Typography**: `Manrope` with system sans-serif fallback. Expressive headings, tight tracking, minimum `14px` for readable body copy, natural wrapping, and restrained uppercase labels.
- **Shape & Navigation**: Native iOS-inspired mobile bottom bar (`Home`, `Menu`, center circular `Cart`, `Book`, `More`) adapted into a clean desktop top navigation bar (`SiteHeader`) at `lg:` breakpoints. Minimum `44×44px` interactive touch targets, circular category imagery, soft feature radii, and zero obstructive floating widgets.
- **Motion**: Smooth, purposeful opacity/scale/translate transitions respecting `prefers-reduced-motion`. Never force a mandatory intro on internal home navigation.

## Strict Integrity, Security & Honesty Rules

- **Preserve Backend Contracts**: Keep all Supabase authentication, RLS policies, guest order/booking insert handling (`supabaseArrivalInsert.ts`), table availability RPC (`booked_table_times`), smart waitlist, realtime order updates, AI assistant (`RestaurantAssistantContext`), and `/admin` functionality intact.
- **Real Data Only**: Preserve the complete Namibian PDF food, wine, cocktail, jar, and shooter catalog in `src/data/menu.ts` with `N$` pricing and `Africa/Windhoek` business dates.
- **No Fabricated UI**: Never add fake card/mobile-money payment gateways, fake delivery fees, fake delivery drivers, fake star ratings, fake countdowns, or fake "Today's Special" claims unless backed by real restaurant-managed data.
- **Honest Photography**: Keep `menuArtwork(item).isExactDish` truthful (`verifiedImage: true` only for confirmed dish photography). Use clear category imagery or clean typographic fallbacks otherwise.
- **Verification**: Always verify `npx tsc --noEmit`, `eslint`, `npm test`, `npm run build`, and rendered mobile/desktop views before merging to `main`.
