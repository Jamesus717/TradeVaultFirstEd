// Example prices for `npm run demo` only, so the fair-trade meter has numbers
// to show. Made up and rounded; not market data. Keyed like card_prices.
export const DEMO_PRICES: Record<string, number> = {
  'base1-1': 35, // Alakazam
  'base1-2': 70, // Blastoise
  'base1-4': 180, // Charizard
  'base1-7': 40, // Hitmonchan
  'base1-8': 8, // Machamp
  'base1-10': 20, // Mewtwo
  'base1-15': 60, // Venusaur
  'base1-16': 22, // Zapdos
  'base1-58': 3, // Pikachu
  'sv3pt5-25': 2, // Pikachu (151)
};

// The demo user's own cards, for the chat's "Offer cards" picker. Electabuzz
// has no demo price on purpose, so the "no price yet" state shows; the 151
// Pikachu is a reverse holo, valued as its base print.
export const DEMO_MY_CARDS = [
  { card_id: 'base1-2', variant: 'Normal', name: 'Blastoise', number: '2' },
  { card_id: 'base1-8', variant: 'Normal', name: 'Machamp', number: '8' },
  { card_id: 'base1-7', variant: 'Normal', name: 'Hitmonchan', number: '7' },
  { card_id: 'base1-20', variant: 'Normal', name: 'Electabuzz', number: '20' },
  { card_id: 'sv3pt5-25', variant: 'Reverse Holo', name: 'Pikachu', number: '25' },
];
