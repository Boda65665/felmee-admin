import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

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
