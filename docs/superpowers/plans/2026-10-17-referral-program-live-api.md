# Реферальная программа на живом admin-API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести страницу `/referral` (`src/pages/referral-program-page.tsx`) с демо-данных на реальные admin-эндпоинты рефералки, сохранив все 4 вкладки; где бэк не покрывает — оставить UI с явной пометкой мока.

**Architecture:** Расширяем `src/lib/api/referral.ts` новыми функциями/хуками/типами (не трогая старые `rules`/`profit`, на которых живёт `loyalty-page`), реэкспортим из барреля `@/lib/api`. Затем точечно переключаем блоки страницы и модалку партнёра на новые хуки. Паттерн — как в `records.ts`/`appointments-page.tsx`: `api.GET/PATCH` + `unwrap`, server-driven список с `keepPreviousData`, хуки в api-слое.

**Tech Stack:** React 19, TypeScript, TanStack Query, openapi-fetch, Tailwind v4, shadcn/ui, `@tanstack/react-table` (`DataTable`).

## Global Constraints

- Проверка после изменений — `pnpm build` (`tsc -b && vite build`) и `pnpm lint` (`oxlint`). **В репозитории нет юнит-тестов** — роль «теста» в каждой задаче выполняют успешная сборка (tsc ловит ошибки типов), чистый линт и ручная проверка в UI. Это осознанная адаптация под конвенцию проекта (CLAUDE.md), а не пропуск верификации.
- Хуки Query — обёртки в api-слое (`src/lib/api/<domain>.ts`), не инлайн на странице.
- Импорты — через алиас `@/…`; внешние потребители берут из баррелей (`@/lib/api`, `@/components`); внутри папки — прямыми путями.
- Стрелочные функции (`const fn = () => {}`), не `function fn()`.
- Интерактивные элементы — `cursor-pointer`.
- Не объединять структурно демо-типы с живыми (новые типы — свои).
- Деньги `total_accrued_rub` — целые рубли, показываем как ₽ (крупные суммы — через `formatMillions` + « млн»).
- Каждый оставшийся моковый блок несёт комментарий `⚠️ TODO(бэкенд): <причина> — данные демо.`
- НЕ удалять из `referral.ts`: `getReferralRules`, `useReferralRules`, `updateReferralRule`, `useUpdateReferralRule`, `getReferralProfit`, `useReferralProfit`, `AdminReferralRule`, `AdminReferralRuleUpdate`, `AdminReferralProfitData` — используются `loyalty-page.tsx`.
- Коммиты — без `Co-Authored-By`.

---

## Task 1: API-слой — admin-эндпоинты рефералки

**Files:**
- Modify: `src/lib/api/referral.ts`
- Modify: `src/lib/api/index.ts` (баррель — реэкспорт новых хуков/типов)

**Interfaces:**
- Consumes: `api`, `unwrap` из `./client`; `components` из `./schema`; существующий `referralKeys`, `ReferralPeriodParams`.
- Produces (на эти имена опираются задачи 2–5):
  - Типы: `AdminReferralPartnerSummary`, `AdminReferralPartnerPage`, `AdminReferralPartnerItem`, `AdminReferralPartnerCard`, `AdminReferralInvitee`, `AdminReferralSystemLevelsData`, `AdminReferralSystemLevel`, `ReferralPartnerStatus` (`"ACTIVE" | "INACTIVE"`), `ReferralLevelCode` (`"START" | "DEVELOPMENT" | "PROFESSIONAL" | "STRATEGIC"`), `ReferralTarget` (`"CLIENT" | "BUSINESS"`), `ReferralPartnersParams`, `ReferralPartnerCardParams`.
  - Хуки: `useReferralPartnerSummary(params: ReferralPeriodParams)`, `useReferralPartners(params: ReferralPartnersParams)`, `useReferralPartnerCard(id: number | null, params?: ReferralPartnerCardParams)`, `useReferralSystemLevels()`, `useUpdateReferralLevelRate()` (мутация `{ targetType, levelCode, reward_percent }`).

- [ ] **Step 1: Добавить типы и расширить `referralKeys`**

В `src/lib/api/referral.ts` после существующих типов добавить:

