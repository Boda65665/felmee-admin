import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let registry;
let partnerSchema;
let bankErrorMessage;
let typeChangeFiles;
let bankStates;
let moneyFormat;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
  registry = await server.ssrLoadModule('/src/lib/api/business-registry.ts');
  ({ businessPartnerSchema: partnerSchema } = await server.ssrLoadModule('/src/lib/business-partner-form.ts'));
  ({ businessBankErrorMessage: bankErrorMessage } = await server.ssrLoadModule('/src/lib/business-bank-status.ts'));
  ({ typeChangeFiles } = await server.ssrLoadModule('/src/lib/document-types.ts'));
  bankStates = await server.ssrLoadModule('/src/lib/business-bank-status.ts');
  moneyFormat = await server.ssrLoadModule('/src/lib/format.ts');
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

test('document decisions are allowed only for a new application with a pending document', () => {
  assert.equal(registry.documentReviewBlockReason('NEW_APPLICATION', 'PENDING'), null);
  for (const [application, document] of [
    ['DOCUMENTS_VERIFIED', 'APPROVED'], ['DOCUMENTS_VERIFIED', 'PENDING'],
    ['NEEDS_CLARIFICATION', 'PENDING'], ['NEW_APPLICATION', 'APPROVED'],
    ['NEW_APPLICATION', 'REUPLOAD_REQUIRED'],
  ]) assert(registry.documentReviewBlockReason(application, document));
});

test('completion requires an existing draft, every pending decision, and an application under review', () => {
  const approved = { status: 'APPROVED', draft_decision: null };
  const pending = { status: 'PENDING', draft_decision: null };
  const draft = { status: 'PENDING', draft_decision: 'APPROVE' };
  assert(registry.documentReviewCompleteBlockReason('NEW_APPLICATION', [approved]));
  assert(registry.documentReviewCompleteBlockReason('NEW_APPLICATION', [pending]));
  assert(registry.documentReviewCompleteBlockReason('NEW_APPLICATION', [draft, pending]));
  assert(registry.documentReviewCompleteBlockReason('DOCUMENTS_VERIFIED', [draft]));
  assert(registry.documentReviewCompleteBlockReason('NEEDS_CLARIFICATION', [draft]));
  assert.equal(registry.documentReviewCompleteBlockReason('NEW_APPLICATION', [draft, approved]), null);
  assert.equal(registry.documentReviewCompleteBlockReason('NEW_APPLICATION', [{ ...draft, draft_decision: 'REQUEST_REUPLOAD' }]), null);
});

test('server review conflicts have understandable Russian messages', () => {
  for (const message of ['Application is not under review', 'Only a pending document can be reviewed', 'Document review state changed; reload the application']) {
    assert.match(registry.documentReviewErrorMessage(message), /[А-Яа-я]/u);
    assert.notEqual(registry.documentReviewErrorMessage(message), message);
  }
});

test('changing legal status sends all partner fields and excludes identity for LLC', () => {
  const values = { business_type: 'LLC', full_name: 'Owner', inn: '1234567890',
    phone: '+79991234567', email: 'owner@example.com', activity_type: 'Services',
    identity: { passport_number: '123456' }, comment: '' };
  const body = registry.buildBusinessPartnerPatch(values, { business_type: true }, 'IE');
  assert.deepEqual(body, { business_type: 'LLC', full_name: 'Owner', inn: '1234567890',
    phone: '+79991234567', email: 'owner@example.com', activity_type: 'Services' });
  assert.deepEqual(registry.buildBusinessPartnerPatch({ ...values, business_type: 'IE' }, { phone: true }, 'IE'), { phone: '+79991234567' });
  const individual = registry.buildBusinessPartnerPatch({ ...values, business_type: 'SE' }, { business_type: true }, 'LLC');
  assert.deepEqual(individual.identity, values.identity);
});

