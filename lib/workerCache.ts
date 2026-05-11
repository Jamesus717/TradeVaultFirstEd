export async function withWorkerCache(
  request: Request,
  ttlSeconds: number,
  createResponse: () => Promise<Response>
) {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache || request.method !== 'GET') {
    return createResponse();
  }

  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await createResponse();
  response.headers.set(
    'Cache-Control',
    `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`
  );

  if (response.ok) {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}

