# Реферальная программа (`/referral`) на живом admin-API — дизайн

Дата: 2026-10-17

## Цель

Переписать существующую страницу `src/pages/referral-program-page.tsx` на
реальные admin-эндпоинты рефералки из `openapi/feelme.json`. Все 4 вкладки
(«Партнёры», «Рефералы», «Проверка документов», «Уровни и ставки») сохраняем.
Демо-данные заменяем живыми **там, где бэк это покрывает**; где эндпоинтов нет —
UI остаётся, но каждый моковый блок помечается явным комментарием
`⚠️ TODO(бэкенд): …` в коде.

Источник правды по API — `openapi/feelme.json`. Типы уже сгенерированы в
`src/lib/api/schema.d.ts` (пути `/api/admin/referral/partners`, `/partners/{id}`,
`/partners/summary`, `/levels`, `/levels/{targetType}/{levelCode}` и схемы
присутствуют) — повторный `pnpm api:gen` не требуется, но перед стартом стоит
убедиться grep-ом.

## Что покрывается живым API, что остаётся моком

| Блок страницы | Источник |
|---|---|
| KPI «Активные партнёры» / «Общая сумма вознаграждений» / «Неактивные партнёры» | `GET /api/admin/referral/partners/summary` — **живой** |
| Вкладка «Партнёры» (таблица) | `GET /api/admin/referral/partners` — **живой** |
| Модалка «Информация о партнёре» — шапка/сводка | `GET /api/admin/referral/partners/{referral_user_id}` — **живой** |
| Модалка — вкладка «Приглашённые» | та же карточка, `referrals.items` — **живой** |
| Модалка — вкладка «Начисления» | **МОК** — эндпоинта начислений в API нет |
| Вкладка «Уровни и ставки» | `GET /levels` + `PATCH /levels/{targetType}/{levelCode}` — **живой** |
| Вкладка «Рефералы» (плоский список) | **МОК** — отдельного плоского эндпоинта нет (только приглашённые внутри карточки партнёра) |
| Вкладка «Проверка документов» | **МОК** — дублирует отдельную страницу `/documents` (business-registry) |

Все моковые блоки в коде должны нести комментарий вида
`⚠️ TODO(бэкенд): <что не покрыто> — данные демо.`

## Слой API — `src/lib/api/referral.ts`

Дополняем существующий модуль, **не ломая** текущие экспорты. Критично:
`useReferralRules` / `updateReferralRule` / `useUpdateReferralRule` /
`getReferralRules` / `AdminReferralRule` / `AdminReferralRuleUpdate` и
`useReferralProfit` / `getReferralProfit` остаются как есть — на них живёт
`loyalty-page.tsx` (`GET /referral/rules`, `PATCH /referral/rules/{ruleId}`,
`GET /referral/profit`). Новый код добавляется рядом.

Добавляем (хуки — обёртки над `useQuery`/`useMutation` внутри api-слоя, не инлайн
на странице; через `api` + `unwrap`, ошибки — `ApiError`):

- Типы (из `components["schemas"]`): `AdminReferralPartnerSummary`,
  `AdminReferralPartnerPage`, `AdminReferralPartnerItem`,
  `AdminReferralPartnerCard`, `AdminReferralInviteePage`, `AdminReferralInvitee`,
  `AdminReferralPartnerLevels`, `AdminReferralSystemLevel`,
  `AdminReferralSystemLevelsResponse` data (`client_line`/`business_line`).
  Плюс литеральные типы для `status` (ACTIVE/INACTIVE), уровневых кодов
  (START/DEVELOPMENT/PROFESSIONAL/STRATEGIC), `targetType` (CLIENT/BUSINESS),
  `referred_type` (CLIENT/MASTER/SALON), статуса приглашённого
  (WAITING_FOR_SERVICE/NOT_LINKED/ACTIVE/EARNINGS_COMPLETED).
- `getReferralPartnerSummary(params)` / `useReferralPartnerSummary({from,to})`
  → `GET /api/admin/referral/partners/summary`.
- `getReferralPartners(params)` / `useReferralPartners(params)`
  → `GET /api/admin/referral/partners`. Параметры: `from,to,search?,status?,
  client_level_code?,business_level_code?,offset,limit`. Возвращает
  `AdminReferralPartnerPage`. На странице — `keepPreviousData`.
- `getReferralPartnerCard(id, params)` / `useReferralPartnerCard(id, params)`
  → `GET /api/admin/referral/partners/{referral_user_id}`. Параметры
  `from?,to?,offset?,limit?`. Хук включается только при наличии `id`
  (`enabled: id != null`).
- `getReferralSystemLevels()` / `useReferralSystemLevels()` → `GET /api/admin/referral/levels`.
- `updateReferralLevelRate(targetType, levelCode, body)` /
  `useUpdateReferralLevelRate()` → `PATCH /api/admin/referral/levels/{targetType}/{levelCode}`,
  тело `{reward_percent}`; `onSuccess` инвалидирует `levels`.
- Расширяем `referralKeys` ключами `partnersSummary`, `partners`, `partnerCard`,
  `levels`.
- Реэкспорт новых хуков/типов в барреле `src/lib/api/index.ts`.

## 2. KPI (3 карточки) → `partners/summary`

Три `StatCard`, все из summary (сейчас одна живая от `stats.active_ambassadors`,
две демо — заменяем):

- «Активные партнёры» ← `active_partners_count`, дельта `active_partners_change_percent`, tone `brand`.
- «Общая сумма вознаграждений» ← `total_accrued_rub` (целые рубли; формат ₽ / млн
  через существующий `formatMillions`/`Intl`), дельта `total_accrued_change_percent`, tone `success`.
