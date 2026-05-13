'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useCollection } from './useCollection';
import { useSetOwnedVariants } from './useSetOwnedVariants';

function SetExpandableCard({ 
  set, 
  userId,
  ownedRows,
}: { 
  set: ReturnType<typeof useCollection>['ownedSets'][0]; 
  userId: string;
  ownedRows: ReturnType<typeof useCollection>['ownedRows'];
}) {
  const [expanded, setExpanded] = useState(false);
  const { cards, loading } = useSetOwnedVariants({ selectedSetId: set.setId, ownedRows });

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] overflow-hidden transition-all duration-300">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.05] transition-colors"
      >
        {/* Left: Logo */}
        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-primary-400/10 border border-primary-300/20">
          {set.logoUrl ? (
            <div className="relative w-12 h-12">
              <Image 
                src={set.logoUrl} 
                alt={set.setName} 
                fill 
                className="object-contain"
                sizes="48px"
              />
            </div>
          ) : (
            <span className="text-xl font-bold text-primary-300">
              {set.setName.charAt(0)}
            </span>
          )}
        </div>

        {/* Centre: Name & Progress */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{set.setName}</h3>
          <p className="text-xs text-stone-400 truncate">{set.series}</p>
          
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div 
                className="h-full bg-primary-400 rounded-full" 
                style={{ width: `${set.completionPct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap">
              {set.ownedCount}/{set.totalCards} · {set.completionPct}%
            </span>
          </div>
        </div>

        {/* Right: Value & Chevron */}
        <div className="flex flex-col items-end gap-2 ml-4">
          <span className={`text-sm font-semibold ${set.estimatedValue > 0 ? 'text-primary-400' : 'text-stone-500'}`}>
            {set.estimatedValue > 0 ? `£${set.estimatedValue.toFixed(2)}` : '£0.00'}
          </span>
          <svg 
            className={`w-5 h-5 text-stone-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Grid */}
      <div 
        className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-5 bg-stone-950/30">
          {loading ? (
            <p className="text-sm text-stone-400 text-center py-4">Loading cards...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {cards.map((card) => {
                  return (
                    <div key={card.id} className="relative aspect-[5/7] rounded-xl overflow-hidden ring-1 ring-white/10 bg-stone-900">
                      {card.image ? (
                        <Image 
                          src={card.image} 
                          alt={card.name} 
                          fill 
                          className="object-cover"
                          sizes="(max-width: 640px) 33vw, 16vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] text-stone-500">
                          {card.baseCardId}
                        </div>
                      )}
                      {card.variant !== 'Normal' && card.variant !== 'Unlimited' && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-1 text-[9px] text-center text-stone-300 font-medium truncate">
                          {card.variant}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 text-center">
                <Link 
                  href={`/?set=${set.setId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  View in Binder
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CollectionPage() {
  const {
    user,
    loading,
    error,
    ownedRows,
    ownedSets,
    totalValue,
    totalCards,
    grailCards,
    incompleteSets,
    sparklineData,
  } = useCollection();

  const [sortMode, setSortMode] = useState<'value' | 'completion' | 'name' | 'recent'>('value');

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100 flex items-center justify-center">
        <p className="text-stone-400">Loading collection...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-stone-400">Please log in to view your collection.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100 p-8">
        <div className="max-w-7xl mx-auto rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-rose-200">
          Error: {error}
        </div>
      </main>
    );
  }

  if (ownedRows.length === 0) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur">
          <svg className="mx-auto h-16 w-16 text-stone-600 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h2 className="text-2xl font-semibold text-white">Your collection is empty</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-400 max-w-sm mx-auto">
            Start tracking cards in the Binder to see your portfolio and estimated value here.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-xl bg-primary-400 px-6 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300 transition-colors"
          >
            Go to Binder
          </Link>
        </div>
      </main>
    );
  }

  const sortedSets = [...ownedSets].sort((a, b) => {
    switch (sortMode) {
      case 'value': return b.estimatedValue - a.estimatedValue;
      case 'completion': return b.completionPct - a.completionPct;
      case 'name': return a.setName.localeCompare(b.setName);
      case 'recent': return 0; // Default order from hook is fine for now
      default: return 0;
    }
  });

  const bestCompletion = ownedSets.length > 0 
    ? Math.max(...ownedSets.map(s => s.completionPct)) 
    : 0;

  return (
    <main className="min-h-screen bg-transparent text-stone-100 pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* SECTION 1 — Hero / Portfolio Overview */}
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-300/80">
                  Portfolio Value
                </p>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                  £{totalValue.toFixed(2)}
                </h1>
                <p className="text-sm text-stone-300 pt-2">
                  across {ownedSets.length} sets · {totalCards} cards
                </p>
                <p className="text-[10px] text-stone-500 pt-1">
                  Prices powered by eBay UK
                </p>
              </div>

              <div className="w-full md:w-[400px] h-[120px] flex-shrink-0">
                {sparklineData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#34d399" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center border border-dashed border-white/10 rounded-xl">
                    <p className="text-xs text-stone-500 text-center px-4">
                      Price history will appear as data accumulates
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — Stats Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Total Value</p>
            <p className="mt-2 text-2xl font-semibold text-white">£{totalValue.toFixed(2)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Cards Owned</p>
            <p className="mt-2 text-2xl font-semibold text-white">{totalCards}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Sets Tracked</p>
            <p className="mt-2 text-2xl font-semibold text-white">{ownedSets.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Most Complete</p>
            <p className="mt-2 text-2xl font-semibold text-white">{bestCompletion}%</p>
          </div>
        </section>

        {/* SECTION 4 — Grail Cards */}
        {grailCards.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white px-2">Your Most Valuable Cards</h2>
            <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory hide-scrollbar">
              {grailCards.map((grail, i) => (
                <div key={`${grail.cardId}-${i}`} className="snap-start shrink-0 w-[140px] space-y-3">
                  <div className="relative aspect-[5/7] rounded-[1rem] overflow-hidden border border-white/10 bg-stone-900 shadow-lg">
                    {/* Placeholder image logic - would hook up to real images later */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-stone-800 to-stone-950">
                      <span className="text-[10px] text-stone-400 uppercase tracking-widest">{grail.setId}</span>
                      <span className="text-xs font-bold text-stone-300 mt-1">{grail.cardId.split('-')[1]}</span>
                    </div>
                  </div>
                  <div className="px-1">
                    <p className="text-sm font-semibold text-primary-400">£{grail.estimatedValue.toFixed(2)}</p>
                    <p className="text-xs text-stone-400 truncate mt-0.5">{grail.cardId}</p>
                    {grail.variant !== 'Normal' && grail.variant !== 'Unlimited' && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-stone-500 border border-stone-700 rounded px-1.5 py-0.5">
                        {grail.variant}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          
          {/* SECTION 3 — Your Sets */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-semibold text-white">Your Sets</h2>
              <select 
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'value' | 'completion' | 'name' | 'recent')}
                className="bg-transparent border-none text-sm text-stone-400 outline-none cursor-pointer hover:text-stone-300"
              >
                <option value="value">Value ↓</option>
                <option value="completion">Completion ↓</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
            
            <div className="space-y-3">
              {sortedSets.map(set => (
                <SetExpandableCard key={set.setId} set={set} userId={user.id} ownedRows={ownedRows} />
              ))}
            </div>
          </section>

          {/* SECTION 5 — Sets In Progress */}
          {incompleteSets.length > 0 && (
            <section className="space-y-4 lg:sticky lg:top-24">
              <h2 className="text-xl font-semibold text-white px-2">Sets In Progress</h2>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur space-y-5">
                {incompleteSets.slice(0, 5).map(set => (
                  <div key={set.setId} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-medium text-stone-200 truncate pr-4">{set.setName}</p>
                      <p className="text-xs text-stone-400 shrink-0">{set.completionPct}%</p>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-400/80 rounded-full" 
                        style={{ width: `${set.completionPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
