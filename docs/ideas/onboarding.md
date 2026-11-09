# Onboarding

Friendly empty states and a dismissable first-run guide. No migrations, no DB changes.

## What changed
- Home shows "Get started in 3 steps": add your first card, add a want, see matches.
- Steps tick from real data: owned cards in `user_cards`, rows in `wishlist_cards`, and any match. A failed count never shows the guide.
- Dismiss is remembered in this browser (`localStorage`). It hides when all three steps are done, when signed out, or while loading.
- Empty states: Binder (nothing owned yet), Wishlist, Messages (now uses the shared `EmptyState`), Matches. The Collection empty state now links to `/binder`.
- Logic is in `lib/firstRun.ts`, tested in `tests/firstRun.test.ts`. UI is `app/components/FirstRunGuide.tsx`.

## Demo
- `npm run demo` shows a full account, so the guide stays hidden.
- `DEMO_EMPTY=1 DEMO_PORT=3111 npm run demo` shows a brand new account. In the demo a step ticks when you open its link.

## Notes
- Phone text stays 14px or more, tap targets 44px. Side rail and bottom tabs untouched.
- Screenshots: `docs/redesign/2026-11-09/onboarding/`.
