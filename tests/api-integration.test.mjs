import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryCache, QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';

let server;
let client;
let store;
const originalFetch = globalThis.fetch;
const OriginalRequest = globalThis.Request;
let fetchHandler = () => { throw new Error('Unexpected network request in unit test'); };

before(async () => {
  globalThis.fetch = (...args) => fetchHandler(...args);
  const memory = new Map();
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
  };
  globalThis.window = { localStorage: globalThis.localStorage };
  globalThis.Request = class extends OriginalRequest {
    constructor(input, init) {
      super(typeof input === 'string' ? new URL(input, 'http://localhost:8080') : input, init);
    }
  };
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  client = await server.ssrLoadModule('/src/lib/api/client.ts');
  store = (await server.ssrLoadModule('/src/lib/auth/auth-store.ts')).useAuthStore;
});

after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.Request = OriginalRequest;
  delete globalThis.localStorage;
  delete globalThis.window;
  await server?.close();
});

test('typed document API preserves target type, optimistic revision and paginated history', async () => {
  store.getState().setTokens({ JWT: 'document-admin-token', RT: '' });
  const registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
  const key = { source: 'REFERRAL', businessType: 'IE', businessEntityId: 42 };
  const requests = [];
  fetchHandler = async request => {
    requests.push({ method: request.method, url: new URL(request.url), body: request.method === 'PUT' ? await request.json() : null });
    assert.equal(request.headers.get('Authorization'), 'Bearer document-admin-token');
    return Response.json({ success: true, data: request.url.includes('/requirements')
      ? { business_type: 'LLC', identity_required: false, required_documents: [] }
      : { items: [], total: 0, offset: 20, limit: 20 } });
  };
  await registry.getDocumentRequirements(key, 'LLC');
  await registry.putApplicationDocument(key, 'PASSPORT_MAIN', { file_id: 123, expected_revision: 2 });
  await registry.getDocumentHistory(key, 'PASSPORT_MAIN', 20);
  assert.equal(requests[0].url.searchParams.get('target_business_type'), 'LLC');
  assert.equal(requests[1].method, 'PUT');
  assert(requests[1].url.pathname.endsWith('/documents/by-type/PASSPORT_MAIN'));
  assert.deepEqual(requests[1].body, { file_id: 123, expected_revision: 2 });
  assert.equal(requests[2].url.searchParams.get('offset'), '20');
  assert.equal(requests[2].url.searchParams.get('limit'), '20');
  let failures = 0;
  fetchHandler = async () => { failures++; return Response.json({ success: false, message: 'Document revision changed; reload the application', error_code: 'conflict' }, { status: 409 }); };
  await assert.rejects(registry.putApplicationDocument(key, 'PASSPORT_MAIN', { file_id: 124, expected_revision: 2 }), error => error.status === 409);
  assert.equal(failures, 1, 'conflicts must not be silently retried with a new revision');
});

test('live camelCase document requirements and history normalize to the frontend contract', async () => {
  const registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
  const key = { source: 'REFERRAL', businessType: 'IE', businessEntityId: 42 };
  fetchHandler = async request => Response.json({ success: true, data: request.url.includes('/history') ? {
    items: [{ fileId: 123, documentType: 'PASSPORT_MAIN', revision: 2, filename: 'passport.pdf', contentType: 'application/pdf', sizeBytes: 100,
      status: 'PENDING', is_current: true, comment: null, reviewedAt: null, reviewedBy: null }], total: 1, offset: 0, limit: 20,
  } : { businessType: 'IE', requiredDocuments: [{ documentType: 'PASSPORT_MAIN', title: 'Паспорт', needsUpload: false }], identityRequired: false } });
  const requirements = await registry.getDocumentRequirements(key);
  assert.deepEqual(requirements, { business_type: 'IE', required_documents: [{ document_type: 'PASSPORT_MAIN', title: 'Паспорт', needs_upload: false }], identity_required: false });
  const history = await registry.getDocumentHistory(key, 'PASSPORT_MAIN');
  assert.equal(history.items[0].file_id, 123);
  assert.equal(history.items[0].content_type, 'application/pdf');
  assert.equal(history.items[0].is_current, true);
  fetchHandler = async () => Response.json({ success: true, data: {} });
  await assert.rejects(registry.getDocumentRequirements(key), error => error.code === 'invalid_response');
  await assert.rejects(registry.getDocumentHistory(key, 'PASSPORT_MAIN'), error => error.code === 'invalid_response');
});

