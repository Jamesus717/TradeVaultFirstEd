# Demo detail routes

Problem: in `npm run demo`, the four detail pages had no seeded data. They showed "sign in" or "Supabase missing" screens, and any made-up id still returned HTTP 200 with a client-side "not found" message.

What changed:
- `lib/demo.ts` seeds stable ids: `/inbox/demo-chat-1` (also `-2`, `-3`), `/profile/demo-sam`, `/u/sam`, `/shops/example-cards-leeds`. Alex, Robin and Jo work too.
- Each route's `page.tsx` is now a server component that calls `notFound()` when the id is unknown, then renders the old client page (renamed `*Client.tsx`). Bogus ids give a real 404, never a 500.
- `lib/detailRoutes.ts` does the check. Demo mode uses the seed data. Real mode checks the id shape (UUID or slug), and for shops and public slugs asks Supabase with the anon key. If that lookup errors, the page still renders.
- `app/not-found.tsx` is the shared 404 page.
- `audit:mobile` now visits the seeded ids.

Left: real-mode conversations are private (RLS), so an unknown but well-formed conversation id shows "Conversation unavailable", not a 404.
