import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

let server, clientPlaceLocation;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  ({ clientPlaceLocation } = await server.ssrLoadModule('/src/lib/master-client-place.ts'));
});
after(async () => { await server?.close(); });

test('new client place sends its base address and selected coordinates', () => {
  assert.deepEqual(clientPlaceLocation('г Москва, ул Тверская, 1', { lat: 55.76, lon: 37.61 }, 5, null), {
    service_location: 'CLIENT_PLACE', address: 'г Москва, ул Тверская, 1',
    geolocation: { lat: 55.76, lon: 37.61 }, radius_km: 5,
  });
});

test('radius-only edit preserves the existing center by omitting address and coordinates', () => {
  const existing = { address: 'г Москва, ул Тверская, 1', geolocation: { lat: 55.76, lon: 37.61 } };
  assert.deepEqual(clientPlaceLocation(existing.address, existing.geolocation, 10, existing), {
    service_location: 'CLIENT_PLACE', radius_km: 10,
  });
});

test('changing the base address sends the newly selected coordinates', () => {
  const existing = { address: 'Old', geolocation: { lat: 55.76, lon: 37.61 } };
  assert.deepEqual(clientPlaceLocation('New', { lat: 59.93, lon: 30.31 }, 20, existing), {
    service_location: 'CLIENT_PLACE', address: 'New',
    geolocation: { lat: 59.93, lon: 30.31 }, radius_km: 20,
  });
});
