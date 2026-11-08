import Link from 'next/link';
import { MORE_LINKS } from '../components/nav/items';

// Phones have five tabs; everything else is reachable from Profile.
export function MoreLinks() {
  return (
    <nav aria-label="More" className="rounded-xl border border-white/10 bg-white/[0.03] p-2 md:hidden">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold text-stone-400">More</p>
      <ul>
        {MORE_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-12 items-center justify-between rounded-lg px-3 text-sm text-stone-200 hover:bg-white/[0.05]"
            >
              {link.label}
              <span aria-hidden="true" className="text-stone-500">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
