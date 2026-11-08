# Idea: price alerts

**What**
- Set a target £ on a wishlist card.
- "Now under your target" lists cards whose cached market price is at or below it, on the wishlist page and home.

**Why**
- A reason to come back: your list does something when prices drop.

**Try it in 2 minutes**
- `npm run demo`, open http://localhost:3100/wishlist (example prices).
- Type 7 in Pikachu's "Alert under £" box, press Enter. It joins the list.
- Screens: [phone](price-alerts/wishlist-phone.png), [desktop](price-alerts/wishlist-desktop.png), [home](price-alerts/home-phone.png).

**What's left (needs Borty)**
- Apply proposal `supabase/proposals/023_wishlist_target_price.sql` (rollback included). Until then the wishlist works as today.
- Decide if targets stay public (sellers would see your max).
- Email/push alerts need a scheduled price refresh. Not built.

Details: [price-alerts-notes.md](../price-alerts-notes.md).
