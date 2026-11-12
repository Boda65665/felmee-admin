# CLAUDE.md

Контекст для работы с Claude Code над проектом **Felmee Admin**.

## О проекте

Административная панель Felmee. Реализуется по макету из Figma. В этом
репозитории — **только админ-панель**. Лендинг (несколько страниц) будет
делаться отдельно и сюда не входит.

## Стек

- **Vite 8** + **React 19** + **TypeScript**
- **React Router 7** — маршрутизация (`BrowserRouter`, пути в `src/lib/routes.ts`)
- **Tailwind CSS v4** (через плагин `@tailwindcss/vite`, конфигурация в `src/index.css`)
- **shadcn/ui** — база Radix, пресет Nova (иконки Lucide, шрифт Geist)
- **Данные/бэкенд:** OpenAPI-спек (`openapi/feelme.json`) → типы `openapi-typescript`,
  клиент `openapi-fetch`, серверный стейт — **TanStack Query**, стор авторизации — **zustand**
- **Realtime:** STOMP поверх SockJS (`@stomp/stompjs` + `sockjs-client`) — чат
  поддержки (`src/lib/ws/`); endpoint `/ws`, JWT в STOMP-заголовке `Authorization`
- **Формы:** **react-hook-form** (стейт формы) + **zod** через `@hookform/resolvers/zod`
  (валидация). Ошибки действий и загрузки — общий попап с пояснением и кодом API; ошибки полей остаются у полей.
- Пакетный менеджер — **pnpm**

## Команды

```bash
pnpm dev       # дев-сервер
pnpm build     # tsc -b && vite build — использовать для проверки типов и сборки
pnpm lint      # oxlint
pnpm preview   # предпросмотр прод-сборки
pnpm api:gen   # генерация типов из openapi/feelme.json → src/lib/api/schema.d.ts
```

## Бэкенд-интеграция

- **Источник правды по API** — `openapi/feelme.json` (полный внутренний спек Felmee).
  Читать точечно (`jq`), не тащить целиком. Типы: `pnpm api:gen`. Docs: https://docs.felmee.com/openapi
- **Слой API** (`src/lib/api/`): `client.ts` (типизированный `api` + `unwrap`/`ApiError`
  под единый конверт `{ success, message, error_code, data }` + refresh на 401),
  `auth.ts` (`sendPhoneOtp` / `loginByPhone` / `logout`), доменные модули
  (`clients`/`records`/`complaints`/`referral`/`support`/`categories`/`employees`/
  `action-history`/`suggestions`), `files.ts` (multipart-загрузка `uploadFile` +
  `useFileUrl` — временная ссылка по int64-id), баррель `@/lib/api`.
- **Авторизация** (`src/lib/auth/`): `auth-store.ts` (zustand + persist, пара токенов
  `JWT`/`RT`), `use-auth.ts` (`useAuth` → `isAuthenticated` + `logout`),
  `protected-route.tsx` (`ProtectedRoute` — строго пускает только при наличии токена,
  иначе редирект на `/login`; dev-обхода нет).
- **Логин админа:** phone + OTP, `type_account = ADMIN`. CAPTCHA удалена по указанию владельца проекта.
- **Выход:** модалка подтверждения в `app-shell.tsx` → `logout()` (гасит сессию на
  сервере `POST /api/auth/logout` + чистит токены) → редирект на `/login` (`replace`).
- **Env:** `VITE_API_BASE_URL` (пусто → Vite-прокси на localhost:8080). См. `.env.example`.
- **Транспорт токенов:** Bearer-заголовок + пара токенов в localStorage (`persist`).
  Бэкенд принимает токен и заголовком `Authorization: Bearer {JWT}`, и cookie
  `JWT={JWT}` — осознанно выбран Bearer + localStorage; на cookie не переезжаем.

Проверка «всё ли цело» после изменений — `pnpm build` (гоняет tsc + сборку Vite).

## Вопросы к бэкендеру

Актуальные ограничения и проверка API ведутся в `docs/api-integration.md`.
Основные: график лояльности отвечает 500; нет собственного профиля ADMIN без
ROLES; для смены юрстатуса нужны метаданные документов владельца; доставка
уведомлений не реализована текущим MVP. Демоданные остались только в обзоре
бизнеса и его финансовых деталях. Основные списки используют бесконечную прокрутку.

## Соглашения

- **Формы:** `useForm` + `zodResolver(schema)`; поля через `register(...)` (общий
  `Field` из `profile-form.tsx` пробрасывает `register` и показывает ошибку).
  Отправка — async `onSubmit`/`onSave`, пендинг из `formState.isSubmitting`,
  серверная ошибка ловится в `catch` и рисуется инлайном. Сброс под предзаполнение
  при открытии модалки. На RHF+zod: `EmployeeFormDialog`, `UserEditDialog`,
  `CategoryFormDialog` (остальные формы мигрируем по мере доработки).
- **Алиас путей:** `@/*` → `src/*`. Импортировать через `@/...`, не относительными путями.
- **Баррели (`index.ts`):** внешние потребители импортируют из барреля папки —
  `@/components`, `@/components/ui`, `@/pages`. Внутри самих папок компоненты
  ссылаются друг на друга **прямыми путями** к файлам (не через баррель), иначе
  возникают циклы. Новый компонент/экран — добавить строку реэкспорта в `index.ts`.
- **UI-компоненты:** через `pnpm dlx shadcn@latest add <name>` — попадают в `src/components/ui/`,
  дальше редактируются как собственный код.
