export default function MyCollectionPage() {
  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col items-center justify-center gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.03] p-12 text-center backdrop-blur">
          <div className="mb-6 text-5xl">📦</div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
            Coming Soon
          </p>
          <h1 className="mb-3 text-3xl font-semibold text-white">My Collection</h1>
          <p className="text-sm leading-6 text-stone-400">
            A cross-set overview of everything you own, your completion rates, and
            duplicate inventory.
          </p>
        </div>
      </div>
    </main>
  );
}