test('balance restrictions and legal status errors have understandable Russian messages', () => {
  for (const message of [
    'Business type or INN cannot change while old beneficiary has money',
    'Business type or INN cannot change while old business has a balance',
    'All partner fields are required when business_type changes',
    'identity is required when changing LLC to SE or IE',
    'business_type is not available for this account',
    'Approve the current application documents before changing business_type',
    'files must contain exactly the newly required documents',
  ]) assert.match(registry.documentReviewErrorMessage(message), /[А-Яа-я]/u);
});

test('registry checks explain duplicate INN, inactive NPD and liquidating businesses', () => {
  const cases = [
    ['Business INN already exists', /уже зарегистрирован/],
    ['Self-employed NPD status is inactive', /НПД/],
    ['Individual entrepreneur is inactive or liquidating', /ИП.*ликвидации/],
    ['Active LLC was not found or is liquidating', /ООО.*ликвидации/],
    ['Business was not found or is inactive', /не найден.*не действует/],
    ['Business registry verification is temporarily unavailable', /временно недоступ/],
    ['inn must contain exactly 10 digits for LLC', /10 цифр/],
    ['inn must contain exactly 12 digits for SE', /12 цифр/],
    ['inn must contain exactly 12 digits for IE', /12 цифр/],
  ];
  for (const [message, expected] of cases) {
    assert.match(registry.documentReviewErrorMessage(message), expected);
    assert.notEqual(registry.documentReviewErrorMessage(message), message);
  }
});

test('unknown technical errors stay in the console and Russian messages remain readable', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const message = registry.documentReviewErrorMessage('UNEXPECTED_REGISTRY_FAILURE');
  assert.match(message, /Не удалось выполнить действие/);
  assert(!message.includes('UNEXPECTED_REGISTRY_FAILURE'));
  assert.equal(warning.mock.calls.length, 1);
  assert.equal(warning.mock.calls[0].arguments[1], 'UNEXPECTED_REGISTRY_FAILURE');
  assert.equal(registry.documentReviewErrorMessage('Проверьте указанный ИНН.'), 'Проверьте указанный ИНН.');
  assert.equal(warning.mock.calls.length, 1);
});

test('individual partners require complete valid passport data before saving', () => {
  const identity = { registration_address: 'Москва', passport_series: '4510', passport_number: '123456',
    birth_date: '1990-01-01', passport_issue_date: '2010-01-01', department_code: '770-001', birth_place: 'Москва' };
  for (const business_type of ['SE', 'IE']) {
    assert(!partnerSchema.safeParse({ business_type }).success);
    for (const key of Object.keys(identity)) assert(!partnerSchema.safeParse({ business_type, identity: { ...identity, [key]: '' } }).success);
    assert(!partnerSchema.safeParse({ business_type, identity: { ...identity, passport_issue_date: '1989-01-01' } }).success);
    assert(partnerSchema.safeParse({ business_type, identity }).success);
  }
  assert(partnerSchema.safeParse({ business_type: 'LLC' }).success);
});

test('bank rejection codes have human explanations without displaying technical codes', () => {
  for (const code of ['PASSPORT_EXPIRED', 'IDENTITY_REJECTED', 'BENEFICIARY_REJECTED',
    'EXISTING_BENEFICIARY_MISMATCH', 'IDENTITY_CHECK_ERROR', 'OFFER_UPLOAD_ERROR',
    'DOCUMENTS_RETRY_LATER', 'INTEGRATION_ERROR', 'TOCHKA_6001', 'TOCHKA_4002', 'TOCHKA_4004', 'UNKNOWN_BANK_CODE']) {
    const message = bankErrorMessage(code);
    assert.match(message, /[А-Яа-я]/u);
    assert(!message.includes(code));
  }
  assert.equal(bankErrorMessage(null), null);
});

