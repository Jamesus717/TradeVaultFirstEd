import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../../lib/pokemonServer';

export const revalidate = 300;

const OPTIONAL_TOKENS = new Set([
  'ex',
  'gx',
  'v',
  'vmax',
  'vstar',
  'mega',
  'break',
  'prime',
  'legend',
  'lvx',
]);

function escapeLucene(value: string) {
  return value.replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenizeSearch(value: string) {
  return value
    .split(/\s+/g)
    .map((raw) => {
      const trimmed = raw.trim();
      return { raw: trimmed, norm: normalizeToken(trimmed) };
    })
    .filter((token) => token.raw && token.norm);
}

function buildContainsQuery(tokens: Array<{ raw: string; norm: string }>) {
  return tokens
    .slice(0, 6)
    .map(({ raw }) => {
      const escaped = escapeLucene(raw);
      return `(name:*${escaped}* OR set.name:*${escaped}* OR number:*${escaped}*)`;
    })
    .join(' AND ');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get('name') ?? '').trim();
  const pageSizeRaw = url.searchParams.get('pageSize') ?? '20';

  if (!name) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  if (name.length > 60) {
    return NextResponse.json({ error: { message: 'Search term too long.' } }, { status: 400 });
  }

  const pageSizeNumber = Math.max(1, Math.min(36, Number.parseInt(pageSizeRaw, 10) || 20));
  const pageSize = String(pageSizeNumber);

  const tokens = tokenizeSearch(name);
  if (tokens.length === 0) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const primary = buildContainsQuery(tokens);
  const coreTokens = tokens.filter((token) => !OPTIONAL_TOKENS.has(token.norm));
  const core = coreTokens.length > 0 ? buildContainsQuery(coreTokens) : '';

  const q = core && core !== primary ? `(${primary}) OR (${core})` : primary;
  const search = new URLSearchParams({ q, pageSize, orderBy: '-set.releaseDate' });

  const response = await pokemonFetch(`/cards?${search.toString()}`, {
    next: { revalidate },
  });

  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
