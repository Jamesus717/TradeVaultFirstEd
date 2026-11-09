import { ImageResponse } from 'next/og';
import type { ShareCard } from './shareCards';

export const SHARE_SIZE = { width: 1200, height: 630 };

// One layout for every card. Default font only: nothing is fetched at render time.
export function renderShareImage(card: ShareCard) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0c0a09',
          color: '#f5f5f4',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, color: '#fbbf24', fontWeight: 700 }}>TradeBinder</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{card.heading}</div>
          {card.stat ? (
            <div style={{ display: 'flex', fontSize: 40, color: '#a8a29e', marginTop: 24 }}>
              {card.stat} {card.statLabel}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#d6d3d1' }}>
          {card.topCards.length ? card.topCards.join('  |  ') : card.kind === 'generic' ? 'Track. Trade. Complete.' : ' '}
        </div>
      </div>
    ),
    SHARE_SIZE
  );
}
