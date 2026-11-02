// Example data for `npm run demo`. The new tables are not on production yet, so
// this is the only way to see the matching and shop pages. Nothing here is real:
// the traders and shops are made up, and every demo page says so.

import type { MatchRow } from './matching';
import type { Shop } from './shops';

export const demoMode = process.env.NEXT_PUBLIC_TB_DEMO === '1';

function shop(id: string, name: string, town: string, prefix: string, description: string): Shop {
  return {
    id,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    description,
    address: `1 Example Street, ${town}`,
    town,
    postcode_prefix: prefix,
    website: null,
    opening_hours: 'Example hours: Tue to Sat, 10 to 6',
    games: ['pokemon'],
    featured_until: null,
  };
}

export const DEMO_SHOPS: Shop[] = [
  {
    ...shop('demo-1', 'Example Cards Leeds', 'Leeds', 'LS1', 'Example shop. Trade tables at the back and a noticeboard for meets.'),
    featured_until: '2099-01-01T00:00:00Z',
  },
  shop('demo-2', 'Sample Games York', 'York', 'YO1', 'Example shop. League night on Thursdays.'),
  shop('demo-3', 'Placeholder TCG Sheffield', 'Sheffield', 'S1', 'Example shop. Binder swaps every Saturday.'),
];

function row(
  trader: [string, string],
  direction: MatchRow['direction'],
  number: number,
  name: string,
  extra: Partial<MatchRow> = {}
): MatchRow {
  return {
    trader_id: trader[0],
    username: trader[1],
    display_name: trader[1],
    direction,
    item_id: `${trader[0]}-${direction}-${number}`,
    card_id: `base1-${number}`,
    set_id: 'base1',
    card_name: name,
    set_name: 'Base',
    card_number: String(number),
    image_url: `https://images.pokemontcg.io/base1/${number}.png`,
    variant: 'Normal',
    condition: 'NM',
    tradable: 1,
    is_spare: false,
    want_priority: 'medium',
    ...extra,
  };
}

const sam: [string, string] = ['demo-sam', 'Sam (example)'];
const robin: [string, string] = ['demo-robin', 'Robin (example)'];
const alex: [string, string] = ['demo-alex', 'Alex (example)'];

export const DEMO_MATCHES: MatchRow[] = [
  row(robin, 'they_have', 15, 'Venusaur', { condition: null }),
  row(sam, 'they_have', 4, 'Charizard', { want_priority: 'high', condition: 'LP' }),
  row(sam, 'they_have', 58, 'Pikachu'),
  row(sam, 'i_have', 2, 'Blastoise', { is_spare: true }),
  row(alex, 'they_have', 16, 'Zapdos'),
  row(alex, 'i_have', 10, 'Mewtwo', { condition: 'MP' }),
  row(robin, 'i_have', 8, 'Machamp', { is_spare: true }),
  row(robin, 'i_have', 7, 'Hitmonchan'),
  row(['demo-jo', 'Jo (example)'], 'they_have', 1, 'Alakazam'),
];
