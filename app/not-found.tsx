import { EmptyState } from './components/EmptyState';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <EmptyState title="Page not found" body="That link doesn't lead anywhere." action={{ label: 'Go home', href: '/' }} />
      </div>
    </main>
  );
}