```ts
/** Показатели реферальной системы за период (summary). */
export type AdminReferralPartnerSummary =
  components["schemas"]["AdminReferralPartnerSummary"];

/** Страница списка партнёров (items + total + offset/limit). */
export type AdminReferralPartnerPage =
  components["schemas"]["AdminReferralPartnerPage"];

/** Один партнёр в списке. */
export type AdminReferralPartnerItem =
  components["schemas"]["AdminReferralPartnerItem"];

/** Карточка партнёра (item + business_type/activated_at + приглашённые). */
export type AdminReferralPartnerCard =
  components["schemas"]["AdminReferralPartnerCard"];

/** Приглашённый реферал в карточке партнёра. */
export type AdminReferralInvitee =
  components["schemas"]["AdminReferralInvitee"];

/** Один уровень реферальной системы (код/название/ставка). */
export type AdminReferralSystemLevel =
  components["schemas"]["AdminReferralSystemLevel"];

/** Статус партнёра. */
export type ReferralPartnerStatus = AdminReferralPartnerItem["status"];

/** Код уровня линии (4 значения из enum параметров `*_level_code`). */
export type ReferralLevelCode =
  | "START"
  | "DEVELOPMENT"
  | "PROFESSIONAL"
  | "STRATEGIC";

/** Линия реферальной программы. */
export type ReferralTarget = "CLIENT" | "BUSINESS";

/** Данные ставок уровней: клиентская и бизнес-линии. */
export interface AdminReferralSystemLevelsData {
  client_line: { levels: AdminReferralSystemLevel[] };
  business_line: { levels: AdminReferralSystemLevel[] };
}

/** Параметры списка партнёров. */
export interface ReferralPartnersParams {
  from: string;
  to: string;
  search?: string;
  status?: ReferralPartnerStatus;
  client_level_code?: ReferralLevelCode;
  business_level_code?: ReferralLevelCode;
  offset?: number;
  limit?: number;
}

/** Параметры карточки партнёра (период + пагинация приглашённых). */
export interface ReferralPartnerCardParams {
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}
```

Расширить объект `referralKeys` (добавить ключи, не удаляя существующие):

```ts
  partnersSummary: (params: ReferralPeriodParams) =>
    [...referralKeys.all, "partners-summary", params] as const,
  partners: (params: ReferralPartnersParams) =>
    [...referralKeys.all, "partners", params] as const,
  partnerCard: (id: number, params: ReferralPartnerCardParams) =>
    [...referralKeys.all, "partner-card", id, params] as const,
  levels: () => [...referralKeys.all, "levels"] as const,
```

- [ ] **Step 2: Добавить fetch-функции и хуки**

В `src/lib/api/referral.ts` добавить (импорт `keepPreviousData` из `@tanstack/react-query` — дополнить существующий импорт):

```ts
/**
 * Показатели реферальной системы за период.
 * `GET /api/admin/referral/partners/summary`.
 */
export const getReferralPartnerSummary = async (
  params: ReferralPeriodParams,
): Promise<AdminReferralPartnerSummary> => {
  const res = await api.GET("/api/admin/referral/partners/summary", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Список партнёров с пагинацией/фильтрами.
 * `GET /api/admin/referral/partners`.
 */
export const getReferralPartners = async (
  params: ReferralPartnersParams,
): Promise<AdminReferralPartnerPage> => {
  const res = await api.GET("/api/admin/referral/partners", {
    params: { query: params },
  });
  return unwrap(res)!;
};

/**
 * Карточка партнёра и приглашённые.
 * `GET /api/admin/referral/partners/{referral_user_id}`.
 */
export const getReferralPartnerCard = async (
  id: number,
  params: ReferralPartnerCardParams = {},
): Promise<AdminReferralPartnerCard> => {
  const res = await api.GET("/api/admin/referral/partners/{referral_user_id}", {
    params: { path: { referral_user_id: id }, query: params },
  });
  return unwrap(res)!;
};

/**
 * Ставки уровней реферальной системы (клиентская и бизнес-линии).
 * `GET /api/admin/referral/levels`.
 */
export const getReferralSystemLevels =
  async (): Promise<AdminReferralSystemLevelsData> => {
    const res = await api.GET("/api/admin/referral/levels");
    return unwrap(res)! as AdminReferralSystemLevelsData;
  };

/**
 * Изменить ставку одного уровня линии.
 * `PATCH /api/admin/referral/levels/{targetType}/{levelCode}`.
 */
export const updateReferralLevelRate = async (
  targetType: ReferralTarget,
  levelCode: string,
  reward_percent: number,
): Promise<AdminReferralSystemLevel> => {
  const res = await api.PATCH(
    "/api/admin/referral/levels/{targetType}/{levelCode}",
    { params: { path: { targetType, levelCode } }, body: { reward_percent } },
  );
  return unwrap(res)!;
};

/* ---- хуки ---- */

/** Показатели реферальной системы за период. */
export const useReferralPartnerSummary = (params: ReferralPeriodParams) =>
  useQuery({
    queryKey: referralKeys.partnersSummary(params),
    queryFn: () => getReferralPartnerSummary(params),
  });

/** Список партнёров (keepPreviousData — без мигания при пагинации). */
export const useReferralPartners = (params: ReferralPartnersParams) =>
  useQuery({
    queryKey: referralKeys.partners(params),
    queryFn: () => getReferralPartners(params),
    placeholderData: keepPreviousData,
  });

/** Карточка партнёра; включается только при наличии id. */
export const useReferralPartnerCard = (
  id: number | null,
  params: ReferralPartnerCardParams = {},
) =>
  useQuery({
    queryKey: referralKeys.partnerCard(id ?? 0, params),
    queryFn: () => getReferralPartnerCard(id!, params),
    enabled: id != null,
  });

/** Ставки уровней реферальной системы. */
export const useReferralSystemLevels = () =>
  useQuery({
    queryKey: referralKeys.levels(),
    queryFn: getReferralSystemLevels,
  });

/** Изменить ставку уровня; при успехе инвалидирует ставки. */
export const useUpdateReferralLevelRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetType,
      levelCode,
      reward_percent,
    }: {
      targetType: ReferralTarget;
      levelCode: string;
      reward_percent: number;
    }) => updateReferralLevelRate(targetType, levelCode, reward_percent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.levels() });
    },
  });
};
```

