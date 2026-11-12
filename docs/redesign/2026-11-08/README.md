# Screens, 2026-11-08 (WS10: side rail, tab bar, match limits)

Taken from `npm run demo` (example data, Supabase blanked) with `node scripts/screens.mjs docs/redesign/2026-11-08`, which drives headless Edge over the DevTools protocol so it can hover the rail and press buttons.

| File | What |
| --- | --- |
| `rail-collapsed-desktop.png` | 1280 px, `/`. Icon rail, Messages with its unread badge. |
| `rail-expanded-desktop.png` | 1280 px, mouse over the rail: it widens to 240 px over the page and the labels fade in. |
| `rail-tablet-hover.png` | 900 px, `/binder`, mouse over the rail: tablets keep the icon rail, no expand. |
| `home-phone.png` | 375 px, `/`: Home with shortcuts, top matches and the five-tab bar. |
| `binder-phone.png` | 375 px, `/binder`. |
| `messages-phone.png`, `messages-desktop.png` | `/inbox`, now titled Messages, with example chats. |
| `profile-settings-phone.png`, `profile-settings-desktop.png` | `/profile`: the "Allow match requests" switch, and on phones the More links. |
| `limit-reached-phone.png`, `limit-reached-desktop.png` | Pressing Start trade with today's 10 used: the message the database raises. |

The script also checks the main pages at 375 px (`/`, `/binder`, `/inbox`, `/profile`, `/matches`, `/trade`, `/shops`, a shop, `/wishlist`, `/collection`): none scrolls sideways and every tap target is at least 44 px tall.

Rail animation: width 180 ms plus a 150 ms label fade; off under `prefers-reduced-motion` (the screens are taken with it forced on, so they show end states). It also opens on keyboard focus (`:focus-visible`), not after a mouse click.
