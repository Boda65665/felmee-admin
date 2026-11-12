import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteClients } from "@/lib/api/infinite-lists";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, UserPlus, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import {
  AccountCell,
  AccountStatusBadge,
  Card,
  CheckboxFilterMenu,
  CityFilterHeader,
  ClearFiltersButton,
  DataTable,
  DateFilter,
  RowActions,
  SearchInput,
  SortMenu,
  StatCard,
  UnblockUserDialog,
  UserEditDialog,
  type AccountStatus,
  type DateRange,
  type SortDir,
  type UserEditValues,
} from "@/components";
import { useToast } from "@/components/ui";
import { usePersistentState } from "@/lib/use-persistent-state";
import {

  useClientsStats,
  useBlockClient,
  useUnblockClient,
  useClient,
  useUpdateClient,
  type AdminClientListItem,
  type AdminClientStatus,
  type AdminClientUpdateRequest,
} from "@/lib/api";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 10;

type SortField = "registered_at" | "records_count" | "spent_amount";
type Sort = { field: SortField; dir: SortDir };

type UserRow = {
  id: number;
  name: string;
  phone: string;
  city: string;
  registeredAt: string;
  bookings: number;
  spent: string;
  status: AccountStatus;
  blockReason: string | null;
  avatar: number | null;
};

/** Статус клиента: API ↔ UI. */
const STATUS_TO_UI: Record<AdminClientStatus, AccountStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BLOCKED: "blocked",
};
const STATUS_TO_API: Record<AccountStatus, AdminClientStatus> = {
  active: "ACTIVE",
  inactive: "INACTIVE",
  blocked: "BLOCKED",
};

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Активен" },
  { value: "inactive", label: "Неактивен" },
  { value: "blocked", label: "Заблокирован" },
];

const numberFmt = new Intl.NumberFormat("ru-RU");

const formatCount = (value: number | undefined) =>
  value == null ? "—" : numberFmt.format(value);

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

/** Клиент из API → строка таблицы. */
const toRow = (item: AdminClientListItem): UserRow => ({
  id: item.id,
  // full_name по спеку required, но у клиента без имени приходит пустым/null.
  name: item.full_name || item.phone || "Без имени",
  phone: item.phone ?? "—",
  city: item.city ?? "—",
  registeredAt: format(parseISO(item.registered_at), "dd.MM.yyyy"),
  bookings: item.records_count,
  spent: `₽ ${numberFmt.format(item.spent_amount)}`,
  status: STATUS_TO_UI[item.status],
  blockReason: item.block_reason ?? null,
  avatar: item.avatar ?? null,
});

/** Сетка колонок таблицы — общая для шапки и строк. */
const GRID =
  "grid grid-cols-[2fr_1fr_1fr_0.7fr_1fr_1.3fr_1.8fr] items-center gap-4";

/* --------------------------------------------------------------------- экран */