> Примечание про `getReferralSystemLevels`: ответ `/levels` в схеме — инлайновый объект `{ client_line, business_line }`. Если сгенерированный тип `data` уже структурно совпадает с `AdminReferralSystemLevelsData`, cast `as` можно убрать; если tsc ругается на расхождение — оставить `as AdminReferralSystemLevelsData`.

- [ ] **Step 3: Реэкспортировать новое из барреля**

В `src/lib/api/index.ts` в блоке `export { … } from "./referral";` добавить строки:

```ts
  getReferralPartnerSummary,
  useReferralPartnerSummary,
  getReferralPartners,
  useReferralPartners,
  getReferralPartnerCard,
  useReferralPartnerCard,
  getReferralSystemLevels,
  useReferralSystemLevels,
  updateReferralLevelRate,
  useUpdateReferralLevelRate,
  type AdminReferralPartnerSummary,
  type AdminReferralPartnerPage,
  type AdminReferralPartnerItem,
  type AdminReferralPartnerCard,
  type AdminReferralInvitee,
  type AdminReferralSystemLevel,
  type AdminReferralSystemLevelsData,
  type ReferralPartnerStatus,
  type ReferralLevelCode,
  type ReferralTarget,
  type ReferralPartnersParams,
  type ReferralPartnerCardParams,
```

- [ ] **Step 4: Проверить сборку и линт**

Run: `pnpm build`
Expected: PASS (без ошибок tsc и успешная сборка Vite). Если tsc ругается на `getReferralSystemLevels` cast или `ReferralLevelCode` — применить примечание из Step 2.

Run: `pnpm lint`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/referral.ts src/lib/api/index.ts
git commit -m "feat(referral): api-слой admin-эндпоинтов рефералки (partners/summary/levels)"
```

---

## Task 2: KPI из `partners/summary`

**Files:**
- Modify: `src/pages/referral-program-page.tsx` (блок из 3 `StatCard` + импорты/хуки)

**Interfaces:**
- Consumes: `useReferralPartnerSummary` из `@/lib/api`; существующие на странице `formatDelta`, `formatCount`, `toIsoDate`, `from`/`to`, `DateFilter`, `StatCard`.
- Produces: три живые KPI-карточки.

- [ ] **Step 1: Подключить summary-хук**

В `referral-program-page.tsx` рядом с `const { data: stats } = useReferralStats({ from, to });` добавить:

```tsx
  const { data: summary } = useReferralPartnerSummary({ from, to });
```

Добавить `useReferralPartnerSummary` в импорт из `@/lib/api`.

- [ ] **Step 2: Переписать блок KPI**

Заменить текущий `<div className="grid grid-cols-1 gap-3 sm:grid-cols-3"> … </div>` (три `StatCard`, где две демо) на все три из summary:

```tsx
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Активные партнёры"
          value={formatCount(summary?.active_partners_count)}
          delta={formatDelta(summary?.active_partners_change_percent).text}
          deltaUp={formatDelta(summary?.active_partners_change_percent).up}
          icon={Users}
          tone="brand"
        />
        <StatCard
          title="Общая сумма вознаграждений"
          value={formatAccruedMln(summary?.total_accrued_rub)}
          delta={formatDelta(summary?.total_accrued_change_percent).text}
          deltaUp={formatDelta(summary?.total_accrued_change_percent).up}
          icon={CreditCard}
          tone="success"
        />
        <StatCard
          title="Неактивные партнёры"
          value={formatCount(summary?.inactive_partners_count)}
          delta={formatDelta(summary?.inactive_partners_change_percent).text}
          deltaUp={formatDelta(summary?.inactive_partners_change_percent).up}
          icon={Users}
          tone="warning"
        />
      </div>