test('legal status change retires queries at the old application address before refreshing the registry', async () => {
  const registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
  const key = { source: 'REFERRAL', businessType: 'IE', businessEntityId: 42 };
  const nextKey = { source: 'REFERRAL', businessType: 'LLC', businessEntityId: 84 };
  const card = { source: 'REFERRAL', business_type: 'LLC', business_entity_id: 84,
    status: 'NEW_APPLICATION', bank_status: 'NOT_SENT', bank_error_code: null,
    submitted_at: '2026-11-12T12:00:00Z',
    partner: { name: 'Test LLC', inn: '1234567890', phone: '+79991234567', email: 'owner@example.com', activity_type: 'Services', legal_status: 'LLC', identity: null },
    documents: [], requisites: null };
  const requests = [];
  const errors = [];
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: error => errors.push(error) }),
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const unsubscribers = [];
  const observe = (queryKey, queryFn, initialData) => {
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, initialData });
    unsubscribers.push(observer.subscribe(() => {}));
  };
  const page = { items: [], total: 0, offset: 0, limit: 20, has_more: false };
  const oldPath = '/api/admin/business-registry/applications/REFERRAL/IE/42';
  fetchHandler = async request => {
    const path = new URL(request.url).pathname;
    requests.push(`${request.method} ${path}`);
    if (request.method === 'PATCH') return Response.json({ success: true, data: card });
    if (path.startsWith(oldPath)) return Response.json({ success: false, error_code: 'not_found', message: 'Business application was not found' }, { status: 404 });
    return Response.json({ success: true, data: page });
  };
  let mutation;
  function Capture() {
    mutation = registry.useUpdateBusinessPartner();
    return null;
  }
  try {
    observe(registry.businessRegistryKeys.detail(key), () => registry.getBusinessApplication(key), { ...card, business_type: 'IE', business_entity_id: 42 });
    for (const kind of ['comments', 'infinite-comments', 'requirements', 'document-history']) {
      observe(['business-registry', kind, key], () => registry.getBusinessApplicationComments(key), page);
    }
    observe(registry.businessRegistryKeys.list({ source: 'REFERRAL' }), () => registry.getBusinessApplications({ source: 'REFERRAL' }), page);
    renderToString(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Capture)));
    assert.equal((await mutation.mutateAsync({ key, body: { business_type: 'LLC' } })).business_type, 'LLC');
    await new Promise(setImmediate);
    assert.deepEqual(requests.filter(request => request.startsWith('GET ') && request.includes(oldPath)), [], 'the old address no longer exists after PATCH succeeds');
    assert.deepEqual(errors, [], 'obsolete queries must not trigger the global error popup');
    assert.deepEqual(queryClient.getQueryData(registry.businessRegistryKeys.detail(nextKey)), card);
    assert(requests.includes('GET /api/admin/business-registry/applications'), 'the registry list must still refresh');
    assert.equal(queryClient.getQueryState(registry.businessRegistryKeys.detail(key)), undefined);
  } finally {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    queryClient.clear();
  }
});

test('bank status polling covers queued requests and active review, then stops at a final result', async () => {
  const registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
  const key = { source: 'REFERRAL', businessType: 'IE', businessEntityId: 42 };
  const queryClient = new QueryClient();
  function Capture({ queued }) {
    registry.useBusinessApplication(key, queued);
    return null;
  }
  try {
    for (const queued of [true, false]) {
      renderToString(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Capture, { queued })));
      const query = queryClient.getQueryCache().find({ queryKey: registry.businessRegistryKeys.detail(key), exact: true });
      for (const status of ['NOT_SENT', 'UNDER_REVIEW', 'VERIFIED', 'NOT_VERIFIED', 'TECHNICAL_ERROR']) {
        queryClient.setQueryData(registry.businessRegistryKeys.detail(key), { bank_status: status });
        const interval = query.options.refetchInterval?.(query) ?? false;
        const shouldPoll = status === 'UNDER_REVIEW' || queued && status === 'NOT_SENT';
        assert.equal(typeof interval === 'number' && interval > 0 && interval <= 5000, shouldPoll,
          `queued=${queued}, status=${status}: refresh while waiting for the bank, stop after completion`);
      }
    }
  } finally {
    queryClient.clear();
  }
});

