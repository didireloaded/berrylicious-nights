# Berrylicious

A mobile-first restaurant application for menu browsing, reservations, guest ordering, event updates, and restaurant operations in Windhoek, Namibia.

This project is built with React, TypeScript, Vite, Tailwind CSS, React Router and Supabase. The project is maintained through GitHub and Lovable.

## Local development

```bash
npm ci
npm run dev
```

Run checks before merging changes.

```bash
npm run build
npm test
npm run lint
```

The app requires the existing Supabase environment variables. Do not commit private service-role or administrator credentials. Public browser keys must still be protected by correctly configured Supabase row-level security.

## Main routes

- `/` - restaurant home and current updates
- `/menu` and `/menu/:id` - discovery and item details
- `/booking` and `/booking/success` - reservations
- `/cart` and `/order/:id` - ordering and tracking
- `/plan` - evening planner
- `/auth`, `/profile`, and `/messages` - customer services
- `/admin` - staff operations, protected by the existing auth and database access rules

## Content verification required

The public hostname `butchersblock.lovable.app` and the app's Berrylicious brand name do not match. Confirm the intended business and public domain before a production relaunch.

Menu item names, prices, promotions, opening hours and contact details were inherited from the original project and must be checked with restaurant management before public use. `src/data/menu.ts` references a small set of photos across many unrelated dishes. Dish photographs are intentionally hidden unless `verifiedImage: true` is set for an image verified to show that exact item. Replace with licensed, authentic photography before enabling that flag.

The previous cart added N$20 to every purchase as a fee without any delivery order option. That fee has been removed from pickup, pre-order and dine-in. Confirm the restaurant's actual fee policy before introducing any additional charge.

The old homepage remains at `src/pages/HomePage.tsx` for comparison. The active homepage is `src/pages/HomePageEditorial.tsx`.

## Deployment

Review and test changes in a pull request before merging to `main`. Verify guest booking, blocked slots, ordering, sign-up/sign-in, admin access, and mobile layout against the connected Supabase staging or production configuration as appropriate. Do not make test orders or bookings against live restaurant operations without permission.
