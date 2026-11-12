import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteMastersSalons } from "@/lib/api/infinite-lists";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Ban,
  Home,
  Users,
  Check,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Card,
  SortMenu,
  StatCard,
  DataTable,
  RoleBadge,
  RowActions,
  DateFilter,
  SearchInput,
  AccountCell,
  CityFilterHeader,
  ClearFiltersButton,
  SalonProfileDialog,
  AccountStatusBadge,
  CheckboxFilterMenu,
  MasterProfileDialog,
  UnblockAccountDialog,
  type SortDir,
  type DateRange,
  type AccountRole,
  type AccountStatus,
} from "@/components";
import { useToast } from "@/components/ui";
import { usePersistentState } from "@/lib/use-persistent-state";
import {
  ApiError,

  useBlockProvider,
  useUnblockProvider,
  useProviderProfile,
  useMasterSalonStats,
  useUpdateMaster,
  useUpdateSalon,
  type MasterSalonRole,
  type AdminSalonProfile,
  type MasterSalonStatus,
  type AdminMasterProfile,
  type AdminMasterUpdateRequest,
  type AdminSalonUpdateRequest,
  type AdminMasterSalonListItem,
} from "@/lib/api";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 10;

type SortField = "rating" | "reviews_count" | "income_amount";
type Sort = { field: SortField; dir: SortDir };

type Row = {
  id: number;
  /**
   * id для эндпоинтов провайдера (`/masters/{id}` или `/salons/{id}`): у салона
   * это `salonId`, у мастера — `id`. Используется для профиля и блокировки.
   */
  providerId: number;
  /** Роль в API — нужна для эндпоинтов блокировки. */
  apiRole: MasterSalonRole;
  role: AccountRole;
  name: string;
  phone: string;
  city: string;
  rating: string;
  reviews: number;
  income: string;
  status: AccountStatus;
  /** Причина прошлой блокировки — для модалки разблокировки. */
  blockReason: string | null;
  avatar: number | null;
};

/** Роль: API ↔ UI. */
const ROLE_TO_UI: Record<MasterSalonRole, AccountRole> = {
  MASTER: "master",
  SALON: "salon",
};
const ROLE_TO_API: Record<AccountRole, MasterSalonRole> = {
  master: "MASTER",
  salon: "SALON",
};

/** Статус: API ↔ UI. */
const STATUS_TO_UI: Record<MasterSalonStatus, AccountStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BLOCKED: "blocked",
};
const STATUS_TO_API: Record<AccountStatus, MasterSalonStatus> = {
  active: "ACTIVE",
  inactive: "INACTIVE",
  blocked: "BLOCKED",
};

const ROLE_OPTIONS: { value: AccountRole; label: string }[] = [
  { value: "master", label: "Мастер" },
  { value: "salon", label: "Салон" },
];

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Активен" },
  { value: "inactive", label: "Неактивен" },
  { value: "blocked", label: "Заблокирован" },
];

const numberFmt = new Intl.NumberFormat("ru-RU");

const formatCount = (value: number | undefined) =>
  value == null ? "—" : numberFmt.format(value);

/** Пара «мастера / салоны» для KPI. */
const formatPair = (a: number | undefined, b: number | undefined) =>
  `${formatCount(a)} / ${formatCount(b)}`;

/** Дельта к прошлому периоду: текст со знаком + направление для бейджа. */
const formatDelta = (
  percent: number | null | undefined,
): { text?: string; up?: boolean } => {
  if (percent == null) return {};
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return {
    text: `${sign}${numberFmt.format(Math.abs(rounded))}%`,
    up: rounded >= 0,
  };
};

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Дефолтный период — последние 30 дней. */
const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
};

/** Аккаунт из API → строка таблицы. */
const toRow = (item: AdminMasterSalonListItem): Row => ({
  id: item.id,
  // Салон адресуется по salonId; у мастера salonId нет — берём id.
  providerId: item.role === "SALON" ? item.salonId ?? item.id : item.id,
  apiRole: item.role,
  role: ROLE_TO_UI[item.role],
  name: item.name || item.phone || "Без имени",
  phone: item.phone ?? "—",
  city: item.city ?? "—",
  rating: item.rating != null ? item.rating.toFixed(1) : "—",
  reviews: item.reviews_count ?? 0,
  income:
    item.income_amount != null
      ? `₽ ${numberFmt.format(item.income_amount)}`
      : "—",
  status: STATUS_TO_UI[item.status],
  blockReason: item.blockReason ?? null,
  avatar: item.avatar ?? null,
});

