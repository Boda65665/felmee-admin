import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { InfiniteQueryObserver, QueryClient, QueryClientProvider } from '@tanstack/react-query';

let server;
let nextOffset;
let uniqueBy;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  ({ nextOffset, uniqueBy } = await server.ssrLoadModule('/src/lib/infinite-scroll.ts'));
});
after(async () => server?.close());

test('offset advances by actual rows, and stops at the explicit end or empty pages', () => {
  assert.equal(nextOffset({ has_more: true }, 7, 20), 27);
  assert.equal(nextOffset({ has_more: false, total: 100 }, 7, 20), undefined);
  assert.equal(nextOffset({ has_more: true }, 0, 20), undefined);
});

test('total-based lists stop after the final result', () => {
  assert.equal(nextOffset({ total: 25 }, 20, 0), 20);
  assert.equal(nextOffset({ total: 25 }, 5, 20), undefined);
});

test('overlapping pages are deduplicated without conflating master and salon IDs', () => {
  const rows = [{ id: 1, role: 'MASTER' }, { id: 1, role: 'SALON' }, { id: 1, role: 'MASTER' }];
  assert.deepEqual(uniqueBy(rows, row => `${row.role}:${row.id}`), rows.slice(0, 2));
});

test('client pages append, keep loaded rows on errors, retry the same offset, and reset for filters', async () => {
  const originalFetch = globalThis.fetch;
  const OriginalRequest = globalThis.Request;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  let failNext = false;
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.Request = class extends OriginalRequest {
    constructor(input, init) {
      super(typeof input === 'string' ? new URL(input, 'http://localhost:8080') : input, init);
    }
  };
  globalThis.fetch = async request => {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset'));
    requests.push([offset, url.searchParams.get('query')]);
    if (failNext) return Response.json({ success: false, message: 'retry me' }, { status: 503 });
    const ids = offset === 0 ? [1, 2] : [2, 3];
    return Response.json({ success: true, data: { items: ids.map(id => ({ id })), has_more: offset === 0, offset, limit: 2 } });
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let observer;
  let unsubscribe;
  try {
    const { useInfiniteClients } = await server.ssrLoadModule('/src/lib/api/infinite-lists.ts');
    function Capture({ query }) {
      useInfiniteClients({ from: '2026-01-01', to: '2026-12-31', limit: 2, query });
      return null;
    }
    renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Capture)));
    const query = client.getQueryCache().getAll()[0];
    observer = new InfiniteQueryObserver(client, query.options);
    unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    assert.deepEqual(observer.getCurrentResult().data.items.map(row => row.id), [1, 2]);
    failNext = true;
    await observer.fetchNextPage();
    assert.equal(observer.getCurrentResult().isFetchNextPageError, true);
    assert.deepEqual(observer.getCurrentResult().data.items.map(row => row.id), [1, 2]);
    failNext = false;
    await observer.fetchNextPage();
    assert.deepEqual(observer.getCurrentResult().data.items.map(row => row.id), [1, 2, 3]);
    assert.equal(observer.getCurrentResult().hasNextPage, false);
    assert.deepEqual(requests.map(([offset]) => offset), [0, 2, 2]);
    renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Capture, { query: 'new filter' })));
    const filtered = client.getQueryCache().getAll().find(query => query.queryKey.at(-1).query === 'new filter');
    observer.setOptions(filtered.options);
    await observer.refetch();
    assert.deepEqual(requests.at(-1), [0, 'new filter']);
    assert.deepEqual(observer.getCurrentResult().data.items.map(row => row.id), [1, 2]);
  } finally {
    unsubscribe?.();
    client.clear();
    globalThis.fetch = originalFetch;
    globalThis.Request = OriginalRequest;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