```

Добавить хелпер рядом с `formatCount` (в начале файла):

```tsx
/** Крупная сумма в ₽: ≥1 млн — «N,N млн ₽», иначе — «N ₽». */
const formatAccruedMln = (rub: number | undefined) => {
  if (rub == null) return "—";
  if (rub >= 1_000_000) return `${formatMillions(rub / 1_000_000)} млн ₽`;
  return `${numberFmt.format(rub)} ₽`;
};
```

Импортировать `formatMillions` из `@/lib/format` и иконку `CreditCard` из `lucide-react` (у `Image` из прежнего демо KPI убрать импорт, если больше не используется). `stats`/`useReferralStats` оставить — `active_ambassadors` может ещё использоваться; если после задачи он нигде не читается, убрать его импорт и вызов (проверит линт).

- [ ] **Step 3: Проверка**

Run: `pnpm build` → PASS. Run: `pnpm lint` → без ошибок (в т.ч. нет неиспользуемых импортов `Image`/`stats`).

Ручная проверка: `pnpm dev`, открыть `/referral` — три KPI показывают числа из API и дельты; при смене периода в `DateFilter` значения обновляются.

- [ ] **Step 4: Commit**

```bash
git add src/pages/referral-program-page.tsx
git commit -m "feat(referral): KPI из partners/summary (живые)"
```

---

## Task 3: Вкладка «Партнёры» на `GET /partners`

**Files:**
- Modify: `src/pages/referral-program-page.tsx`

**Interfaces:**
- Consumes: `useReferralPartners`, типы `AdminReferralPartnerItem`, `ReferralPartnerStatus`, `ReferralLevelCode` из `@/lib/api`; существующие `SearchInput`, `DataTable`, `StatusPill`, `AccountCell`, `CheckboxFilterMenu`, `LevelChip`, `LEVEL_TONE_CLS`, `LEVEL_TONE_BY_INDEX`.
- Produces: живая таблица партнёров; состояние `selectedPartnerId` для Task 4.

- [ ] **Step 1: Состояние фильтров/пагинации + дебаунс поиска**

В теле `ReferralProgramPage` добавить:

```tsx
  const [statusFilter, setStatusFilter] = useState<ReferralPartnerStatus[]>([]);
  const [clientLevel, setClientLevel] = useState<ReferralLevelCode[]>([]);
  const [businessLevel, setBusinessLevel] = useState<ReferralLevelCode[]>([]);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Дебаунс поискового запроса (300мс) → серверный search.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Сброс offset при смене любого фильтра/поиска/периода.
  useEffect(() => {
    setOffset(0);
  }, [debouncedQuery, statusFilter, clientLevel, businessLevel, from, to]);

  const partnersQuery = useReferralPartners({
    from,
    to,
    search: debouncedQuery || undefined,
    status: statusFilter[0],
    client_level_code: clientLevel[0],
    business_level_code: businessLevel[0],
    offset,
    limit: LIMIT,
  });
  const partners = partnersQuery.data?.items ?? [];
  const total = partnersQuery.data?.total ?? 0;
```

Добавить в импорты: `useEffect` из `react`; `useReferralPartners`, `type AdminReferralPartnerItem`, `type ReferralPartnerStatus`, `type ReferralLevelCode` из `@/lib/api`; `CheckboxFilterMenu` из `@/components`.

- [ ] **Step 2: Константы кодов уровней + тон по коду**

Рядом с `LEVEL_TONE_*` добавить:

```tsx
/** Коды уровней линии (API) → русские подписи для фильтра. */
const LEVEL_CODE_OPTIONS: { value: ReferralLevelCode; label: string }[] = [
  { value: "START", label: "Старт" },
  { value: "DEVELOPMENT", label: "Развитие" },
  { value: "PROFESSIONAL", label: "Профессиональный" },
  { value: "STRATEGIC", label: "Стратегический" },
];

/** Тон пилюли по коду уровня. */
const LEVEL_TONE_BY_CODE: Record<string, LevelTone> = {
  START: "green",
  DEVELOPMENT: "blue",
  PROFESSIONAL: "purple",
  STRATEGIC: "orange",
};

