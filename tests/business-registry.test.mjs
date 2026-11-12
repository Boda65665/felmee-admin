import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let registry;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
});
after(async () => { await server?.close(); });

test('unchanged partner fields and blank comments do not enter a partial PATCH', () => {
  assert.deepEqual(registry.buildBusinessPatch({
    full_name: 'Existing owner', phone: ' +79991234567 ', comment: '   ', email: '',
  }, { phone: true, comment: true }), { phone: '+79991234567' });
});

test('blank edited fields cannot overwrite existing server values', () => {
  assert.deepEqual(registry.buildBusinessPatch({ bank_name: '', bik: ' 044525225 ' }, {
    bank_name: true, bik: true,
  }), { bik: '044525225' });
});

test('editing an identity field sends the full validated identity object', () => {
  const identity = { registration_address: 'Москва', passport_series: '4510',
    passport_number: '123456', birth_date: '1990-01-01', passport_issue_date: '2010-01-01',
    department_code: '770-001', birth_place: 'Москва' };
  assert.deepEqual(registry.buildBusinessPatch({ full_name: 'Existing owner', identity }, {
    identity: { passport_number: true },
  }), { identity });
});