test('accepted bank verification updates the card immediately without waiting for its background reload', async () => {
  const registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
  const key = { source: 'REFERRAL', businessType: 'IE', businessEntityId: 42 };
  const card = { source: 'REFERRAL', business_type: 'IE', business_entity_id: 42,
    status: 'DOCUMENTS_VERIFIED', bank_status: 'NOT_VERIFIED', bank_error_code: 'incorrect_registration_address',
    submitted_at: '2026-11-12T12:00:00Z',
    partner: { name: 'Test owner', inn: '123456789012', phone: '+79991234567', email: 'owner@example.com', activity_type: 'Services', legal_status: 'IE', identity: null },
    documents: [], requisites: null };
  const queued = { action: 'QUEUED', bank_status: 'NOT_SENT' };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  let releaseReload;
  const reload = new Promise(resolve => { releaseReload = resolve; });
  fetchHandler = request => request.method === 'POST'
    ? Promise.resolve(Response.json({ success: true, data: queued })) : reload;
  const observer = new QueryObserver(queryClient, {
    queryKey: registry.businessRegistryKeys.detail(key), queryFn: () => registry.getBusinessApplication(key), initialData: card,
  });
  const unsubscribe = observer.subscribe(() => {});
  let mutation;
  function Capture() { mutation = registry.useRequestBusinessBankVerification(); return null; }
  let request;
  let timer;
  try {
    renderToString(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Capture)));
    request = mutation.mutateAsync(key);
    const result = await Promise.race([request, new Promise(resolve => { timer = setTimeout(() => resolve(null), 200); })]);
    assert.deepEqual(result, queued, 'the accepted request must not wait for the card GET');
    const updated = queryClient.getQueryData(registry.businessRegistryKeys.detail(key));
    assert.equal(updated.bank_status, 'NOT_SENT', 'keep the actual API status while the UI shows the queued request');
    assert.equal(updated.bank_error_code, undefined, 'a new check clears the previous rejection');
  } finally {
    clearTimeout(timer);
    releaseReload(Response.json({ success: true, data: { ...card, bank_status: 'NOT_SENT', bank_error_code: undefined } }));
    await request;
    unsubscribe();
    queryClient.clear();
  }
});

test('protected document bytes include JWT and retry with refreshed JWT, without credentials in URL', async () => {
  store.getState().setTokens({ JWT: 'expired-document-token', RT: 'refresh-document-token' });
  const files = await server.ssrLoadModule('/src/lib/api/files.ts');
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  let downloads = 0;
  fetchHandler = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.endsWith('/api/auth/refresh-token')) {
      return Response.json({ success: true, data: { JWT: 'new-document-token', RT: 'new-rt' } });
    }
    downloads++;
    assert.equal(new URL(request.url).pathname, '/api/file/download/901');
    assert.equal(new URL(request.url).search, '?type=FULL');
    assert.equal(request.headers.get('Authorization'), downloads === 1 ? 'Bearer expired-document-token' : 'Bearer new-document-token');
    return downloads === 1 ? Response.json({ success: false }, { status: 401 }) : new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
  };
  const blob = await files.getDocumentBlob(901);
  assert.equal(downloads, 2);
  assert.equal(blob.type, 'application/pdf');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

test('signed storage links render directly, while API download links require authenticated bytes', async () => {
  const { isProtectedFileUrl } = await server.ssrLoadModule('/src/lib/api/files.ts');
  assert.equal(isProtectedFileUrl('https://storage.yandexcloud.net/bucket/document.pdf?signature=sample'), false);
  assert.equal(isProtectedFileUrl('http://localhost:8080/api/file/download/1071?type=FULL'), true);
  assert.equal(isProtectedFileUrl('/api/file/download/1071?type=FULL'), true);
});

test('inline viewer requests FULL inline=true redirect=false and accepts a signed link without fetching storage', async () => {
  store.getState().setTokens({ JWT: 'inline-token', RT: '' });
  const { getInlineDocument } = await server.ssrLoadModule('/src/lib/api/files.ts');
  const url = 'https://storage.yandexcloud.net/bucket/photo.png?response-content-disposition=inline&signature=sample';
  let calls = 0;
  fetchHandler = async (input, init) => {
    calls++;
    const request = new Request(input, init);
    const query = new URL(request.url);
    assert.equal(query.pathname, '/api/file/download/1071');
    assert.deepEqual(Object.fromEntries(query.searchParams), { type: 'FULL', inline: 'true', redirect: 'false' });
    assert.equal(request.headers.get('Authorization'), 'Bearer inline-token');
    return Response.json({ success: true, data: { status: 'UPLOADED', url } });
  };
  assert.deepEqual(await getInlineDocument(1071), { kind: 'url', url });
  assert.equal(calls, 1);
});

test('inline viewer supports binary photos and PDF documents as well as JSON links', async () => {
  const { getInlineDocument } = await server.ssrLoadModule('/src/lib/api/files.ts');
  for (const type of ['application/pdf', 'image/jpeg', 'image/png']) {
    fetchHandler = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': type } });
    const result = await getInlineDocument(1071);
    assert.equal(result.kind, 'blob');
    assert.equal(result.blob.type, type);
    assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), new Uint8Array([1, 2, 3]));
  }
});

