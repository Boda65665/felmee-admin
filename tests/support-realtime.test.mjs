import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

test('support events refresh lists and open messages, including changes missed before reconnect', async () => {
  const originalWindow = globalThis.window;
  const originalWebSocket = globalThis.WebSocket;
  const memory = new Map();
  const sockets = [];
  class BrokerSocket {
    readyState = 0;
    subscriptions = new Map();
    constructor() {
      sockets.push(this);
      queueMicrotask(() => { this.readyState = 1; this.onopen?.({}); });
    }
    send(frame) {
      if (frame.startsWith('CONNECT')) {
        this.connect = frame;
        queueMicrotask(() => this.onmessage?.({ data: 'CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0' }));
      } else if (frame.startsWith('SUBSCRIBE')) {
        const destination = /\ndestination:([^\n]+)/.exec(frame)[1];
        const id = /\nid:([^\n]+)/.exec(frame)[1];
        this.subscriptions.set(destination, id);
      } else if (frame.startsWith('DISCONNECT')) this.close();
    }
    emit(destination, body = {}) {
      const id = this.subscriptions.get(destination);
      assert(id, `Missing subscription: ${destination}`);
      this.onmessage?.({ data: `MESSAGE\nsubscription:${id}\nmessage-id:1\ndestination:${destination}\n\n${JSON.stringify(body)}\0` });
    }
    close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' }); }
  }
  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) },
  };
  globalThis.WebSocket = BrokerSocket;
  const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  const socketModule = await server.ssrLoadModule('/src/lib/ws/support-socket.ts');
  const auth = (await server.ssrLoadModule('/src/lib/auth/auth-store.ts')).useAuthStore;
  const reads = (await server.ssrLoadModule('/src/lib/ws/read-store.ts')).useSupportReadStore;
  const refreshes = [];
  const waitFor = async predicate => {
    for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    assert.fail('Timed out waiting for STOMP');
  };
  try {
    auth.getState().setTokens({ JWT: 'test-jwt', RT: '' });
    socketModule.activateSupportSocket({ invalidateQueries: params => { refreshes.push(params); return Promise.resolve(); } });
    await waitFor(() => sockets[0]?.subscriptions.size === 4);
    assert.match(sockets[0].connect, /Authorization:Bearer test-jwt/);
    assert.equal(refreshes.length, 1, 'fetch changes missed before the connection was established');
    for (const destination of ['/user/queue/admin.support.new_message', '/user/queue/admin.support.delivered', '/user/queue/admin.support.status']) sockets[0].emit(destination);
    assert.equal(refreshes.length, 4);
    assert(refreshes.every(params => JSON.stringify(params.queryKey) === '["support-chats"]'));
    sockets[0].emit('/user/queue/chat.read_message', { dialog_id: 12, last_read_message_id: 42 });
    assert.equal(reads.getState().pointers[12], 42);
    sockets[0].close();
    await waitFor(() => sockets[1]?.subscriptions.size === 4);
    assert.equal(refreshes.length, 5, 'refresh again after reconnecting');
  } finally {
    socketModule.deactivateSupportSocket();
    await server.close();
    globalThis.window = originalWindow;
    globalThis.WebSocket = originalWebSocket;
  }
});
