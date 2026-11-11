// Where the navigation goes, shared by the desktop rail and the phone tab bar.

export type NavKey = 'home' | 'binder' | 'trade' | 'matches' | 'messages' | 'shops' | 'profile' | 'more';

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  // Shorter label for the phone tab bar.
  short?: string;
};

export const RAIL_ITEMS: NavItem[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'binder', href: '/binder', label: 'Binder' },
  { key: 'trade', href: '/trade', label: 'Trade board', short: 'Trade' },
  { key: 'matches', href: '/matches', label: 'Matches' },
  { key: 'messages', href: '/inbox', label: 'Messages' },
  { key: 'shops', href: '/shops', label: 'Shops' },
  { key: 'profile', href: '/profile', label: 'Profile' },
];

// Phones get five; the rest live under Profile.
export const TAB_KEYS: NavKey[] = ['home', 'binder', 'trade', 'messages', 'profile'];

// Under "More" on the rail and on the Profile page on phones.
export const MORE_LINKS = [
  { href: '/matches', label: 'Matches' },
  { href: '/shops', label: 'Shops' },
  { href: '/collection', label: 'My collection' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/profile#settings', label: 'Settings' },
];

export function isActive(key: NavKey, href: string, pathname: string) {
  if (key === 'home') return pathname === '/';
  if (key === 'profile') return pathname.startsWith('/profile') || pathname.startsWith('/u/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

const PATHS: Record<NavKey, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h5v-6h4v6h5V9.5'],
  binder: ['M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5z', 'M9 3v18', 'M13 8h3', 'M13 12h3'],
  trade: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
  matches: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  messages: ['M4 5h16v11H8l-4 4z', 'M8 9.5h8', 'M8 12.5h5'],
  shops: ['M4 10l1.5-5h13L20 10', 'M5 10v10h14V10', 'M4 10h16', 'M10 20v-5h4v5'],
  profile: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
};

export function NavIcon({ name, className = 'h-6 w-6' }: { name: NavKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-small-text-ok
      className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-stone-950 ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function unreadLabel(label: string, count: number) {
  return count > 0 ? `${label}, ${count} unread` : label;
}