/** Сетка колонок таблицы — общая для шапки и строк. */
const GRID =
  "grid grid-cols-[2fr_0.9fr_1fr_0.8fr_0.8fr_1fr_1.3fr_1.4fr] items-center gap-4";

/* --------------------------------------------------------------------- экран */

const MastersPage = () => {
  const [sort, setSort] = usePersistentState<Sort | null>("masters.sort", null);
  const [query, setQuery] = usePersistentState("masters.query", "");
  const [range, setRange] = usePersistentState<DateRange | undefined>(
    "masters.range",
    defaultRange,
  );
  const [roles, setRoles] = usePersistentState<AccountRole[]>(
    "masters.roles",
    [],
  );
  const [cities, setCities] = usePersistentState<string[]>("masters.cities", []);
  const [statuses, setStatuses] = usePersistentState<AccountStatus[]>(
    "masters.statuses",
    [],
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const from = range?.from ? toIsoDate(range.from) : null;
  const to = range?.to ? toIsoDate(range.to) : null;


  const { data: stats } = useMasterSalonStats({
    from: from ?? "",
    to: to ?? "",
  });

  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteMastersSalons({
    from: from ?? "",
    to: to ?? "",
    query: debouncedQuery || undefined,
    city: cities.length ? cities : undefined,
    role: roles.length ? roles.map((r) => ROLE_TO_API[r]) : undefined,
    status: statuses.length ? statuses.map((s) => STATUS_TO_API[s]) : undefined,
    sort: sort ? [`${sort.field}:${sort.dir}`] : undefined,

    limit: PAGE_SIZE,
  });

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const { mutateAsync: blockProviderFn } = useBlockProvider();
  const { mutateAsync: unblockProviderFn } = useUnblockProvider();
  const toast = useToast();

  /** Русская подпись субъекта для тостов. */
  const providerLabel = (variant: "master" | "salon") =>
    variant === "salon" ? "Салон" : "Мастер";

  // Блокировка/разблокировка с тостами. Ошибку пробрасываем, чтобы диалог
  // показал её инлайном и не закрылся.
  const handleBlock = async (
    variant: "master" | "salon",
    id: number,
    role: MasterSalonRole,
    reason: string,
  ) => {
    try {
      await blockProviderFn({ id, role, reason });
      toast.success(`${providerLabel(variant)} заблокирован`);
    } catch (err) {
      toast.error(
        "Не удалось заблокировать",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  const handleUnblock = async (
    variant: "master" | "salon",
    id: number,
    role: MasterSalonRole,
  ) => {
    try {
      await unblockProviderFn({ id, role });
      toast.success(`${providerLabel(variant)} разблокирован`);
    } catch (err) {
      toast.error(
        "Не удалось разблокировать",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  // Разблокировка: открываем сразу с причиной из строки, менеджера тянем профилем.
  const [unblock, setUnblock] = useState<{
    id: number;
    role: MasterSalonRole;
    variant: "master" | "salon";
    reason: string | null;
  } | null>(null);
  const unblockProfile = useProviderProfile(
    unblock?.id ?? null,
    unblock?.role ?? null,
  );
  const unblockManager = unblockProfile.data?.blocked_by?.display_name ?? null;

  // Просмотр профиля мастера/салона — по клику на имя в таблице.
  const [profileTarget, setProfileTarget] = useState<{
    id: number;
    role: MasterSalonRole;
    variant: "master" | "salon";
  } | null>(null);
  const profileQuery = useProviderProfile(
    profileTarget?.id ?? null,
    profileTarget?.role ?? null,
  );
  const closeProfile = () => setProfileTarget(null);

  const updateMaster = useUpdateMaster();
  const updateSalon = useUpdateSalon();

  // Сохранение профиля: по провайдеру. Ошибку пробрасываем, чтобы модалка
  // показала её инлайном и осталась в режиме правки.
  const saveMaster = async (body: AdminMasterUpdateRequest) => {
    if (!profileTarget) return;
    try {
      await updateMaster.mutateAsync({ id: profileTarget.id, body });
      toast.success("Профиль мастера обновлён");
    } catch (err) {
      toast.error(
        "Не удалось сохранить",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };
  const saveSalon = async (body: AdminSalonUpdateRequest) => {
    if (!profileTarget) return;
    try {
      await updateSalon.mutateAsync({ id: profileTarget.id, body });
      toast.success("Профиль салона обновлён");
    } catch (err) {
      toast.error(
        "Не удалось сохранить",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  // Профиль не загрузился — модалка не откроется, поэтому сообщаем тостом.
  useEffect(() => {
    if (!profileTarget || !profileQuery.isError) return;
    toast.error(
      "Не удалось загрузить профиль",
      profileQuery.error instanceof ApiError
        ? profileQuery.error.message
        : "Попробуйте ещё раз.",
    );
    setProfileTarget(null);
  }, [profileTarget, profileQuery.isError, profileQuery.error, toast]);

  const totalMastersDelta = formatDelta(stats?.total_masters_change_percent);
  const totalSalonsDelta = formatDelta(stats?.total_salons_change_percent);

  // Стабильный заголовок города: читает выбор из ref, применяет сразу — чтобы
  // меню не перемонтировалось и не закрывалось на каждый выбор города.
  const citySelRef = useRef(cities);
  citySelRef.current = cities;
  const cityHeader = useCallback(
    () => <CityFilterHeader selected={citySelRef.current} onApply={setCities} />,
    [],
  );

  // Стабильные заголовки роли и статуса + мгновенное применение.
  const roleSelRef = useRef(roles);
  roleSelRef.current = roles;
  const roleHeader = useCallback(
    () => (
      <CheckboxFilterMenu
        label="роль"
        options={ROLE_OPTIONS}
        selected={roleSelRef.current}
        onApply={setRoles}
        allOption
      />
    ),
    [],
  );

  const statusSelRef = useRef(statuses);
  statusSelRef.current = statuses;
  const statusHeader = useCallback(
    () => (
      <CheckboxFilterMenu
        label="статус"
        options={STATUS_OPTIONS}
        selected={statusSelRef.current}
        onApply={setStatuses}
        allOption
      />
    ),
    [],
  );

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { mobileLabel: "Аккаунт" },
        header: () => <span>аккаунт</span>,
        cell: ({ row }) => (
          <AccountCell
            name={row.original.name}
            subtitle={row.original.phone}
            avatarId={row.original.avatar}
            onNameClick={() =>
              setProfileTarget({
                id: row.original.providerId,
                role: row.original.apiRole,
                variant: row.original.role,
              })
            }
          />
        ),
      },
      {
        accessorKey: "role",
        meta: { mobileLabel: "Роль", mobileFilter: true },
        header: roleHeader,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "city",
        meta: { mobileLabel: "Город", mobileFilter: true },
        header: cityHeader,
        cell: ({ row }) => <span>{row.original.city}</span>,
      },
      {
        accessorKey: "rating",
        meta: { mobileLabel: "Рейтинг", mobileFilter: true },
        header: () => (
          <SortMenu
            label="рейтинг"
            value={sort?.field === "rating" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "rating", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.rating}</span>,
      },
      {
        accessorKey: "reviews",
        meta: { mobileLabel: "Отзывы", mobileFilter: true },
        header: () => (
          <SortMenu
            label="отзывы"
            value={sort?.field === "reviews_count" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "reviews_count", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.reviews}</span>,
      },
      {
        accessorKey: "income",
        meta: { mobileLabel: "Доход", mobileFilter: true },
        header: () => (
          <SortMenu
            label="доход"
            value={sort?.field === "income_amount" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "income_amount", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.income}</span>,
      },
      {
        accessorKey: "status",
        meta: { mobileLabel: "Статус", mobileFilter: true },
        header: statusHeader,
        cell: ({ row }) => <AccountStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span>действия</span>,
        meta: { mobileLabel: "Действия",
          headerClassName: "text-right",
          cellClassName: "flex justify-end",
        },
        cell: ({ row }) => (
          <RowActions
            blocked={row.original.status === "blocked"}
            showView={false}
            showEdit={false}
            blockVariant={row.original.role}
            onBlock={(reason) =>
              handleBlock(
                row.original.role,
                row.original.providerId,
                row.original.apiRole,
                reason,
              )
            }
            onUnblock={() =>
              setUnblock({
                id: row.original.providerId,
                role: row.original.apiRole,
                variant: row.original.role,
                reason: row.original.blockReason,
              })
            }
          />
        ),
      },
    ],
    [cityHeader, roleHeader, statusHeader, sort],
  );


  // Число активных фильтров (для кнопки «Сбросить фильтры» у поиска).
  const activeFilters =
    (roles.length > 0 ? 1 : 0) +
    (cities.length > 0 ? 1 : 0) +
    (statuses.length > 0 ? 1 : 0);
  const clearFilters = () => {
    setRoles([]);
    setCities([]);
    setStatuses([]);
  };

  return (
    <>
      {unblock && (
        <UnblockAccountDialog
          open
          onOpenChange={(open) => !open && setUnblock(null)}
          variant={unblock.variant}
          reason={unblock.reason}
          managerName={unblockManager}
          onConfirm={async () => {
            await handleUnblock(unblock.variant, unblock.id, unblock.role);
          }}
        />
      )}

      {/* Профиль: салон или мастер по роли строки; данные из useProviderProfile. */}
      <SalonProfileDialog
        key={`salon-${profileTarget?.id}`}
        open={profileTarget?.variant === "salon" && profileQuery.isSuccess}
        onOpenChange={(open) => !open && closeProfile()}
        profile={profileQuery.data as AdminSalonProfile | undefined}
        onSave={saveSalon}
      />
      <MasterProfileDialog
        key={`master-${profileTarget?.id}`}
        open={profileTarget?.variant === "master" && profileQuery.isSuccess}
        onOpenChange={(open) => !open && closeProfile()}
        profile={profileQuery.data as AdminMasterProfile | undefined}
        onSave={saveMaster}
      />

      <DateFilter value={range} onChange={setRange} />

      {/* KPI-карточки */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Всего мастеров"
          value={formatCount(stats?.total_masters)}
          delta={totalMastersDelta.text}
          deltaUp={totalMastersDelta.up}
          icon={Users}
          tone="brand"
        />
        <StatCard
          title="Всего салонов"
          value={formatCount(stats?.total_salons)}
          delta={totalSalonsDelta.text}
          deltaUp={totalSalonsDelta.up}
          icon={Home}
          tone="brand"
        />
        <StatCard
          title="Активные (мастера/салоны)"
          value={formatPair(stats?.active_masters, stats?.active_salons)}
          icon={Check}
          tone="success"
        />
        <StatCard
          title="Заблокированные (мастера/салоны)"
          value={formatPair(stats?.blocked_masters, stats?.blocked_salons)}
          icon={Ban}
          tone="danger"
        />
      </div>

      {/* Таблица аккаунтов */}
      <Card>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по имени, названию"
            className="max-w-[547px]"
          />
          <ClearFiltersButton count={activeFilters} onClick={clearFilters} />
        </div>

        <div className="mt-9">
          {isLoading ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Загрузка мастеров и салонов…
            </p>
          ) : isError && !data ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-base text-danger">
                Не удалось загрузить мастеров и салоны.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="rounded-lg border border-grey-4 px-3 py-1 text-sm text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
              >
                Повторить
              </button>
            </div>
          ) : (
            <>
              <div
                className={
                  isFetching ? "opacity-60 transition-opacity" : undefined
                }
              >
                <DataTable data={rows} columns={columns} gridClassName={GRID} />
              </div>

              <InfiniteScrollSentinel
                hasNextPage={hasNextPage}
                isFetching={isFetching}
                isError={isError}
                onLoadMore={() => isError && !hasNextPage ? refetch() : fetchNextPage()}
              />
            </>
          )}
        </div>
      </Card>
    </>
  );
};

export default MastersPage;