test('legal status changes require only the missing new documents and never reuse one file for two types', () => {
  const requirements = { required_documents: [
    { document_type: 'PASSPORT_MAIN', title: 'Паспорт', needs_upload: false },
    { document_type: 'LLC_DIRECTOR_APPOINTMENT', title: 'Приказ', needs_upload: true },
  ] };
  assert.throws(() => typeChangeFiles(requirements, {}), /Приказ/);
  assert.deepEqual(typeChangeFiles(requirements, { PASSPORT_MAIN: { fileId: 100 }, LLC_DIRECTOR_APPOINTMENT: { fileId: 123 } }), { LLC_DIRECTOR_APPOINTMENT: 123 });
  assert.throws(() => typeChangeFiles(requirements, { LLC_DIRECTOR_APPOINTMENT: { fileId: 0 } }));
  requirements.required_documents[0].needs_upload = true;
  assert.throws(() => typeChangeFiles(requirements, { PASSPORT_MAIN: { fileId: 123 }, LLC_DIRECTOR_APPOINTMENT: { fileId: 123 } }), /отдельный/);
});

test('Felmee balances are whole rubles and missing or unsafe amounts are never invented as zero', () => {
  assert.equal(moneyFormat.formatRubles?.(12500)?.replace(/\s/g, ''), '12500₽');
  assert.equal(moneyFormat.formatRubles?.(0)?.replace(/\s/g, ''), '0₽');
  for (const value of [undefined, null, -1, 12.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(moneyFormat.formatRubles?.(value), '—');
  }
});

test('bank verification confirms a migrated beneficiary only after the balance transfer is DONE', () => {
  assert.equal(bankStates.isBusinessApplicationConfirmed?.({ bank_status: 'VERIFIED' }), true);
  assert.equal(bankStates.isBusinessApplicationConfirmed?.({ bank_status: 'VERIFIED', balance_transfer_status: 'DONE' }), true);
  for (const balance_transfer_status of ['PENDING', 'READY', 'TRANSFERRING', 'PROCESSING', 'APPLYING', 'REVIEW_REQUIRED']) {
    assert.equal(bankStates.isBusinessApplicationConfirmed?.({ bank_status: 'VERIFIED', balance_transfer_status }), false);
  }
  for (const bank_status of ['NOT_SENT', 'UNDER_REVIEW', 'NOT_VERIFIED', 'TECHNICAL_ERROR']) {
    assert.equal(bankStates.isBusinessApplicationConfirmed?.({ bank_status, balance_transfer_status: 'DONE' }), false);
  }
});

test('active beneficiary transfers keep refreshing but manual review and waiting documents do not', () => {
  const card = { status: 'DOCUMENTS_VERIFIED', bank_status: 'VERIFIED' };
  for (const balance_transfer_status of ['READY', 'TRANSFERRING', 'PROCESSING', 'APPLYING', 'PENDING']) {
    assert.equal(bankStates.shouldPollBusinessApplication?.({ ...card, balance_transfer_status }, false), true);
  }
  assert.equal(bankStates.shouldPollBusinessApplication?.({ ...card, balance_transfer_status: 'DONE' }, false), false);
  assert.equal(bankStates.shouldPollBusinessApplication?.({ ...card, bank_status: 'UNDER_REVIEW', balance_transfer_status: 'REVIEW_REQUIRED' }, true), false);
  assert.equal(bankStates.shouldPollBusinessApplication?.({ status: 'NEW_APPLICATION', bank_status: 'NOT_SENT', balance_transfer_status: 'PENDING' }, false), false);
});

test('reserved funds and transfer review errors explain the required action without offering a repeat transfer', () => {
  assert.match(registry.documentReviewErrorMessage('Wait until reserved beneficiary funds are settled'), /зарезервирован/i);
  assert.match(registry.documentReviewErrorMessage('Wait until beneficiary balance migration finishes'), /перенос/i);
  assert.match(registry.documentReviewErrorMessage('Beneficiary transfer requires manual review'), /ручн.*сверк/i);
  assert.match(bankErrorMessage('TRANSFER_MISMATCH'), /сверк/i);
});