test('PATCH body survives a consumed request and token refresh', async () => {
  store.getState().setTokens({ JWT: 'expired', RT: 'refresh' });
  const requests = [];
  fetchHandler = async input => {
    if (typeof input === 'string' && input.endsWith('/api/auth/refresh-token')) {
      return Response.json({ success: true, data: { JWT: 'renewed', RT: 'renewed-refresh' } });
    }
    const body = await input.text();
    requests.push({ body, token: input.headers.get('Authorization') });
    return requests.length === 1
      ? Response.json({ success: false, message: 'Expired' }, { status: 401 })
      : Response.json({ success: true, data: { city: 'Минск' } });
  };
  const response = await client.api.PATCH('/api/admin/clients/{id}', {
    params: { path: { id: 12 } }, body: { city: 'Минск' },
  });
  assert.equal(response.response.status, 200, JSON.stringify(requests));
  assert.deepEqual(requests, [
    { body: '{"city":"Минск"}', token: 'Bearer expired' },
    { body: '{"city":"Минск"}', token: 'Bearer renewed' },
  ]);
});

test('legacy codeError remains available when error_code is absent', () => {
  assert.throws(() => client.unwrap({
    error: { success: false, message: 'Некорректные данные', codeError: 'invalid_body' },
    response: new Response(null, { status: 400 }),
  }), error => error.code === 'invalid_body' && error.status === 400);
});

test('admin identity uses employee API instead of forbidden client profile', async () => {
  const paths = [];
  fetchHandler = async request => {
    const path = new URL(request.url).pathname;
    paths.push(path);
    if (path.endsWith('/me/permissions')) return Response.json({ success: true, data: {
      user_id: 321, permissions: [{ section: 'ROLES', access_level: 'READ' }],
    } });
    if (path.endsWith('/employees/321')) return Response.json({ success: true, data: {
      user_id: 321, first_name: 'Анна', last_name: 'Соколова', phone: '79991112233',
    } });
    return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
  };
  const { getCurrentUser } = await server.ssrLoadModule('/src/lib/api/current-user.ts');
  const user = await getCurrentUser();
  assert.equal(user.first_name, 'Анна');
  assert.equal(user.id, 321);
  assert.deepEqual(paths, ['/api/admin/employees/me/permissions', '/api/admin/employees/321']);
});

test('admin without ROLES access gets actual account ID without denied queries', async () => {
  let count = 0;
  fetchHandler = async () => {
    count++;
    return Response.json({ success: true, data: {
      user_id: 654, permissions: [{ section: 'ROLES', access_level: 'NONE' }],
    } });
  };
  const { getCurrentUser } = await server.ssrLoadModule('/src/lib/api/current-user.ts');
  const user = await getCurrentUser();
  assert.equal(user.id, 654);
  assert.equal(user.first_name, undefined);
  assert.equal(count, 1);
});

test('OTP request does not send CAPTCHA headers or depend on a token', async () => {
  fetchHandler = async request => {
    assert.equal(request.headers.has('captcha-token'), false);
    assert.deepEqual(await request.json(), { recipient: '+79991112233' });
    return Response.json({ success: true, data: { retry: { TTL: 45 } } });
  };
  const { sendPhoneOtp } = await server.ssrLoadModule('/src/lib/api/auth.ts');
  assert.equal(await sendPhoneOtp('+79991112233'), 45);
});

test('file uploads reject invalid numeric IDs instead of attaching another file', async () => {
  const { uploadFile } = await server.ssrLoadModule('/src/lib/api/files.ts');
  for (const id of ['', '0', '-1', '12.5', '9007199254740993', 'object-key']) {
    fetchHandler = async () => Response.json({ success: true, data: { file_id: id } });
    await assert.rejects(uploadFile(new File(['data'], 'document.txt'), 'DOCUMENT'));
  }
  fetchHandler = async () => Response.json({ success: true, data: { file_id: '123' } });
  assert.equal(await uploadFile(new File(['data'], 'document.txt'), 'DOCUMENT'), 123);
});

test('message file becomes sendable only after UPLOADED, not PENDING', async () => {
  const { waitForMessageFile } = await server.ssrLoadModule('/src/lib/support-upload.ts');
  let count = 0;
  fetchHandler = async () => Response.json({ success: true, data: { file_id: 10, status: ++count === 1 ? 'PENDING' : 'UPLOADED', url: null } });
  await waitForMessageFile(10);
  assert.equal(count, 2);
  fetchHandler = async () => Response.json({ success: true, data: { file_id: 11, status: 'FAILED', url: null } });
  await assert.rejects(waitForMessageFile(11), /обработать файл/);
});