const STATUS_OPTIONS: { value: ReferralPartnerStatus; label: string }[] = [
  { value: "ACTIVE", label: "Активен" },
  { value: "INACTIVE", label: "Неактивен" },
];
```

- [ ] **Step 3: Переписать `LevelChip` под код уровня + колонки живой таблицы**

Обновить `LevelChip`, чтобы принимал `level: AdminReferralSystemLevel` (поля `title`/`level_code`/`reward_percent`):

```tsx
/** Чип уровня «Название • N%» — тон по level_code. */
function LevelChip({ level }: { level: AdminReferralSystemLevel }) {
  const tone = LEVEL_TONE_BY_CODE[level.level_code] ?? "purple";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium tracking-tight",
        LEVEL_TONE_CLS[tone],
      )}
    >
      {level.title} • {level.reward_percent}%
    </span>
  );
}
```

Добавить `AdminReferralSystemLevel` в импорт из `@/lib/api`. Заменить демо-`partnerColumns` на колонки по `AdminReferralPartnerItem`:

```tsx
  const partnerColumns: ColumnDef<AdminReferralPartnerItem>[] = [
    {
      accessorKey: "name",
      header: () => <span>партнёр</span>,
      cell: ({ row }) => (
        <AccountCell
          name={row.original.name}
          onNameClick={() => setSelectedPartnerId(row.original.referral_user_id)}
        />
      ),
    },
    {
      id: "client_level",
      header: () => <span>уровень клиента</span>,
      cell: ({ row }) => <LevelChip level={row.original.levels.client} />,
    },
    {
      id: "business_level",
      header: () => <span>уровень бизнеса</span>,
      cell: ({ row }) => <LevelChip level={row.original.levels.business} />,
    },
    {
      accessorKey: "referrals_count",
      header: () => <span>рефералы</span>,
      cell: ({ row }) => <span>{row.original.referrals_count}</span>,
    },
    {
      accessorKey: "total_accrued_rub",
      header: () => <span>всего начислено</span>,
      cell: ({ row }) => <span>{numberFmt.format(row.original.total_accrued_rub)} ₽</span>,
    },
    {
      accessorKey: "status",
      header: () => <span>статус</span>,
      cell: ({ row }) =>
        row.original.status === "ACTIVE" ? (
          <StatusPill label="Активен" cls="bg-success-bg text-success-fg" />
        ) : (
          <StatusPill label="Неактивен" cls="bg-warning-bg text-warning" info />
        ),
    },
  ];
```

Добавить состояние `const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);` (используется в Task 4). Удалить демо-массив `PARTNERS_DEMO` и тип `PartnerRow`.

- [ ] **Step 4: Отрендерить вкладку с фильтрами и пагинацией**

В JSX вкладки «Партнёры» (`activeTab === "Партнёры"`) показать поиск, фильтры-заголовки через `DataTable` (фильтры рисуются в `header` колонок — заменить соответствующие `header` на `CheckboxFilterMenu`), таблицу и Prev/Next:

```tsx
  // header'ы колонок статуса/уровней — фильтры (allOption не нужен, выбор одиночный по API,
  // поэтому onApply берёт последний выбранный: values.slice(-1)).
```

В колонке `status` заменить `header` на:
```tsx
      header: () => (
        <CheckboxFilterMenu
          label="статус"
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onApply={(v) => setStatusFilter(v.slice(-1))}
        />
      ),