const UsersPage = () => {
  const [range, setRange] = usePersistentState<DateRange | undefined>(
    "users.range",
    defaultRange,
  );
  const [query, setQuery] = usePersistentState("users.query", "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [cities, setCities] = usePersistentState<string[]>("users.cities", []);
  const [statuses, setStatuses] = usePersistentState<AccountStatus[]>(
    "users.statuses",
    [],
  );
  const [sort, setSort] = usePersistentState<Sort | null>("users.sort", null);

  const toast = useToast();

  /** Текст ошибки из ApiError, иначе — общий фолбэк. */
  const errText = (err: unknown) =>
    err instanceof Error ? err : "Попробуйте ещё раз.";

  // Правка клиента открывается кликом по имени; деталь тянем для префилла.
  const [editId, setEditId] = useState<number | null>(null);
  const editQuery = useClient(editId);
  const editing = editQuery.data;
  const updateMutation = useUpdateClient();

  // Деталь для формы правки не загрузилась — форма не откроется, сообщаем тостом.
  useEffect(() => {
    if (editId === null || !editQuery.isError) return;
    toast.error("Не удалось загрузить профиль", errText(editQuery.error));
    setEditId(null);
  }, [editId, editQuery.isError, editQuery.error]);

  // Разблокировка: открываем сразу с причиной из строки, менеджера тянем деталью.
  const [unblock, setUnblock] = useState<{ id: number; reason: string | null } | null>(null);
  const unblockDetail = useClient(unblock?.id ?? null);
  const unblockManager = unblockDetail.data?.blocked_by?.display_name ?? null;

  // Дебаунс строки поиска.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const from = range?.from ? toIsoDate(range.from) : null;
  const to = range?.to ? toIsoDate(range.to) : null;


  const { data: stats } = useClientsStats({ from: from ?? "", to: to ?? "" });

  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteClients({
    from: from ?? "",
    to: to ?? "",
    query: debouncedQuery || undefined,
    city: cities.length ? cities : undefined,
    status: statuses.length ? statuses.map((s) => STATUS_TO_API[s]) : undefined,
    sort: sort ? [`${sort.field}:${sort.dir}`] : undefined,

    limit: PAGE_SIZE,
  });

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  // mutate/mutateAsync стабильны между рендерами — можно держать в deps колонок.
  const { mutateAsync: blockUser } = useBlockClient();
  const { mutateAsync: unblockUser } = useUnblockClient();

  // Блокировка/разблокировка с тостами. Ошибку пробрасываем, чтобы диалог
  // показал её инлайном и не закрылся.
  const handleBlock = async (id: number, reason: string) => {
    try {
      await blockUser({ id, reason });
      toast.success("Пользователь заблокирован");
    } catch (err) {
      toast.error("Не удалось заблокировать", errText(err));
      throw err;
    }
  };

  const handleUnblock = async (id: number) => {
    try {
      await unblockUser(id);
      toast.success("Пользователь разблокирован");
    } catch (err) {
      toast.error("Не удалось разблокировать", errText(err));
      throw err;
    }
  };

  const saveClient = async (values: UserEditValues) => {
    if (editId == null || !editing) return;

    // Поле формы → поле API (только строковые) → текущее значение из детали.
    type TextKey = "first_name" | "last_name" | "city" | "phone" | "email";
    const fields: [TextKey, string, string | null][] = [
      ["first_name", values.firstName, editing.first_name],
      ["last_name", values.lastName, editing.last_name],
      ["city", values.city, editing.city],
      ["phone", values.phone, editing.phone],
      ["email", values.email, editing.email],
    ];

    // Шлём только изменившиеся непустые поля (у части в API minLength: 1).
    const body: AdminClientUpdateRequest = {};
    for (const [key, next, current] of fields) {
      if (next && next !== (current ?? "")) body[key] = next;
    }

    // Адрес меняем только вместе с координатами (PATCH требует geolocation при
    // передаче address). Координаты есть только если адрес выбран из подсказок.
    const addressChanged =
      values.address.trim() !== (editing.address ?? "").trim();
    if (addressChanged && values.address && values.geolocation) {
      body.address = values.address;
      body.geolocation = values.geolocation;
    }

    // Нечего сохранять — просто закрываем.
    if (Object.keys(body).length === 0) return;
    try {
      await updateMutation.mutateAsync({ id: editId, body });
      toast.success("Изменения сохранены");
    } catch (err) {
      toast.error("Не удалось сохранить изменения", errText(err));
      throw err;
    }
  };

  const totalDelta = formatDelta(stats?.total_users_change_percent);
  const newDelta = formatDelta(stats?.new_users_change_percent);
  const activeDelta = formatDelta(stats?.active_users_change_percent);
  const blockedDelta = formatDelta(stats?.blocked_users_change_percent);

  // Стабильный заголовок города: читает выбор из ref, применяет сразу. Так его
  // идентичность не меняется при смене городов → меню не перемонтируется и не
  // закрывается на каждый выбор (иначе мультивыбор ломается).
  const citySelRef = useRef(cities);
  citySelRef.current = cities;
  const cityHeader = useCallback(
    () => <CityFilterHeader selected={citySelRef.current} onApply={setCities} />,
    [],
  );

  // Тот же приём для статуса: стабильный заголовок + мгновенное применение.
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

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { mobileLabel: "Аккаунт" },
        header: () => <span>пользователь</span>,
        cell: ({ row }) => (
          <AccountCell
            name={row.original.name}
            subtitle={row.original.phone}
            avatarId={row.original.avatar}
            onNameClick={() => setEditId(row.original.id)}
          />
        ),
      },
      {
        accessorKey: "city",
        meta: { mobileLabel: "Город", mobileFilter: true },
        header: cityHeader,
        cell: ({ row }) => <span>{row.original.city}</span>,
      },
      {
        accessorKey: "registeredAt",
        meta: { mobileLabel: "Дата регистрации", mobileFilter: true },
        header: () => (
          <SortMenu
            label="регистрация"
            value={sort?.field === "registered_at" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "registered_at", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.registeredAt}</span>,
      },
      {
        accessorKey: "bookings",
        meta: { mobileLabel: "Записи", mobileFilter: true },
        header: () => (
          <SortMenu
            label="записей"
            value={sort?.field === "records_count" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "records_count", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.bookings}</span>,
      },
      {
        accessorKey: "spent",
        meta: { mobileLabel: "Потрачено", mobileFilter: true },
        header: () => (
          <SortMenu
            label="потрачено"
            value={sort?.field === "spent_amount" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "spent_amount", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.spent}</span>,
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
        meta: { mobileLabel: "Действия", headerClassName: "text-right", cellClassName: "flex justify-end" },
        cell: ({ row }) => (
          <RowActions
            blocked={row.original.status === "blocked"}
            showView={false}
            showEdit={false}
            showChat
            chatClientId={row.original.id}
            onBlock={(reason) => handleBlock(row.original.id, reason)}
            onUnblock={() =>
              setUnblock({
                id: row.original.id,
                reason: row.original.blockReason,
              })
            }
          />
        ),
      },
    ],
    [cityHeader, statusHeader, sort],
  );


  // Число активных фильтров (для кнопки «Сбросить фильтры» у поиска).
  const activeFilters =
    (cities.length > 0 ? 1 : 0) + (statuses.length > 0 ? 1 : 0);
  const clearFilters = () => {
    setCities([]);
    setStatuses([]);
  };

  return (
    <>
      <UserEditDialog
        key={editId}
        open={editing != null}
        onOpenChange={(open) => !open && setEditId(null)}
        initial={
          editing
            ? {
                firstName: editing.first_name ?? "",
                lastName: editing.last_name ?? "",
                city: editing.city ?? "",
                address: editing.address ?? "",
                phone: editing.phone ?? "",
                email: editing.email ?? "",
              }
            : undefined
        }
        avatarId={editing?.avatar}
        blocked={editing?.status === "BLOCKED"}
        blockReason={editing?.block_reason}
        onSave={saveClient}
      />

      <UnblockUserDialog
        open={unblock != null}
        onOpenChange={(open) => !open && setUnblock(null)}
        reason={unblock?.reason}
        managerName={unblockManager}
        onConfirm={async () => {
          if (unblock) await handleUnblock(unblock.id);
        }}
      />

      <DateFilter value={range} onChange={setRange} />

      {/* KPI-карточки */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Всего пользователей"
          value={formatCount(stats?.total_users)}
          delta={totalDelta.text}
          deltaUp={totalDelta.up}
          icon={Users}
          tone="brand"
        />
        <StatCard
          title="Новые"
          value={formatCount(stats?.new_users)}
          delta={newDelta.text}
          deltaUp={newDelta.up}
          icon={UserPlus}
          tone="brand"
        />
        <StatCard
          title="Активные"
          value={formatCount(stats?.active_users)}
          delta={activeDelta.text}
          deltaUp={activeDelta.up}
          icon={Check}
          tone="success"
        />
        <StatCard
          title="Заблокированные"
          value={formatCount(stats?.blocked_users)}
          delta={blockedDelta.text}
          deltaUp={blockedDelta.up}
          icon={Ban}
          tone="danger"
        />
      </div>

      {/* Таблица пользователей */}
      <Card>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по имени, телефону"
            className="max-w-[547px]"
          />
          <ClearFiltersButton count={activeFilters} onClick={clearFilters} />
        </div>

        <div className="mt-9">
          {isLoading ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Загрузка пользователей…
            </p>
          ) : isError && !data ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="text-sm text-ink-muted">Данные не загружены.</span>
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
                className={isFetching ? "opacity-60 transition-opacity" : undefined}
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

export default UsersPage;