- **Стили:** Tailwind-утилиты; тема и токены — CSS-переменные в `src/index.css`
  (`@theme inline` + `:root` / `.dark`). Цвета в формате oklch. Класс `cn()` из `@/lib/utils` для объединения классов.
- **Бренд-токены (из Figma):** `--brand` (#9c5cfe, фиолетовый), `--ink` (#3c3c43, основной
  текст), `--ink-muted` (вторичный текст), `--grey-1` (#aeaeb2), `--grey-3` (#d1d1d6).
  Используются через классы `bg-brand` / `text-ink` / `text-ink-muted` / `border-grey-1` / `bg-grey-3`.
- **Экраны:** страницы кладём в `src/pages/`; ассеты из макета — в `src/assets/`
  (скачиваем точные байты, не используем временные URL Figma).
- **TypeScript 6:** не использовать устаревший `baseUrl` в tsconfig — `paths` работают без него.

## Подход к работе

Процессные правила (как переносить макеты из Figma, когда выносить компоненты,
правило трёх и т.п.) — в **`AGENTS.md`**. Здесь держим только контекст и факты
о проекте.

## Структура

- `src/components/ui/` — компоненты shadcn/ui (баррель `@/components/ui`)
- `src/components/layout/` — оболочки экранов (`app-shell`, `auth-layout`)
- `src/components/dashboard/` — блоки дашборда (KPI, графики, таблица, фильтр)
- `src/components/` (корень) — общие примитивы (`card`, `delta-badge`) + баррель `index.ts` (`@/components`)
- `src/pages/` — экраны админ-панели (напр. `login-page.tsx`); баррель `@/pages`
- `src/assets/` — ассеты из макета (иллюстрации и т.п.)
- `src/lib/utils.ts` — `cn()` и прочие утилиты; `src/lib/routes.ts` — пути маршрутов
- `src/App.tsx` — таблица маршрутов (`<Routes>`); `src/main.tsx` — точка входа (`BrowserRouter`)
- `src/index.css` — Tailwind + тема
- `components.json` — конфиг shadcn
- `vite.config.ts` — плагины (react, tailwindcss) и алиас `@`

## Статус работ

- Перенос бенефициара в «Документах»: синхронизирован локальный OpenAPI, показаны остатки Felmee и все фазы переноса, успех только VERIFIED + DONE при переносе, ручная сверка без повтора перевода. Фильтр банка поддерживает множественный выбор в стиле соседних колонок, OR по выбранным статусам и отдельную пагинацию сочетаний; доступный и зарезервированный остатки не ограничивают смену типа/ИНН в форме, новый ключ ответа сохраняется.

- Смена юрстатуса в «Документах»: запросы по прежнему ключу заявки отменяются и удаляются; свежая карточка берётся из ответа сохранения. Устранён ложный `not_found` после успешного изменения статуса. Недостающие документы разных типов загружаются параллельно; сохранение ждёт завершения всех загрузок. Банковский статус обновляется в открытой карточке до итогового ответа без сброса форм; причина отказа показывается только по нажатию на статус.

Актуализация документов 11.11.2026: список и карточка синхронизированы с Figma
`6072-8531`/`9154-9995`/`5900-6201`; глаза удалены, имена фиолетовые, банковский
статус берётся из `bank_status` списка без дополнительных карточек. Файлы открываются по
названию, защищённый FULL-просмотр и текущие ограничения API сохранены.

- Подсказки городов/адресов подключены в формах клиента, мастера и салона; гео из выбранного адреса передаётся в PATCH, включая service_locations мастера. Серверный cities endpoint сейчас отвечает 422 — см. docs/api-integration.md.

- Исходный логотип из Figma установлен в навигации и форме входа; SVG-знак используется как favicon, заголовок вкладки — «Felmee — Админ-панель».

- Адаптация под телефоны и планшеты: карточки списков, выдвижная навигация, одноколоночные формы, адаптивные календари и графики.

- [x] Инициализация проекта (Vite + React + TS + Tailwind + shadcn/ui)
- [x] Документация (README.md, CLAUDE.md)
- [x] Подключение Figma MCP для переноса макета в код
- [ ] Реализация экранов админ-панели по макету
  - [x] Экран входа (`src/pages/login-page.tsx`) — форма входа по номеру телефона + приветственный баннер
  - [x] Экран ввода кода (`src/pages/code-login-page.tsx`) — 5 OTP-ячеек, таймер/ресенд, состояния ошибки/успеха
  - [x] Обзор бизнеса / дашборд (`src/pages/dashboard-page.tsx`) — актуализирован по Figma: 3 KPI, 3 нижние метрики, детали среднего чека `3978-34323` в рублях; графики 418 px без сжатия и без переключателя типа. Данные демонстрационные.
  - [x] Оборот (GMV) / детали (`src/pages/gmv-page.tsx`) — график «Оборот» + таблица операций со статус-бейджами; открывается из KPI-карточки GMV
  - [x] Выручка (комиссия) / детали (`src/pages/revenue-page.tsx`) — шапка с «назад» + график выручки; открывается из KPI-карточки выручки
  - [x] Средний чек / детали (`src/pages/average-check-page.tsx`) — копия экрана выручки с заголовком «Средний чек»; открывается из одноимённой KPI-карточки
  - [x] Конверсия (Запись → Оплата) / детали (`src/pages/conversion-page.tsx`) — копия экрана выручки с заголовком «Конверсия»; открывается из одноимённой KPI-карточки
  - [x] Пользователи (`src/pages/users-page.tsx`) — **на живом бэкенде** (`src/lib/api/clients.ts`): управляемый `DateFilter` → `from`/`to`; 4 KPI из `GET /clients/stats` (хук `useClientsStats`, значения + дельты цветным бейджем); таблица из `GET /clients` (хук `useClients`) — server-driven поиск (дебаунс), фильтр статуса, сортировка (регистрация/записей/потрачено `field:asc|desc`), пагинация `offset/limit` по `has_more` (`keepPreviousData`). Фильтр города — серверный автокомплит через `useCitySuggestions` (`GET /api/suggestions/cities`), `CityFilterMenu` в async-режиме (`onSearchChange`). Состояния загрузки/ошибки. **Блокировка/разблокировка** — `useBlockClient`/`useUnblockClient` (`POST /clients/{id}/block|unblock`); `BlockUserDialog` собирает причину (async, ошибка/пендинг), инвалидируют список+статистику. **Редактирование** открывается кликом по имени (`AccountCell` проп `onNameClick`) → `UserEditDialog` с префиллом из `useClient` (`GET /clients/{id}`), сохранение диффом через `useUpdateClient` (`PATCH`; шлём только изменённые непустые поля). Иконки чата и карандаша в строке убраны — в действиях только блок/разблок. Адрес в форме пока read-only (PATCH требует `geolocation`). Пункт меню «Пользователи» → `/users`
    - `components/chat-view-dialog.tsx` (`ChatViewDialog`) — модалка «Чат»: вкладки переключают переписки поддержки с пользователем, ниже шапка собеседника (аватар/имя/телефон) и лента сообщений (входящие белые с обводкой слева, исходящие брендовые справа, время в пузыре); презентационная, данные демо. Открывается кнопкой чата в строке (`RowActions` проп `showChat`)
  - [x] Мастера и салоны (`src/pages/masters-page.tsx`) — **на живом бэкенде** (`src/lib/api/masters-salons.ts`): управляемый `DateFilter` → `from`/`to`; 4 KPI из `GET /masters-salons/stats` (хук `useMasterSalonStats`) — «Всего мастеров»/«Всего салонов» с дельтой, «Активные (мастера/салоны)» и «Заблокированные (мастера/салоны)» парами. Таблица из `GET /masters-salons` (хук `useMastersSalons`) — server-driven поиск (дебаунс), фильтры роль (`MASTER/SALON`) / город (серверный автокомплит `useCitySuggestions`) / статус (`ACTIVE/INACTIVE/BLOCKED`), сортировка (рейтинг `rating` / отзывы `reviews_count` / доход `income_amount`, `field:asc|desc`), пагинация `offset/limit` по `has_more` (`keepPreviousData`), состояния загрузки/ошибки. Роль/статус маплю API↔UI (`RoleBadge`/`AccountStatusBadge`). **Блокировка/разблокировка** — `useBlockProvider`/`useUnblockProvider` (эндпоинт по роли: `POST /{masters|salons}/{id}/block|unblock`, блок с причиной), через `RowActions` (`blockVariant={role}`) → модалка `BlockAccountDialog` (выбор причины из пресетов по макету 5353-7001/5353-9160). Пункт меню «Мастера и салоны» → `/masters`. Очередь модерации (`masters-moderation-page.tsx`) — отдельный экран, пока демо
    - `components/block-account-dialog.tsx` (`BlockAccountDialog`) — блокировка мастера/салона: заголовок/текст/список причин по `variant` (`master`/`salon`, списки зашиты из макета — справочника причин блокировки в API нет), радио-выбор причины + textarea комментария (для «Другое» обязателен); в `reason` (свободный текст 1–1000) уходит причина + комментарий через тире; async `onConfirm`, пендинг/инлайн-ошибка. Подключается через `RowActions` проп `blockVariant`
    - `components/unblock-account-dialog.tsx` (`UnblockAccountDialog`) — подтверждение разблокировки мастера/салона (макеты 5353-6987/5353-9274): показывает причину прошлой блокировки (`reason` из `blockReason`) + «Вы уверены…»; textarea комментария **декоративный** (эндпоинт `unblock` без тела — на бэк не уходит); async `onConfirm`, пендинг/ошибка. Подключается через `RowActions` (`blockVariant` master/salon + `blockReason`) — кнопка «Разблокировать» открывает модалку
  - [x] Очередь модерации (`src/pages/masters-moderation-page.tsx`) — открывается по «Открыть очередь» (`/masters/moderation`); три вкладки со своим набором колонок: «На модерации» (Ожидание + Действия), «Одобренные» (Дата одобрения + Менеджер), «Отклонённые» (Дата отклонения + Менеджер-фильтр + Причина с усечением и ссылкой «читать» → модалка только для чтения `RejectionReasonViewDialog`); фильтры роль/город/сортировка — на всех вкладках
  - [x] Записи (`src/pages/appointments-page.tsx`) — **на живом бэкенде** (`src/lib/api/records.ts`): управляемый `DateFilter` → `from`/`to`; 4 KPI из `GET /records/stats` (хук `useRecordsStats`) — «Всего записей» с дельтой к прошлому периоду (`total_records_change_percent`, цветной бейдж), «Завершены/Ожидают/Отменены» с долей в процентах (`*_percent`). Таблица из `GET /records` (хук `useRecords`) — server-driven поиск (дебаунс → `query`), фильтр города (серверный автокомплит `useCitySuggestions` + `CityFilterMenu` async), фильтр статуса (4 значения API `WAITING_FOR_PAYMENT/BOOKED/COMPLETED/CANCELED`), сортировка (время записи `start_at` / сумма `service_price`, `field:asc|desc`), пагинация `offset/limit` по `has_more` (`keepPreviousData`), состояния загрузки/ошибки. Статус API (4) → бейдж (3): `WAITING_FOR_PAYMENT`+`BOOKED`→«Ожидание», `COMPLETED`→«Завершена», `CANCELED`→«Отменена». **Просмотр заказа** — «глаз» открывает `AppointmentViewDialog` с данными из `useRecord(id)` (`GET /records/{recordId}`; секции дата/время, мастер, клиент, услуги, итог). **Отмена** — из просмотра → `AppointmentCancelDialog` → `useCancelRecord` (`POST /records/{recordId}/cancel`, `{reason}`; инвалидирует список+статистику). **Профиль исполнителя** — клик по имени тянет `useRecord(id)` и по наличию `detail.salon` открывает `SalonProfileDialog` (салон) или `MasterProfileDialog` (мастер); сами формы профиля пока презентационные (живые только имя/город из детали). Клик по имени клиента → `UserInfoDialog` (из строки). Иконка редактирования записи убрана — в действиях только «глаз». **Не доделано:** фото мастера (`master.photo_id` → пайплайн файлов, плейсхолдер). Пункт меню «Записи» → `/appointments`
  - [x] Просмотр записи (модалка `components/appointment-view-dialog.tsx`, `AppointmentViewDialog`) — «Информация по заказу #…»: статус-шапка в трёх состояниях (`active` — «запись актуальная», зелёный; `waiting` — «ждём ответ от клиента», оранжевый + текст о переносе; `cancelled` — «запись отменена», красный + причина), секции Дата и время / Мастер (фото `assets/master-sample.jpg`) / Клиент / Услуги с итогом, кнопки «Отмена запись» (проп `onRequestCancel`) / «Закрыть»; презентационная, данные приходят пропом `appointment: AppointmentView`
  - [x] Отмена записи (модалка `components/appointment-cancel-dialog.tsx`, `AppointmentCancelDialog`) — открывается по «Отмена запись» из просмотра: выбор причины (радио из 6 пунктов, для «Другое» — textarea, обязательна для подтверждения), кнопка «Отменить запись» задизейблена без выбора → после подтверждения экран «Запись отменена»; проп `onConfirm(reason) => void | Promise<void>` держит кнопку в состоянии отправки («Отмена…»), при reject показывает ошибку инлайном и остаётся на шаге выбора причины
  - [x] Карточки участников записи (открываются кликом по имени в таблице; данные демо из макета):
    - `components/user-info-dialog.tsx` (`UserInfoDialog`) — компактная карточка клиента (аватар + поля Имя/Фамилия/Город/Адрес/Телефон/e-mail/Способ оплаты); открывается по имени клиента
    - `components/master-profile-dialog.tsx` (`MasterProfileDialog`) — профиль-форма мастера (Основная информация, О мастере + примеры работ, Категории, Место оказания услуг с чекбоксами, Интерьер, Настройки записи); на «Записях» открывается по имени исполнителя, когда в деталях записи нет `salon` (имя/город — из `detail.master`/`detail.salon`, остальное демо)
    - `components/salon-profile-dialog.tsx` (`SalonProfileDialog`) — профиль-форма салона (Основная информация, Категории с выпадающим списком «+Добавить», О салоне, Интерьер, График работы с тумблерами по дням); на «Записях» открывается по имени исполнителя, когда в деталях записи есть `salon` (имя/город — из `detail.salon`, остальное демо)
    - `components/profile-form.tsx` — общие примитивы форм-профилей (`SectionCard`, `Field`, `TextAreaField`, `CategoryChip`, `PhotoStrip`, `CheckSquare`, `Toggle`); импортируются напрямую, не через баррель. Записи получили поле `role` (`master`/`salon`)
  - [x] Категории услуг (`src/pages/categories-page.tsx`) — **CRUD категорий на живом бэкенде** (`src/lib/api/categories.ts`): сетка карточек (5 в ряд) из `GET /api/admin/categories` (хук `useCategories`; название + счётчики `children_count`/`services_count`), состояния загрузки/ошибки; карточка-добавление → `CategoryFormDialog` (create, `useCreateCategory`), «Изменить» → тот же диалог (edit, `useUpdateCategory`), корзина → модалка подтверждения `ConfirmDeleteCategoryDialog` → `useDeleteCategory` (на `409` — инфо-модалка `DeleteCategoryDialog` «нельзя удалить, есть услуги»). **Подкатегории:** в edit подтягиваются `GET …/{id}/subcategories` (хук `useSubcategories`; форма открывается только по загрузке — иначе пустой список стёр бы их), в форме хранятся с `serverId`. **Автосохранение:** любое действие (добавить/переименовать/удалить) сразу шлёт `PATCH` полным желаемым списком (существующие → `{category_id, name}`, новые → `{name}`, удалённые отсутствуют) через проп `onSubcategoriesChange`; ответ реконсилит локальный список серверными `id` (новые получают `serverId`, чтобы повторная правка не задублировалась); во время запроса контролы заблокированы + «Сохранение…», при ошибке — откат и инлайн-текст. Кнопка «Сохранить изменения» остаётся для названия/обложки. Сетка — адаптивный грид `auto-fill/minmax(220px,1fr)`. **Обложки** — карточка показывает обложку через `useFileUrl(image_id)` (плейсхолдер `ImageOff`, пока нет id/ссылки); в форме загрузка реальная (см. диалог). Пункт меню «Категории» → `/categories`
    - `components/category-form-dialog.tsx` (`CategoryFormDialog`) — форма в режимах `create`/`edit`: **обложка загружается реально** — дропзона/клик (`<input type=file>`) → `useUploadFile(purpose: "CATEGORY")` → числовой `image_id`; локальное blob-превью сразу + оверлей «Загрузка…», ошибка инлайном, сабмит заблокирован во время загрузки; существующая обложка тянется `useFileUrl(imageId)`. Название (zod), управляемый список подкатегорий (добавить/переименовать инлайн/удалить). `onSubmit` отдаёт `{name, imageId, subcategories}`; предзаполнение `category: CategoryData` (`imageId` вместо URL)
    - `components/delete-category-dialog.tsx` (`DeleteCategoryDialog`) — инфо-модалка «Нельзя удалить категорию» (в категории есть услуги) с кнопкой «Понятно» (по макету 4693-5055)
    - `components/confirm-delete-category-dialog.tsx` (`ConfirmDeleteCategoryDialog`) — подтверждение удаления категории (название в тексте): «Отмена» / красная «Удалить»; проп `onConfirm() => Promise<void>` держит кнопку в состоянии «Удаление…», при reject — инлайн-ошибка; `409` обрабатывает вызывающий (закрывает подтверждение, открывает `DeleteCategoryDialog`)
  - [x] Роли (`src/pages/roles-page.tsx`) — назначение доступов доверенным сотрудникам, **на живом бэкенде** (см. `src/lib/api/employees.ts`): кнопка «Добавить сотрудника», ряд выбираемых карточек сотрудников (аватар-инициалы, имя, декоративная роль «Администратор» — поля роли в API нет; активная — брендовая обводка; при наведении — «изменить»/«удалить»), заголовок «РАЗДЕЛ ПАНЕЛИ» + шапка выбранного сотрудника, таблица доступов по разделам панели (сегмент-контрол `[Полный | Чтение | Нет]` — Полный зелёный, Чтение оранжевый; пишет `PUT …/permissions` оптимистично). Данные и мутации через хуки `useEmployees`/`useEmployee`/`useEmployeePermissions`/`useCreateEmployee`/`useUpdateEmployee`/`useDeleteEmployee`/`useSetEmployeePermission`; есть состояния загрузки/ошибки. Пункт меню «Роли» → `/roles`
    - `components/employee-form-dialog.tsx` (`EmployeeFormDialog`) — форма в режимах `create`/`edit`: Имя, Фамилия, Контактный телефон; кнопка «Добавить» задизейблена без заполнения; проп `onSubmit(data) => Promise<void>` держит форму в состоянии отправки, при ошибке показывает `ApiError.message`; в `create` после успеха — экран «Сотрудник успешно добавлен», в `edit` — закрытие; предзаполнение пропом `employee: EmployeeData` (телефон подгружается деталью `GET {userId}`)
    - `components/delete-employee-dialog.tsx` (`DeleteEmployeeDialog`) — подтверждение удаления сотрудника (имя в тексте), красная кнопка «Удалить» → асинхронный проп `onConfirm() => void | Promise<void>` (состояние «Удаление…», текст ошибки, модалка остаётся открытой при reject; `409` — «нельзя удалить себя / последнего с полным доступом к ролям»)
  - [x] История действий (`src/pages/history-page.tsx`) — журнал действий **на живом бэкенде** (`src/lib/api/action-history.ts`, хук `useActionHistory`): `DateFilter` (управляемый период → `from`/`to`) + серверный поиск с дебаунсом → `query` + таблица (колонки «Дата и время» — дата+время из `created_at`, «Кто выполнил» — аватар-инициалы + имя, «Событие»); серверная пагинация по `offset/limit` (Prev/Next по `has_more`, `keepPreviousData` без мигания); состояния загрузки/ошибки. Пункт меню «История действий» → `/history`
  - [x] Реферальная программа (`src/pages/referral-program-page.tsx`) — **на живом admin-API рефералки** (`src/lib/api/referral.ts`): управляемый `DateFilter` → `from`/`to`; 3 KPI из `GET /api/admin/referral/partners/summary` (хук `useReferralPartnerSummary`; активные/неактивные партнёры + `total_accrued_rub` с дельтами). Вкладки `SegmentTabs` = «Партнёры / Уровни и ставки» (демо-вкладки «Рефералы» и «Проверка документов» убраны — admin-эндпоинтов нет). **Партнёры** — `GET /api/admin/referral/partners` (хук `useReferralPartners`): server-driven поиск (дебаунс → `search`), фильтры в заголовках (`CheckboxFilterMenu`) статуса (ACTIVE/INACTIVE) и уровней раздельно по клиентской/бизнес-линии (`client_level_code`/`business_level_code`, коды START/DEVELOPMENT/PROFESSIONAL/STRATEGIC), пагинация `offset/limit` по `total` (`keepPreviousData`), состояния загрузки/ошибки/пусто; колонки — партнёр (клик → карточка), уровень клиента + уровень бизнеса (две `LevelChip`, тон по `level_code`), рефералы (`referrals_count`), всего начислено (`total_accrued_rub` ₽), статус. **Карточка партнёра** (`PartnerInfoDialog`) — `GET /api/admin/referral/partners/{id}` (хук `useReferralPartnerCard`): шапка (имя, `business_type`, две пилюли уровней, статус), сводка (`referrals.total`/`total_accrued_rub`/`activated_at`), список «Приглашённые» живой (`referrals.items` — `display_name`, `referred_type`, 4 статуса WAITING_FOR_SERVICE/NOT_LINKED/ACTIVE/EARNINGS_COMPLETED, начислено, дата активации; вкладка «Начисления» убрана — эндпоинта истории нет). **Уровни и ставки** — `GET /api/admin/referral/levels` (хук `useReferralSystemLevels`; `client_line`/`business_line`), правка ставки → `useUpdateReferralLevelRate` (`PATCH …/levels/{targetType}/{levelCode}` `{reward_percent}`, тост + инвалидация). Пункт меню «Реферальная программа» → `/referral`. Демо-участки убраны (admin-эндпоинтов нет): вкладка «Рефералы» (плоского списка в API нет — только приглашённые в карточке партнёра), вкладка «Проверка документов» (дублировала `/documents`), вкладка «Начисления» в карточке партнёра (истории начислений нет)
  - [x] Программа лояльности (`src/pages/loyalty-page.tsx`) — **на живом бэкенде** (`src/lib/api/referral.ts`): управляемый `DateFilter` → `from`/`to`; 3 `StatCard` из `GET /referral/stats` (хук `useReferralStats`; Всего рефералов + дельта, Конверсия рефералов + дельта в п.п., Активные амбассадоры + дельта) — карточки «Начислено баллов» из макета нет в API (убрана). Правила из `GET /referral/rules` (хук `useReferralRules`) — делятся по `target_type`: `CLIENT` → «Друзья», `BUSINESS` → «Мастера»; три таба «Все/Друзья/Мастера» переключают показ секций; таблицы (Условие `condition_text` / Вознаграждение `reward_percent`% / Интервал `reward_interval` → рус. подпись), карандаш → редактирование; состояния загрузки/ошибки. **Редактирование награды** — `LoyaltyRewardDialog` (процент 0–100 + select интервала) → `useUpdateReferralRule` (`PATCH /referral/rules/{ruleId}`, тело `{reward_percent, reward_interval}`; async-пендинг, инлайн-ошибка, инвалидирует правила). Кнопка «+Добавить» убрана — создания/удаления правил в API нет, только правка награды. Внизу `MetricChartCard` («Выгода программы лояльности») из `GET /referral/profit` (хук `useReferralProfit`; дневные точки `earned_amount`/`spent_amount` в ₽, ось Y — компактные рубли, ось X — даты). Пункт меню «Программа лояльности» → `/loyalty`
    - `components/loyalty-reward-dialog.tsx` (`LoyaltyRewardDialog`) — модалка редактирования награды правила: заголовок = текст условия, поле «Вознаграждение, %» (число 0–100) + select «Интервал вознаграждения» (проп `intervalOptions`); проп `onSave(percent, interval) => Promise<void>` держит кнопку в отправке, при reject — инлайн-ошибка; успех закрывает модалку
  - [x] Обращения (`src/pages/chats-page.tsx`) — **на живом бэкенде** (`src/lib/api/support.ts`) мастер-деталь чатов поддержки (`openDialogId`): пункт меню «Обращения» → `/chats`
    - Список (`GET /support/chats`, хук `useSupportChats`): server-driven поиск (дебаунс → `query`), табы «Все/Открытые/Закрытые/Непрочитанные» → серверные `status`/`unread`, пагинация `offset/limit` по `has_more` (`keepPreviousData`), состояния загрузки/ошибки; строка — `Avatar`-инициалы (avatar_id без URL), имя клиента (фолбэк телефон), превью `last_message.text`/«Вложение», время из `at_create`/`opened_at`, бейдж `unread_count`. Сайдбар «Рейтинг поддержки 4.3» — **демо** (метрики рейтинга в API нет)
    - Открытый чат (на белой подложке `Card`; шапка и поле ввода — отдельные плашки): деталь `GET /support/chats/{dialogId}` (`useSupportChat`) + сообщения `GET …/messages` (`useSupportMessages`, сортировка по id); `Bubble` — исходящее, если `from.id !== client.id` (белые входящие с рамкой + кружок-аватар слева, брендовые исходящие справа); разделитель дня `DateDivider` при смене даты; время — `HH:mm` (парсер `parseBackendDate` под формат `yyyy:MM:dd:HH:mm`). Фото-сообщения — по-телеграмному: единый пузырь, картинка сверху edge-to-edge (размер по `width`/`height` из `ImageResponse`, ширина 180–280), подпись под ней или время оверлеем; ссылка на файл через `useFileUrl` (`GET /file/{id}`, `PREVIEW`), до загрузки — скелетон тех же размеров. Прочие вложения — метка «Вложение». Отправка — `useSendSupportMessage` (`POST …/messages/send`, `{text?, file_ids?}`). **Вложения** — скрепка → `useUploadFile` (`POST /file/upload`, purpose `MESSAGE`) → `FileUploadCard` → `file_id` в `file_ids`. При открытии с непрочитанными — `useMarkSupportRead` (`POST …/read`). Сайдбар статуса: «Запросить решение» (`POST …/resolution-request`) / «Открыть повторно» (`POST …/reopen`). **Realtime (STOMP, `src/lib/ws/`)** — `useSupportRealtime()` на экране поднимает SockJS `/ws`: подписки `admin.support.new_message/.delivered/.status` инвалидируют кэш (live-сообщения и смены статуса), `chat.read_message` двигает указатель прочтения → на исходящих ✓ (отправлено) / ✓✓ (клиент прочитал, `id ≤ last_read_message_id`)
    - `components/file-upload-card.tsx` (`FileUploadCard`) — карточка файла: цветная иконка по типу (`pdf/doc/xls/ppt/img/other`), имя, метаданные (расширение · размер · статус) и прогресс-бар; статусы `uploading N%` / `checking` / `done` / `error` (красный); опц. крестик `onRemove`
  - [x] Жалобы (`src/pages/complaints-page.tsx`) — **на живом бэкенде** (`src/lib/api/complaints.ts`): управляемый `DateFilter` → `from`/`to`; 4 KPI из `GET /complaints/stats` (хук `useComplaintsStats`; Всего/Открытые/Закрыто с дельтой к прошлому периоду, Ср. время решения в днях). Список из `GET /complaints` (хук `useComplaints`) — server-driven поиск (дебаунс → `query`), табы «Открытые/Закрытые» → серверный `status=OPEN|CLOSED`, пагинация `offset/limit` по `has_more` (`keepPreviousData`), состояния загрузки/ошибки. Строка: статус + дата (`created_at`), участники (reporter → subject), вид жалобы по `subject.type` (USER/MASTER/SALON/SERVICE/REVIEW → «На пользователя/мастера/салон/услугу/отзыв»), причина (`reason`); у закрытых — «Менеджер · Решение» из `resolved_by`/`resolution`. **Разбор жалобы** — клик по имени/виду/«читать»/«глазу» тянет `useComplaint(id)` (`GET /complaints/{id}`) → `ComplaintReasonDialog` (причина; у открытых — кнопка «Вынести решение», у закрытых — блок с решением/комментарием/менеджером). **Вынесение решения** — `ComplaintDecisionDialog`: select из `detail.available_resolutions` (маппинг `ComplaintResolution` → рус. подписи) + комментарий (1–500) → `useResolveComplaint` (`POST /complaints/{id}/resolve`; async-пендинг, инлайн-ошибка, инвалидирует список+статистику). Пункт меню «Жалобы» → `/complaints`. **Демо (нет эндпоинтов):** карточки содержимого отзыва/услуги (`ComplaintReviewDialog`/`ComplaintServiceDialog`/`ReviewComplaintDialog`) — оставлены как презентационные, из основного потока убраны (API не отдаёт содержимое отзыва/услуги)
    - `components/complaint-review-dialog.tsx` — `ReviewCard` (карточка отзыва: автор, услуга, мастер/салон, звёзды, что понравилось/нет, комментарий, теги) + `ComplaintReviewDialog` («Жалоба на отзыв»)
    - `components/review-complaint-dialog.tsx` — `ReviewComplaintDialog` («Отзыв»: две колонки — `ReviewCard` + причина/текст жалобы, кнопка «Вынести решение») + `ComplaintReasonBody` (правая колонка причина+текст)
    - `components/complaint-reason-dialog.tsx` (`ComplaintReasonDialog`) — «Спор №N»: причина + опц. текст жалобы; у открытых — кнопка «Вынести решение» (`onDecision`), у закрытых — блок итога `resolution` (решение/комментарий/менеджер). `ComplaintReasonBody.text` опционален
    - `components/complaint-decision-dialog.tsx` (`ComplaintDecisionDialog`) — «Вынести решение»: select из пропа `options` (`DecisionOption[]`: значение-enum + подпись) + textarea описания (счётчик 0/500); проп `onSubmit(resolution, comment) => Promise<void>` держит кнопку в отправке, при reject — инлайн-ошибка; успех закрывает модалку
    - `components/complaint-service-dialog.tsx` (`ComplaintServiceDialog` + `ServiceData`) — «Жалоба на услугу»: фото, цена, название, рейтинг+длительность, описание, место приёма, преимущества
  - [x] Документы (`src/pages/documents-page.tsx`, `src/components/document-review-dialog.tsx`) — Business Registry с фильтрами, карточкой партнёра, реквизитами, комментариями и проверкой документов. Типы и версии из API: requirements текущего/нового статуса, PUT by-type с expected_revision, история с пагинацией и просмотром без решений. Дополнительные файлы — attachments; недостающие документы нового юрстатуса — черновики в files PATCH partner. UPLOADED обязателен, 409 не повторяется автоматически, банковская проверка блокирует изменения. Контракт синхронизирован из backend openapi.yaml 12.11.2026; новые endpoint требуют сборки и перезапуска backend пользователем, фронтенд проверен с подменой API.
    - `components/document-review-dialog.tsx` (`DocumentReviewDialog`) — карточка заявки из `useBusinessApplication(key)` (ключ = тройка `source/businessType/businessEntityId`); шапка мгновенно из строки (`review`), тело из карточки. Четыре вкладки (по макету 7567-5738): **Данные партнёра** — RHF+zod форма (ФИО/ИНН/телефон/e-mail/вид деятельности + **юр. статус селектом** `business_type` SE/IE/LLC + комментарий) → `useUpdateBusinessPartner` (`PATCH …/partner`). `business_type` — part ключа: при его смене заявка «переезжает», страница перенаводит модалку на новый ключ (`setSelected`), кэш свежего ключа кладёт сама мутация (ключ из возвращённой карточки); **Документы** — список файлов (статус + черновое решение `draft_decision`), «глаз» → `DocPreview` (превью через `useFileUrl`, решение по файлу `APPROVE`/`REQUEST_REUPLOAD`+коммент → `useSetDocumentDecision` `PATCH …/documents/{fileId}/decision`), скачивание ссылкой `useFileUrl(FULL)`, кнопка «Завершить проверку» → `useCompleteDocumentsReview` (`POST …/documents/complete-review`); **Реквизиты** — RHF+zod форма (получатель/банк/БИК 9 цифр/счета по 20 цифр + комментарий) → `useUpdateBusinessRequisites` (`PATCH …/requisites`); **Комментарии** — read-only история из `GET …/comments` (`useBusinessApplicationComments`, проброшена со страницы; POST в API нет — комментарии создаются полем `comment` в PATCH/decision). Мутации возвращают свежую карточку (кладут в кэш `detail` + инвалидируют список). Догрузка файлов админом (`POST …/documents/attachments`) в слое есть (`useAddDocumentAttachments`), в UI пока не подключена
  - Общие компоненты управления (`components/`, вынесены на 2–3-м экранах): `stat-card.tsx` (`StatCard` — KPI с иконкой, тон brand/success/danger/warning, опц. бейдж дельты), `account-cell.tsx` (`AccountCell` — ячейка «аккаунт»: аватар + имя-ссылка + подпись; в таблицах users/masters/moderation), `icon-button.tsx` (`IconButton` — квадратная кнопка-действие 46×46 с иконкой Lucide; используется в таблицах/строках), `status-pill.tsx` (`StatusPill` — презентационная пилюля статуса с цветной точкой; принимает `{ label, cls, info }`, семантику держит домен), `account-status-badge.tsx` (`AccountStatusBadge`, на `StatusPill`), `appointment-status-badge.tsx` (`AppointmentStatusBadge` — статус записи pending/completed/cancelled, на `StatusPill`), `row-actions.tsx` (`RowActions`), `avatar.tsx` (`Avatar`), `role-badge.tsx` (`RoleBadge`), `moderation-actions.tsx` (`ModerationActions`), `reject-reason-dialog.tsx` (`RejectReasonDialog` — ввод причины), `rejection-reason-view-dialog.tsx` (`RejectionReasonViewDialog` — просмотр причины), `appointment-view-dialog.tsx` (`AppointmentViewDialog` — просмотр записи, 3 состояния), `table-controls.tsx` (`SortMenu` / `CheckboxFilterMenu` / `CityFilterMenu` — меню заголовков таблицы на `Popover`)
  - Оболочки (`components/layout/`): `app-shell.tsx` (фикс-сайдбар + модалка выхода, навигация через роутер), `auth-layout.tsx` (оболочка auth-экранов)
  - Блоки дашборда (`components/dashboard/`): `date-filter.tsx` (фильтр периода), `kpi-card.tsx` (KPI-карточка), `metrics-grid.tsx` (блок «Пользователи и конверсии»), `metric-chart-card.tsx` (график метрики, 1+ серий, линия/столбцы; по умолчанию оси в млн ₽ / «июн», но принимает опц. `formatYTick`/`formatXTick`/`formatTooltipValue`/`formatTooltipLabel` + `xDomain`/`xTicks` — на «Лояльности» переопределены под рубли и даты), `transactions-table.tsx` (таблица операций со статусами)
  - Таблицы: `components/data-table.tsx` (`DataTable` — чистый data-grid на `@tanstack/react-table`: сортировка/фильтры/пагинация, разметка через CSS-grid `gridClassName`, опц. `rowClassName`; для плоских списков — users/masters/moderation/appointments/history/loyalty). Экраны с нестандартной структурой строк держат **свой тип таблицы**, не смешивая с `DataTable`: `components/complaints-table.tsx` (`ComplaintsTable` — строки-карточки + под-строка «Решение» у закрытых), `components/access-table.tsx` (`AccessTable` — интерактивная панель доступов с сегмент-контролом `[Полный|Чтение|Нет]`; строка = раздел + сегмент, без иконок действий), `components/dashboard/transactions-table.tsx` (`TransactionsTable` — на `DataTable`)
  - Примитивы (`components/`): `card.tsx` (карточка-обёртка), `delta-badge.tsx` (бейдж роста/падения)
  - Модалки: `components/modal-shell.tsx` — общие примитивы диалога (пока на экране записей): `ModalShell` (стандартный `DialogContent`: карточка, отступы, тень; ширина через `className` `max-w-[…]`), `ModalHeader` (заголовок + опц. брендовый акцент + крестик), `ModalDivider`, `ModalActions` + `ModalButton` (футер, `variant` primary/secondary, `close` оборачивает в `DialogClose`). На них переведены модалки записей (просмотр/отмена/профили мастера-салона/карточка клиента); данные приходят из кликнутой строки, состояние модалок на странице сведено в одно (`openModal` + `active`), отмена локально помечает запись `cancelled`.
  - Прочее общее: `components/ui/otp-input.tsx` (ввод кода), `components/ui/chart.tsx` (обёртка recharts), `components/ui/dialog.tsx` (модалки), `components/ui/popover.tsx` (поповеры меню), `lib/format.ts` (`formatMillions` — формат млн ₽), `lib/table.ts` (утилиты таблиц: `includesSelected` — `FilterFn` по набору значений, `parseMoney`, `parseRuDate`), `lib/routes.ts` (пути маршрутов)

### Figma MCP

Подключён официальный **remote**-сервер Figma через плагин Claude Code
`figma@claude-plugins-official` (сервер `plugin:figma:figma`, OAuth-авторизация,
эндпоинт `https://mcp.figma.com/mcp`). Требует Figma Professional + Dev/Full seat.
Лимиты персональные (per seat): 200 запросов/день, 10/мин.

**Рабочий поток:** в Figma выделить фрейм → *Copy link to selection* → прислать
ссылку → перенос дизайна в компоненты React + Tailwind + shadcn/ui.

## Правила ведения документации

При заметных изменениях обновлять:
- **README.md** — то, что важно любому разработчику (стек, запуск, структура).
- **CLAUDE.md** — контекст и соглашения для работы с Claude Code + раздел «Статус работ».