```
В `client_level` — на `CheckboxFilterMenu label="уровень клиента" options={LEVEL_CODE_OPTIONS} selected={clientLevel} onApply={(v) => setClientLevel(v.slice(-1))}`; аналогично `business_level` с `businessLevel`/`setBusinessLevel`.

Разметка вкладки (поиск сверху, затем `DataTable`, затем пагинация). Для `gridClassName` взять 6 колонок, напр. `grid-cols-[1.6fr_1fr_1fr_0.8fr_1fr_1fr]`:

```tsx
        <div className="flex flex-col gap-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по имени"
          />
          {partnersQuery.isError ? (
            <p className="text-sm text-danger">
              {partnersQuery.error instanceof ApiError
                ? partnersQuery.error.message
                : "Не удалось загрузить партнёров"}
            </p>
          ) : (
            <>
              <DataTable
                columns={partnerColumns}
                data={partners}
                gridClassName="grid-cols-[1.6fr_1fr_1fr_0.8fr_1fr_1fr]"
              />
              {partners.length === 0 && !partnersQuery.isFetching && (
                <p className="py-8 text-center text-sm text-ink-muted">
                  Партнёры не найдены
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">
                  {total > 0
                    ? `${offset + 1}–${Math.min(offset + LIMIT, total)} из ${total}`
                    : "—"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                    className="h-10 cursor-pointer rounded-xl border border-grey-3 px-4 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    disabled={offset + LIMIT >= total}
                    onClick={() => setOffset((o) => o + LIMIT)}
                    className="h-10 cursor-pointer rounded-xl border border-grey-3 px-4 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
```

Добавить `ApiError` и `SearchInput` в импорты (если ещё нет). Убедиться, что `SearchInput` принимает `value`/`onChange` (сверить с существующим использованием на другой странице; если проп называется иначе — привести к фактической сигнатуре `src/components/search-input.tsx`).

- [ ] **Step 5: Проверка**

Run: `pnpm build` → PASS. Run: `pnpm lint` → без ошибок (демо `PARTNERS_DEMO`/`PartnerRow` удалены, неиспользуемых символов нет).

Ручная проверка (`pnpm dev` → `/referral`, вкладка «Партнёры»): список грузится из API; поиск фильтрует с задержкой; фильтры статуса и уровней в заголовках меняют выдачу; «Назад/Вперёд» листают; при пустой выдаче — «Партнёры не найдены».

- [ ] **Step 6: Commit**

```bash
git add src/pages/referral-program-page.tsx
git commit -m "feat(referral): вкладка «Партнёры» на живом GET /partners (поиск/фильтры/пагинация)"
```

---

## Task 4: Карточка партнёра на `partners/{id}`

**Files:**
- Modify: `src/components/partner-info-dialog.tsx`
- Modify: `src/pages/referral-program-page.tsx` (подключение модалки к `selectedPartnerId`)

**Interfaces:**
- Consumes: `useReferralPartnerCard`, типы `AdminReferralPartnerCard`, `AdminReferralInvitee`, `AdminReferralSystemLevel` из `@/lib/api`; `ModalShell`, `Dialog`, `SegmentTabs`, `StatusPill`, `Avatar`.
- Produces: `PartnerInfoDialog` с пропсами `{ open, onOpenChange, partnerId }`.

- [ ] **Step 1: Переписать `PartnerInfoDialog` на живые данные**

Заменить содержимое `src/components/partner-info-dialog.tsx`: пропсы — `{ open, onOpenChange, partnerId }: { open: boolean; onOpenChange: (o: boolean) => void; partnerId: number | null }`. Внутри:

```tsx
  const { data: card, isLoading, isError } = useReferralPartnerCard(partnerId, {});
```

Убрать демо-тип `PartnerInfo` и экспортировать вместо него ничего (или `export type { AdminReferralPartnerCard }` при необходимости). Шапка:
- Имя — `card.name`.
- Подпись — человекочитаемый `business_type` (`SE` → «Самозанятый», `IE` → «ИП», `LLC` → «ООО», `null` → «клиент»), хелпер `businessTypeLabel`.
- Две пилюли уровней — `card.levels.client` и `card.levels.business` (локальный `LevelChip` по `level_code`, тон как в Task 3; вынести тон-мапу или продублировать `LEVEL_TONE_BY_CODE` в этом файле — модуль самодостаточен).
- Статус — `card.status` ACTIVE/INACTIVE через `StatusPill`.

Сводная полоска (`SummaryStat`): `card.referrals.total` (Рефералов), `${numberFmt.format(card.total_accrued_rub)} ₽` (Начислено всего), `card.activated_at` → формат даты `dd.MM.yyyy` (null → «—»). `numberFmt` объявить в файле (`new Intl.NumberFormat("ru-RU")`).

- [ ] **Step 2: Вкладка «Приглашённые» (живая) + «Начисления» (мок)**

Вкладка «Приглашённые» — из `card.referrals.items` (`AdminReferralInvitee[]`). Колонки: реферал (`display_name` + подпись по `referred_type`: CLIENT «клиент», MASTER «мастер», SALON «салон»), статус (маппинг ниже), всего начислено (`${numberFmt.format(total_accrued_rub)} ₽`), дата активации (`activated_at` → `dd.MM.yyyy` | «—»). Мапа статусов приглашённого:

```tsx
const INVITEE_STATUS: Record<
  AdminReferralInvitee["status"],
  { label: string; cls: string }
> = {
  WAITING_FOR_SERVICE: { label: "Ждём первой услуги", cls: "bg-warning-bg text-warning" },
  NOT_LINKED: { label: "Не привязан", cls: "bg-danger-bg text-danger" },
  ACTIVE: { label: "Активен", cls: "bg-success-bg text-success-fg" },
  EARNINGS_COMPLETED: { label: "Начисления завершены", cls: "bg-grey-5 text-ink-muted" },
};
```
(Если классов `bg-danger-bg`/`bg-grey-5` нет в теме — взять ближайшие существующие, напр. `bg-warning-bg text-warning` и `bg-grey-4 text-ink-muted`; сверить с `src/index.css`.)

Вкладка «Начисления» — **оставить демо-таблицу** (`ACCRUALS_DEMO`), добавив над ней комментарий:
```tsx
{/* ⚠️ TODO(бэкенд): эндпоинта начислений партнёра в admin-API нет — данные демо. */}
```

Добавить состояния: при `isLoading` — скелет/«Загрузка…», при `isError` — текст ошибки, `if (!partnerId) return null;` до запроса.

- [ ] **Step 3: Подключить модалку на странице**

В `referral-program-page.tsx` заменить старый рендер `<PartnerInfoDialog … partner={partner} />` и состояние `partner`/`setPartner` на:

```tsx
      <PartnerInfoDialog
        open={selectedPartnerId !== null}
        onOpenChange={(open) => !open && setSelectedPartnerId(null)}
        partnerId={selectedPartnerId}
      />
```

Удалить импорт/использование демо-типа `PartnerInfo` и прежнего `setPartner`-колбэка в колонках (в Task 3 уже `onNameClick={() => setSelectedPartnerId(...)}`).

- [ ] **Step 4: Проверка**

Run: `pnpm build` → PASS. Run: `pnpm lint` → без ошибок.

Ручная проверка: клик по имени партнёра открывает модалку; шапка/сводка/уровни/статус — из API; вкладка «Приглашённые» показывает рефералов с корректными статусами; «Начисления» — демо (с пометкой в коде).

- [ ] **Step 5: Commit**

```bash
git add src/components/partner-info-dialog.tsx src/pages/referral-program-page.tsx
git commit -m "feat(referral): карточка партнёра на partners/{id} (приглашённые — живые, начисления — демо)"
```

---

## Task 5: Вкладка «Уровни и ставки» на `/levels`

**Files:**
- Modify: `src/pages/referral-program-page.tsx`

**Interfaces:**
- Consumes: `useReferralSystemLevels`, `useUpdateReferralLevelRate`, типы `AdminReferralSystemLevel`, `ReferralTarget` из `@/lib/api`; существующие `LevelCard`/`LevelSection` (адаптировать), `useToast`, `ApiError`.
- Produces: живая вкладка уровней.

- [ ] **Step 1: Подключить хуки уровней, убрать rules**

В теле страницы заменить `const rulesQuery = useReferralRules(); const updateRule = useUpdateReferralRule();` на:

```tsx
  const levelsQuery = useReferralSystemLevels();
  const updateLevel = useUpdateReferralLevelRate();

  const clientLevels = levelsQuery.data?.client_line.levels ?? [];
  const businessLevels = levelsQuery.data?.business_line.levels ?? [];
```

Удалить `clientRules`/`businessRules` (`useMemo` по `target_type`) и `saveRate` на базе `updateRule`. Убрать импорты `useReferralRules`, `useUpdateReferralRule`, `type AdminReferralRule` из `@/lib/api` (они остаются в api-слое для loyalty, но на этой странице не нужны).

- [ ] **Step 2: Адаптировать `LevelCard`/`LevelSection` под уровень системы**

`LevelCard` принимает `level: AdminReferralSystemLevel` и `onSave: (percent: number) => Promise<void>`; название — `level.title` (убрать зависимость от `LEVEL_NAMES`/`index`), тон — по `level.level_code` (`LEVEL_TONE_BY_CODE` из Task 3), бейдж «Уровень» заменить на `level.title`. Валидация ставки 0–100 остаётся.

```tsx
function LevelCard({
  level,
  onSave,
}: {
  level: AdminReferralSystemLevel;
  onSave: (percent: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(level.reward_percent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== String(level.reward_percent);
  const parsed = Number(value);
  const valid =
    value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;

  const save = async () => {
    if (!valid || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(parsed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const tone = LEVEL_TONE_BY_CODE[level.level_code] ?? "purple";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-grey-4 bg-white p-4">
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
          LEVEL_TONE_CLS[tone],
        )}
      >
        {level.title}
      </span>
      <div className="mt-auto flex flex-col gap-1.5">
        <span className="text-xs text-ink-muted">Ставка, %</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 w-full rounded-xl border border-grey-3 bg-white px-3 text-base text-ink outline-none transition-colors focus:border-brand"
          />
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !valid || saving}
            className="h-11 shrink-0 cursor-pointer rounded-xl border border-grey-3 px-4 text-sm font-medium text-ink transition-colors hover:bg-grey-5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
```

`LevelSection` — принимает `levels: AdminReferralSystemLevel[]` и `onSave: (level, percent) => Promise<void>`, маппит `LevelCard`. Убрать параметр `index`. Удалить константу `LEVEL_NAMES`.

- [ ] **Step 3: Обработчик сохранения ставки по линии**

Добавить в теле страницы:

```tsx
  const saveRate = async (
    targetType: ReferralTarget,
    level: AdminReferralSystemLevel,
    percent: number,
  ) => {
    try {
      await updateLevel.mutateAsync({
        targetType,
        levelCode: level.level_code,
        reward_percent: percent,
      });
      toast.success("Ставка сохранена");
    } catch (err) {
      toast.error(
        "Не удалось сохранить ставку",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };
```

В JSX вкладки «Уровни и ставки» рендерить две секции:

```tsx
        <div className="flex flex-col gap-8">
          <LevelSection
            title="Клиенты"
            levels={clientLevels}
            onSave={(level, percent) => saveRate("CLIENT", level, percent)}
          />
          <LevelSection
            title="Бизнес"
            levels={businessLevels}
            onSave={(level, percent) => saveRate("BUSINESS", level, percent)}
          />
        </div>
```

Добавить `ReferralTarget` в импорт из `@/lib/api`.

- [ ] **Step 4: Проверка**

Run: `pnpm build` → PASS. Run: `pnpm lint` → без ошибок (нет осиротевших `LEVEL_NAMES`, `clientRules`, `AdminReferralRule`).

Ручная проверка: вкладка «Уровни и ставки» грузит уровни из `/levels`; правка ставки и «Сохранить» шлёт PATCH, показывает тост, значение сохраняется после перезагрузки.

- [ ] **Step 5: Commit**

```bash
git add src/pages/referral-program-page.tsx
git commit -m "feat(referral): «Уровни и ставки» на GET /levels + PATCH (миграция с /rules)"
```

---

## Task 6: Пометить моки, финальная чистка, CLAUDE.md

**Files:**
- Modify: `src/pages/referral-program-page.tsx` (комментарии-пометки «Рефералы»/«Проверка документов»)
- Modify: `CLAUDE.md` (раздел «Статус работ» + «Вопросы к бэкендеру»)

**Interfaces:**
- Consumes: —. Produces: финальное консистентное состояние.

- [ ] **Step 1: Явно пометить оставшиеся моки**

Над демо-данными/рендером вкладки «Рефералы» добавить комментарий:
```tsx
{/* ⚠️ TODO(бэкенд): плоского эндпоинта «Рефералы» в admin-API нет (только
    приглашённые внутри карточки партнёра) — вкладка на демо-данных. */}
```
Над вкладкой «Проверка документов»:
```tsx
{/* ⚠️ TODO(бэкенд): раздел дублирует страницу /documents (business-registry);
    в рефералке отдельного потока нет — вкладка на демо-данных. */}
```
Убедиться, что демо-массивы, относящиеся только к «Партнёрам»/«Рефералам» удалённых частей, либо используются демо-вкладками, либо удалены (линт не должен ругаться на unused).

- [ ] **Step 2: Обновить CLAUDE.md**

В разделе «Статус работ» заменить пункт про `referral-program-page.tsx` на описание живого состояния: KPI ← `partners/summary`; «Партнёры» ← `GET /partners` (поиск/фильтры статуса и уровней/пагинация); карточка партнёра ← `partners/{id}` (приглашённые живые, начисления демо); «Уровни и ставки» ← `/levels` + PATCH; вкладки «Рефералы» и «Проверка документов» — демо (нет эндпоинтов). В «Вопросы к бэкендеру» добавить три пункта: нет плоского списка рефералов; нет эндпоинта начислений партнёра; «Проверка документов» в рефералке дублирует `/documents`.

- [ ] **Step 3: Полная проверка**

Run: `pnpm build` → PASS. Run: `pnpm lint` → без ошибок.

Ручная проверка всего экрана `/referral`: KPI, все 4 вкладки открываются, живые — работают с бэком, моки — на месте с пометками.

- [ ] **Step 4: Commit**

```bash
git add src/pages/referral-program-page.tsx CLAUDE.md
git commit -m "docs(referral): пометить моки, обновить статус и вопросы к бэкендеру в CLAUDE.md"
```

---

## Примечания по верификации

- Юнит-тестов в проекте нет (см. `package.json` — только `dev/build/lint/preview/api:gen`). Гейт качества каждой задачи: `pnpm build` (tsc находит несоответствия типов схемы/хуков) + `pnpm lint` + ручная проверка в `pnpm dev`. Апрув каждого шага — через агента `/plan-step-approver`.
- Все названия хуков/типов между задачами согласованы: `useReferralPartnerSummary`, `useReferralPartners`, `useReferralPartnerCard`, `useReferralSystemLevels`, `useUpdateReferralLevelRate`; типы `AdminReferralPartnerItem/Card/Summary/Page`, `AdminReferralInvitee`, `AdminReferralSystemLevel`, `ReferralPartnerStatus`, `ReferralLevelCode`, `ReferralTarget`.
