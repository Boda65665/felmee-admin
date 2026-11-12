import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

let server, suggestions, handler;
const originalFetch = globalThis.fetch;
const OriginalRequest = globalThis.Request;
before(async () => {
  const memory = new Map();
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } };
  globalThis.Request = class extends OriginalRequest {
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, 'http://localhost:8080') : input, init); }
  };
  globalThis.fetch = (...args) => handler(...args);
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  suggestions = await server.ssrLoadModule('/src/lib/api/suggestions.ts');
  const { useAuthStore } = await server.ssrLoadModule('/src/lib/auth/auth-store.ts');
  useAuthStore.getState().setTokens({ JWT: 'test-search-token', RT: '' });
});
after(async () => { globalThis.fetch = originalFetch; globalThis.Request = OriginalRequest; delete globalThis.window; await server?.close(); });

test('place search preserves FIAS and locality type using authenticated search endpoint', async () => {
  const places = [{ name: 'City', fias_id: 'city-fias', type: 'city' }, { name: 'Village', fias_id: 'village-fias', type: 'settlement' }];
  handler = async request => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/api/search/places');
    assert.deepEqual(Object.fromEntries(url.searchParams), { query: 'City', limit: '5' });
    assert.equal(request.headers.get('Authorization'), 'Bearer test-search-token');
    return Response.json({ success: true, data: places });
  };
  assert.deepEqual(await suggestions.getPlaceSuggestions('City'), places);
});

test('address search scopes identical street queries by both FIAS and city/settlement type and preserves numeric geo', async () => {
  for (const type of ['city', 'settlement']) {
    const place = { name: 'Place', fias_id: type + '-fias', type };
    const address = { address: 'Full address', lat: 55.7579, lon: 37.6144 };
    handler = async request => {
      const url = new URL(request.url);
      assert.equal(url.pathname, '/api/search/addresses');
      assert.deepEqual(Object.fromEntries(url.searchParams), { query: 'Street', fias_id: place.fias_id, type, limit: '10' });
      assert.equal(request.headers.get('Authorization'), 'Bearer test-search-token');
      return Response.json({ success: true, data: { items: [address] } });
    };
    assert.deepEqual(await suggestions.getPlaceAddressSuggestions('Street', place), [address]);
  }
});

test('saved city matches its FIAS without changing its display name; ambiguous and missing places require selection', () => {
  const moscow = { name: 'г Москва', fias_id: 'moscow', type: 'city' };
  const village = { name: 'посёлок Новый', fias_id: 'village', type: 'settlement' };
  assert.equal(suggestions.findSavedPlace([moscow, village], 'Москва'), moscow);
  assert.equal(suggestions.findSavedPlace([moscow], 'город МОСКВА'), moscow);
  assert.equal(suggestions.findSavedPlace([village], 'посёлок Новый'), village);
  assert.equal(suggestions.findSavedPlace([moscow, { ...moscow, fias_id: 'other' }], 'Москва'), null);
  assert.equal(suggestions.findSavedPlace([moscow], 'Казань'), null);
});
