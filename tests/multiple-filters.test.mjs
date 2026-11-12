import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

let server, referral, documents;
const originalFetch = globalThis.fetch;
const OriginalRequest = globalThis.Request;
let handler;
before(async () => {
  const memory = new Map();
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } };
  globalThis.Request = class extends OriginalRequest {
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, 'http://localhost:8080') : input, init); }
  };
  globalThis.fetch = (...args) => handler(...args);
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  referral = (await server.ssrLoadModule('/src/lib/api/referral-partner-filters.ts')).getReferralPartnersForLevels;
  documents = (await server.ssrLoadModule('/src/lib/api/business-application-filters.ts')).getBusinessApplicationsForTypes;
});
after(async () => { globalThis.fetch = originalFetch; globalThis.Request = OriginalRequest; delete globalThis.window; await server?.close(); });
const response = data => Response.json({ success: true, data });

test('all selected levels and statuses participate in requests; exhausted branches stop independently', async () => {
  const requests = [];
  handler = async request => {
    const p = new URL(request.url).searchParams;
    const client = p.get('client_level_code'), business = p.get('business_level_code'), status = p.get('status'), offset = Number(p.get('offset'));
    requests.push({ client, business, status, offset });
    assert.equal(p.get('from'), '2026-11-01');
    assert.equal(p.get('search'), 'partner');
    assert.equal(business, 'PROFESSIONAL');
    const id = `${client}-${status}-${offset}`;
    return response({ items: [{ referral_user_id: id }], total: client === 'START' ? 1 : 2, offset, limit: 1 });
  };
  const params = { from: '2026-11-01', to: '2026-11-11', search: 'partner', client_level_codes: ['START', 'DEVELOPMENT'], business_level_codes: ['PROFESSIONAL'], statuses: ['ACTIVE', 'INACTIVE'], limit: 1 };
  const first = await referral(params);
  assert.equal(requests.length, 4);
  assert.equal(first.items.length, 4);
  assert.equal(first.total, 6);
  const second = await referral(params, first.nextOffsets);
  assert.equal(requests.length, 6);
  assert(requests.slice(4).every(item => item.client === 'DEVELOPMENT' && item.offset === 1));
  assert.equal(second.items.length, 2);
  assert(second.nextOffsets.every(offset => offset === null));
});

test('multiple document business types preserve bank/status filters and their own page offsets', async () => {
  const requests = [];
  handler = async request => {
    const p = new URL(request.url).searchParams;
    const type = p.get('business_type'), offset = Number(p.get('offset'));
    requests.push({ type, offset });
    assert.equal(p.get('source'), 'BUSINESS');
    assert.equal(p.get('bank_status'), 'VERIFIED');
    assert(request.url.includes('NEW_APPLICATION') && request.url.includes('DOCUMENTS_VERIFIED'));
    return response({ items: [{ source: 'BUSINESS', business_type: type, business_entity_id: offset + 1 }], total: type === 'IE' ? 2 : 1, offset, limit: 1, has_more: type === 'IE' && offset === 0 });
  };
  const params = { source: 'BUSINESS', bank_statuses: ['VERIFIED'], business_types: ['IE', 'LLC'], statuses: ['NEW_APPLICATION', 'DOCUMENTS_VERIFIED'], limit: 1 };
  const first = await documents(params);
  assert.equal(first.items.length, 2, 'same numeric entity ID in two legal types remains two separate rows');
  assert.equal(first.total, 3);
  const second = await documents(params, first.nextOffsets);
  assert.deepEqual(requests, [{ type: 'IE', offset: 0 }, { type: 'LLC', offset: 0 }, { type: 'IE', offset: 1 }]);
  assert.equal(second.has_more, false);
});

