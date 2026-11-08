# Idea: fair-trade meter

**What it is**
- A panel showing each side's value in £, the gap in £ and %, and a **Fair / Slightly uneven / Uneven** badge.
- On every match card, and in the trade chat sidebar (the card vs the latest cash offer or the asking price).
- Reads the existing `card_prices` cache. No new tables or migrations.

**Why it pays**
- Strangers fear being ripped off. A neutral number starts more chats and closes more trades.
- Fewer "is this fair?" messages. Could later be a paid price check for shops.

**Try it in 2 minutes**
- `npm run demo`, open `localhost:3100/` and `/preview/fair-trade` (demo prices are made up).
- `npx vitest run tests/fairTrade.test.ts`

**Rules:** a gap of 10% or less is fair, up to 25% is slightly uneven, more is uneven. A gap of £2 or less is always fair. Unpriced cards count as £0 and are flagged.

**Left to do**
- Reverse holos are valued as the base print, because the cache stores only that.
- Cards not yet in the cache show "no price yet".
- Card-for-card offers in chat.

![Match cards](fair-trade-meter/matches-desktop.png)
![Trade chat sidebar](fair-trade-meter/chat-desktop.png)