- «Неактивные партнёры» ← `inactive_partners_count`, дельта `inactive_partners_change_percent`, tone `warning`.

Дельты — через существующий хелпер `formatDelta` (знак + направление бейджа),
null-дельта → без бейджа. Состояния загрузки — значения-плейсхолдеры «—».

## 3. Вкладка «Партнёры» → `GET /partners`

Server-driven таблица на `DataTable` (как users/masters/appointments):

- Период — из страничного `DateFilter` → `from`/`to`.
- Поиск — `SearchInput` с дебаунсом → `search` (сброс `offset` на 0).
- Фильтр статуса — ACTIVE/INACTIVE (меню заголовка `SortMenu`/`CheckboxFilterMenu`-стиль).
- Фильтры уровня — **раздельно** клиентская линия (`client_level_code`) и бизнес-линия
  (`business_level_code`), значения START/DEVELOPMENT/PROFESSIONAL/STRATEGIC.
- Пагинация `offset/limit` по `total` (Prev/Next), `keepPreviousData`.
- Состояния: загрузка, ошибка (`ApiError.message`), пусто.

Колонки (решение подтверждено с пользователем — вместо одной «линии» показываем
оба уровня, т.к. у партнёра одновременно есть `levels.client` и `levels.business`):

1. **партнёр** — `AccountCell` (имя-ссылка → открывает карточку по
   `referral_user_id`; подпись — напр. `business_type`/роль, если есть).
2. **уровень клиента** — `LevelChip` из `levels.client` (`title` + `reward_percent`%).
3. **уровень бизнеса** — `LevelChip` из `levels.business`.
4. **рефералы** — `referrals_count`.
5. **всего начислено** — `total_accrued_rub` (₽).
6. **статус** — `StatusPill` ACTIVE «Активен» / INACTIVE «Неактивен».

`LevelChip` переиспользуем, тон — по `level_code` (START→зелёный, DEVELOPMENT→синий,
PROFESSIONAL→фиолетовый, STRATEGIC→оранжевый), а не по русскому имени.

## 4. Модалка «Информация о партнёре» → `partners/{id}` (переработка `PartnerInfoDialog`)

- Открывается кликом по имени партнёра; тянет `useReferralPartnerCard(id)`.
- Шапка: имя, `business_type` в подписи, две пилюли уровней (клиент+бизнес),
  статус ACTIVE/INACTIVE.
- Сводная полоска (живая): `referrals_count` (Рефералов), `total_accrued_rub`
  (Начислено всего, ₽), `activated_at` (Дата активации, формат даты; null → «—»).
- Вкладка **«Приглашённые»** (живая) из `referrals.items` (`AdminReferralInvitee`):
  колонки — реферал (`display_name` + `referred_type` CLIENT/MASTER/SALON),
  статус (4 состояния → подписи/тон:
  WAITING_FOR_SERVICE «Ждём первой услуги» warning,
  NOT_LINKED «Не привязан» grey/danger,
  ACTIVE «Активен» success,
  EARNINGS_COMPLETED «Начисления завершены» neutral),
  всего начислено (`total_accrued_rub` ₽), дата активации (`activated_at`).
  Если приглашённых > `limit` — пагинация страницы `referrals` (`offset/limit` по
  `referrals.total`); базово показываем первую страницу.
- Вкладка **«Начисления»** — **ОСТАЁТСЯ МОКОМ** (эндпоинта начислений нет),
  с явным комментарием `⚠️ TODO(бэкенд)`.
- Состояния загрузки/ошибки карточки.

Тип пропса модалки меняем с демо-`PartnerInfo` на живую карточку
(`AdminReferralPartnerCard`) — без структурного переиспользования демо-типа.

## 5. Вкладка «Уровни и ставки» → `/levels` (миграция с `/rules`)

- Источник — `useReferralSystemLevels()`: `client_line.levels[]` и
  `business_line.levels[]` (каждый `{level_code, title, reward_percent}`).
- Две секции (клиентская / бизнес-линия), карточки уровней из `levels[]` в
  порядке с бэка; название берём из `title` (убираем зашитый `LEVEL_NAMES`),
  тон — по `level_code`.
- Правка ставки в карточке → `useUpdateReferralLevelRate()`
  (`PATCH /levels/{CLIENT|BUSINESS}/{levelCode}` `{reward_percent}`): пендинг
  «Сохранение…», инлайн-ошибка, валидация 0–100, тост успеха как сейчас.
- Старые `useReferralRules`/`useUpdateReferralRule` на этой странице больше не
  используются (остаются в api-слое для `loyalty-page`).

## 6. Вкладки «Рефералы» и «Проверка документов» — мок (без изменений)

Остаются с текущими демо-данными. Обязательно пометить оба блока комментарием
`⚠️ TODO(бэкенд): <причина> — данные демо.`

## Нефункциональные требования / соглашения

- Хуки Query — в api-слое, не инлайн ([[react-query-hooks-in-api-layer]]).
- Импорты через `@/…`, внешние потребители — из баррелей.
- Стрелочные функции ([[prefers-arrow-functions]]), `cursor-pointer` на интерактиве.
- Без структурного объединения типов демо↔живые ([[no-structural-type-merging]]).
- Проверка после изменений — `pnpm build` (tsc + сборка) и `pnpm lint`.
- Деньги (`total_accrued_rub`) — целые рубли (по описанию схемы), показываем как ₽.

## Открытые вопросы к бэкендеру (зафиксировать в CLAUDE.md)

- Нет плоского эндпоинта «Рефералы» (только приглашённые внутри карточки партнёра).
- Нет эндпоинта «Начисления» для карточки партнёра.
- «Проверка документов» в разделе рефералки дублирует `/documents`.
