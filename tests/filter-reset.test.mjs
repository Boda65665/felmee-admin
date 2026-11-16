import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, hasChangedRange;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  ({ hasChangedRange } = await server.ssrLoadModule('/src/lib/filter-reset.ts'));
});
after(async () => { await server?.close(); });

test('same calendar days are the default period even when times differ', () => {
  const initial = { from: new Date(2026, 10, 1, 8), to: new Date(2026, 10, 30, 20) };
  const current = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) };
  assert.equal(hasChangedRange(current, initial), false);
});

test('empty and changed periods are counted as active filters', () => {
  const initial = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) };
  assert.equal(hasChangedRange(undefined, initial), true);
  assert.equal(hasChangedRange({ from: new Date(2026, 10, 2), to: initial.to }, initial), true);
});
