# Permanent Project Rules

## STRICT & PERMANENT RULE: NEVER CHANGE THE UI SHELL, LAYOUT, OR DESIGN SYSTEM

- **Preserve the UI Shell 100%**: Keep the exact existing UI/UX layout, component structures, circular floating plate cards (`MenuCard.tsx`), hero typography layout (`HomePageEditorial.tsx`), bottom floating pill nav (`BottomNav.tsx`), sheets, animations, and CSS/Tailwind tokens (`src/index.css`, `tailwind.config.ts`, `DESIGN_SYSTEM.md`) untouched.
- **No Layout or Style Restyling**: Never replace existing component layouts, card shapes, spacing, colors, or fonts.
- **Allowed Updates**: Only data (`src/data/*`), non-UI logic/hooks/services (`src/context/*`, `src/hooks/*`, `src/lib/*`, `src/services/*`), official brand logo assets, and restaurant contact/menu text strings may be updated when explicitly requested by the user.
