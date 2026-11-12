import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server, details, store, cooldown;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  ({ adminErrorDetails: details } = await server.ssrLoadModule('/src/lib/error-details.ts'));
  ({ useErrorPopupStore: store } = await server.ssrLoadModule('/src/lib/error-popup-store.ts'));
  ({ useCooldownStore: cooldown } = await server.ssrLoadModule('/src/lib/cooldown-store.ts'));
});
after(async () => { await server?.close(); });

test('API errors retain their code while the explanation is translated', () => {
  const error = Object.assign(new Error('Business INN already exists'), { code: 'conflict', status: 409 });
  assert.deepEqual(details(error), { message: 'Бизнес с таким ИНН уже зарегистрирован. Укажите другой ИНН или откройте существующую запись.', code: 'conflict', status: 409 });
  assert.match(details({ code: 'PASSPORT_EXPIRED' }).message, /паспорта/);
  assert.equal(details({ code: 'TOCHKA_6001' }).code, 'TOCHKA_6001');
  assert.equal(details('Заполните паспорт.').message, 'Заполните паспорт.');
  assert.equal(details('Заполните паспорт.').code, null);
});

test('one failure opens one popup and repeated attempts after closing remain visible', () => {
  store.setState({ items: [] });
  let dismissed = 0;
  const error = Object.assign(new Error('Business INN already exists'), { code: 'conflict' });
  store.getState().show(error, 'Не удалось сохранить', () => dismissed++);
  store.getState().show(error, 'Ошибка', () => dismissed++);
  assert.equal(store.getState().items.length, 1);
  store.getState().show({ code: 'PASSPORT_EXPIRED' });
  assert.equal(store.getState().items.length, 2);
  store.getState().dismiss();
  assert.equal(dismissed, 2);
  assert.equal(store.getState().items[0].code, 'PASSPORT_EXPIRED');
  store.getState().dismiss();
  store.getState().show(error);
  assert.equal(store.getState().items.length, 1);
  store.getState().dismiss();
});

test('rate limits with an active countdown do not open a second error dialog', () => {
  store.setState({ items: [] });
  cooldown.getState().start(30, 'too_many_request');
  let dismissed = false;
  store.getState().show(Object.assign(new Error('Too many requests'), { code: 'too_many_request', status: 429 }), undefined, () => { dismissed = true; });
  assert.equal(store.getState().items.length, 0);
  assert(dismissed);
  assert.equal(cooldown.getState().code, 'too_many_request');
  cooldown.getState().clear();
});