test('document bank statuses combine with legal types as OR and paginate every branch independently', async () => {
  const requests = [];
  handler = async request => {
    const p = new URL(request.url).searchParams;
    const type = p.get('business_type'), bank = p.get('bank_status'), offset = Number(p.get('offset'));
    assert.equal(p.get('bank_statuses'), null, 'frontend arrays must not leak into scalar API parameters');
    assert.equal(p.get('source'), 'BUSINESS');
    assert.equal(p.get('search'), 'owner');
    assert.equal(p.get('submitted_from'), '2026-11-01');
    assert.deepEqual(p.getAll('statuses'), ['DOCUMENTS_VERIFIED']);
    assert(['NOT_VERIFIED', 'VERIFIED'].includes(bank), 'every request must use a selected bank status');
    const total = type === 'IE' ? bank === 'VERIFIED' ? 3 : 1 : bank === 'VERIFIED' ? 1 : 2;
    requests.push([type, bank, offset]);
    return response({ items: [{ source: 'BUSINESS', business_type: type, business_entity_id: (bank === 'VERIFIED' ? 200 : 100) + offset }], total, offset, limit: 1, has_more: offset + 1 < total });
  };
  const params = { source: 'BUSINESS', business_types: ['LLC', 'IE'], bank_statuses: ['VERIFIED', 'NOT_VERIFIED', 'VERIFIED'],
    search: 'owner', submitted_from: '2026-11-01', statuses: ['DOCUMENTS_VERIFIED'], limit: 1 };
  const first = await documents(params);
  assert.equal(first.items.length, 4);
  assert.equal(first.total, 7);
  assert.deepEqual(first.nextOffsets, [null, 1, 1, null]);
  const second = await documents(params, first.nextOffsets);
  assert.equal(second.items.length, 2);
  assert.deepEqual(second.nextOffsets, [null, 2, null, null]);
  const third = await documents(params, second.nextOffsets);
  assert.equal(third.items.length, 1);
  assert.equal(third.has_more, false);
  assert.deepEqual(requests, [
    ['IE', 'NOT_VERIFIED', 0], ['IE', 'VERIFIED', 0], ['LLC', 'NOT_VERIFIED', 0], ['LLC', 'VERIFIED', 0],
    ['IE', 'VERIFIED', 1], ['LLC', 'NOT_VERIFIED', 1], ['IE', 'VERIFIED', 2],
  ]);
});

test('all or no selected bank statuses use an unfiltered request and failed statuses are not silently omitted', async () => {
  const all = ['NOT_SENT', 'UNDER_REVIEW', 'VERIFIED', 'NOT_VERIFIED', 'TECHNICAL_ERROR'];
  for (const bank_statuses of [[], all, [...all, 'VERIFIED']]) {
    const requests = [];
    handler = async request => {
      const p = new URL(request.url).searchParams;
      requests.push(p);
      return response({ items: [], total: 0, offset: 0, limit: 20, has_more: false });
    };
    await documents({ source: 'BUSINESS', bank_statuses });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].has('bank_status'), false);
    assert.equal(requests[0].has('bank_statuses'), false);
  }
  handler = async request => new URL(request.url).searchParams.get('bank_status') === 'VERIFIED'
    ? Response.json({ success: false, error_code: 'internal_error', message: 'Failed bank branch' }, { status: 500 })
    : response({ items: [], total: 0, offset: 0, limit: 20, has_more: false });
  await assert.rejects(documents({ source: 'BUSINESS', bank_statuses: ['VERIFIED', 'NOT_VERIFIED'] }), /Failed bank branch/);
});

test('clearing all checkboxes sends one unfiltered request; a failed branch is not silently omitted', async () => {
  const requests = [];
  handler = async request => { requests.push(new URL(request.url)); return response({ items: [], total: 0, offset: 0, limit: 20 }); };
  const result = await referral({ from: '2026-11-01', to: '2026-11-11', client_level_codes: [], business_level_codes: [], statuses: [] });
  assert.equal(requests.length, 1);
  for (const key of ['client_level_code', 'business_level_code', 'status']) assert.equal(requests[0].searchParams.has(key), false);
  assert(result.nextOffsets.every(offset => offset === null));
  handler = async request => new URL(request.url).searchParams.get('client_level_code') === 'START'
    ? response({ items: [], total: 0, offset: 0, limit: 20 })
    : Response.json({ success: false, error_code: 'internal_error', message: 'Failed branch' }, { status: 500 });
  await assert.rejects(referral({ from: '2026-11-01', to: '2026-11-11', client_level_codes: ['START', 'DEVELOPMENT'] }), /Failed branch/);
});
