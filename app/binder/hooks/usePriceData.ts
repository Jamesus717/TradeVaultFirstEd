'use client';

import { useEffect, useState } from 'react';
import type { CardPrice } from '../types';

export function usePriceData(
  cardId: string,
  cardName: string,
  setName: string,
  variant: string,
  enabled: boolean = true
): CardPrice {
  const [price, setPrice] = useState<CardPrice>({
    priceLow: null,
    priceMid: null,
    priceHigh: null,
    currency: 'GBP',
    sampleSize: null,
    source: 'ebay_uk',
    fetchedAt: null,
    lowConfidence: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !cardId || !cardName) {
      // Delay state update slightly to avoid calling setState synchronously in effect
      const timer = setTimeout(() => {
        setPrice(prev => ({ ...prev, loading: false }));
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    async function fetchPrice() {
      setPrice(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const params = new URLSearchParams({
          cardId,
          cardName,
          setName: setName ?? '',
          variant: variant ?? '',
        });

        const response = await fetch(
          `/api/pokemon/price?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Price fetch failed');
        }

        const data = await response.json();

        if (!cancelled) {
          setPrice({
            priceLow: data.priceLow ?? null,
            priceMid: data.priceMid ?? null,
            priceHigh: data.priceHigh ?? null,
            currency: 'GBP',
            sampleSize: data.sampleSize ?? null,
            source: 'ebay_uk',
            fetchedAt: data.fetchedAt ?? null,
            lowConfidence: data.lowConfidence ?? false,
            loading: false,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setPrice(prev => ({
            ...prev,
            loading: false,
            error: 'Unavailable',
          }));
        }
      }
    }

    fetchPrice();
    return () => { cancelled = true; };
  }, [cardId, cardName, setName, variant, enabled]);

  return price;
}