import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteRecords } from "@/lib/api/infinite-lists";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ru } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import {
  Ban,
  Clock,
  Check,
  Calendar,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { useToast } from "@/components/ui";
import { usePersistentState } from "@/lib/use-persistent-state";
import {
  Card,
  StatCard,
  SortMenu,
  DataTable,
  DateFilter,
  SearchInput,
  CityFilterHeader,
  ClearFiltersButton,
  UserInfoDialog,
  CheckboxFilterMenu,
  AppointmentViewDialog,
  AppointmentStatusBadge,
  AppointmentCancelDialog,
  type SortDir,
  type DateRange,
  type AppointmentView,
  type AppointmentStatus,
  type AppointmentViewState,
} from "@/components";
import {
  ApiError,
  useClient,
  useRecord,

  useRecordsStats,
  useCancelRecord,
  type RecordStatus,
  type AdminRecordListItem,
  type AdminRecordDetailsData,
} from "@/lib/api";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 10;

type SortField = "start_at" | "service_price";
type Sort = { field: SortField; dir: SortDir };

type Row = {
  id: number;
  /**
   * id провайдера записи (для профиля по клику на «салон, услуга»). Это id
   * салона при `providerType === "SALON"`; у частного мастера — id мастера.
   */
  providerId: number;
  /** Тип провайдера: SALON — запись в салоне, MASTER — частный мастер. */
  providerType: AdminRecordListItem["provider_type"];
  salon: string;
  service: string;
  /** id клиента — для карточки клиента по клику на «клиент». */
  clientId: number;
  client: string;
  clientPhone: string;
  city: string;
  paidAt: string;
  startAt: string;
  amount: string;
  status: RecordStatus;
};

/** Статус записи API → визуальный бейдж (4 статуса группируются в 3). */
const STATUS_TO_BADGE: Record<RecordStatus, AppointmentStatus> = {
  WAITING_ACTION: "pending",
  BOOKED: "pending",
  COMPLETED: "completed",
  CANCELED: "cancelled",
};

/** Статус записи API → состояние шапки модалки просмотра. */
const STATUS_TO_VIEW: Record<RecordStatus, AppointmentViewState> = {
  WAITING_ACTION: "waiting",
  BOOKED: "active",
  COMPLETED: "completed",
  CANCELED: "cancelled",
};

const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: "WAITING_ACTION", label: "Ожидает действия" },
  { value: "BOOKED", label: "Забронирована" },
  { value: "COMPLETED", label: "Завершена" },
  { value: "CANCELED", label: "Отменена" },
];

const numberFmt = new Intl.NumberFormat("ru-RU");

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Дефолтный период — последние 30 дней. */
const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
};

/** Первая буква — заглавная (date-fns отдаёт день недели/месяц строчными). */
const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** ISO date-time → «12.04.26 в 14:12»; пусто → «—». */
const formatDateTime = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd.MM.yy 'в' HH:mm") : "—";

/** Сумма (₽); null → «—». Единицы уточняются у бэкендера (₽ или копейки). */
const formatMoney = (value: number | null | undefined) =>
  value == null ? "—" : `₽ ${numberFmt.format(value)}`;

/** Сумма в стиле модалки заказа («1 500 ₽»); null → «—». */
const formatRub = (value: number | null | undefined) =>
  value == null ? "—" : `${numberFmt.format(value)} ₽`;

/** Доля в процентах для KPI (напр. «69%»). */
const formatPercent = (value: number | null | undefined) =>
  value == null
    ? undefined
    : `${numberFmt.format(Math.round(value * 10) / 10)}%`;

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

const formatCount = (value: number | undefined) =>
  value == null ? "—" : numberFmt.format(value);

/** Запись из API → строка таблицы. */
const toRow = (item: AdminRecordListItem): Row => ({
  id: item.record_id,
  providerId: item.provider_id,
  providerType: item.provider_type,
  salon: item.provider_name || "—",
  service: item.service_name ?? "—",
  clientId: item.client_id,
  client: item.client_name || item.client_phone || "—",
  clientPhone: item.client_phone ?? "—",
  city: item.city ?? "—",
  paidAt: formatDateTime(item.paid_at),
  startAt: formatDateTime(item.start_at),
  amount: formatMoney(item.service_price),
  status: item.status,
});

/** Детали записи из API → данные модалки «Информация по заказу». */
const toView = (d: AdminRecordDetailsData): AppointmentView => {
  const start = parseISO(d.service_period.start_at);
  const end = parseISO(d.service_period.end_at);
  return {
    orderId: String(d.record_id),
    state: STATUS_TO_VIEW[d.status],
    comment: d.comment,
    createdAt: d.created_at
      ? `от ${format(parseISO(d.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}`
      : "",
    date: capitalize(format(start, "EEEE, d MMMM yyyy", { locale: ru })),
    timeRange: `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`,
    duration: `${d.service_period.duration_minutes} мин.`,
    master: {
      name: d.master.name ?? "—",
      salon: d.salon?.name ?? "Частный мастер",
      address: d.salon?.address ?? "",
      phone: d.master.phone ?? "",
      photoId: d.master.photo_id,
    },
    client: { name: d.client.name ?? "—", phone: d.client.phone ?? "" },
    services: d.services.map((s) => ({
      name: s.name ?? "—",
      duration: `${s.duration_minutes} мин.`,
      price: formatRub(s.price),
    })),
    total: formatRub(d.total_price),
  };
};

/** Сетка колонок таблицы — общая для шапки и строк. */
const GRID =
  "grid grid-cols-[0.7fr_1.6fr_1.5fr_0.9fr_1.3fr_1.3fr_1fr_1.5fr] items-center gap-4";

/** Какая модалка сейчас открыта над таблицей записей. */
type ModalKind = "view" | "cancel" | null;

/* --------------------------------------------------------------------- экран */

const AppointmentsPage = () => {
  const [range, setRange] = usePersistentState<DateRange | undefined>(
    "appointments.range",
    defaultRange,
  );
  // Фильтр по дате оплаты — по умолчанию пуст (не фильтруем).
  const [paidRange, setPaidRange] = usePersistentState<DateRange | undefined>(
    "appointments.paidRange",
    undefined,
  );
  const [query, setQuery] = usePersistentState("appointments.query", "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [cities, setCities] = usePersistentState<string[]>(
    "appointments.cities",
    [],
  );
  const [statuses, setStatuses] = usePersistentState<RecordStatus[]>(
    "appointments.statuses",
    [],
  );
  const [sort, setSort] = usePersistentState<Sort | null>(
    "appointments.sort",
    null,
  );

  // Активная модалка + запись, по которой она открыта. Просмотр заказа тянет
  // детали записи.
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Детали активной записи (для просмотра заказа).
  const detailQuery = useRecord(openModal === "view" ? activeId : null);
  const detail = detailQuery.data;

  // Карточка клиента по клику на «клиент» — данные по client_id.
  const [clientId, setClientId] = useState<number | null>(null);
  const clientQuery = useClient(clientId);

  const cancelMutation = useCancelRecord();
  const toast = useToast();

  // Детали заказа не загрузились — модалка не откроется, сообщаем тостом.
  useEffect(() => {
    if (openModal !== "view" || !detailQuery.isError) return;
    toast.error(
      "Не удалось загрузить заказ",
      detailQuery.error instanceof ApiError
        ? detailQuery.error.message
        : "Попробуйте ещё раз.",
    );
    setOpenModal(null);
  }, [openModal, detailQuery.isError, detailQuery.error, toast]);

  // Карточка клиента не загрузилась — тостом.
  useEffect(() => {
    if (clientId === null || !clientQuery.isError) return;
    toast.error(
      "Не удалось загрузить клиента",
      clientQuery.error instanceof ApiError
        ? clientQuery.error.message
        : "Попробуйте ещё раз.",
    );
    setClientId(null);
  }, [clientId, clientQuery.isError, clientQuery.error, toast]);

  // Дебаунс строки поиска.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const from = range?.from ? toIsoDate(range.from) : null;
  const to = range?.to ? toIsoDate(range.to) : null;
  const paidFrom = paidRange?.from ? toIsoDate(paidRange.from) : null;
  const paidTo = paidRange?.to ? toIsoDate(paidRange.to) : null;


  const { data: stats } = useRecordsStats({ from: from ?? "", to: to ?? "" });

  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteRecords({
    from: from ?? "",
    to: to ?? "",
    query: debouncedQuery || undefined,
    city: cities.length ? cities : undefined,
    status: statuses.length ? statuses : undefined,
    paid_from: paidFrom ?? undefined,
    paid_to: paidTo ?? undefined,
    sort: sort ? [`${sort.field}:${sort.dir}`] : undefined,

    limit: PAGE_SIZE,
  });

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const totalDelta = formatDelta(stats?.total_records_change_percent);

  const cancelRecord = async (reason: string) => {
    if (activeId == null) return;
    try {
      await cancelMutation.mutateAsync({ id: activeId, reason });
      toast.success("Запись отменена", "Клиент получит уведомление об отмене.");
    } catch (err) {
      // Тост + проброс: диалог отмены покажет ошибку инлайном и не закроется.
      toast.error(
        "Не удалось отменить запись",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  // Отмена доступна только для записей в ожидании (не завершённых/отменённых).
  const canCancelDetail =
    detail != null &&
    detail.status !== "COMPLETED" &&
    detail.status !== "CANCELED";

  // Стабильный заголовок города: читает выбор из ref, применяет сразу — чтобы
  // меню не перемонтировалось и не закрывалось на каждый выбор города.
  const citySelRef = useRef(cities);
  citySelRef.current = cities;
  const cityHeader = useCallback(
    () => <CityFilterHeader selected={citySelRef.current} onApply={setCities} />,
    [],
  );

  // Стабильный заголовок статуса + мгновенное применение.
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

  // Стабильный заголовок-фильтр «дата оплаты» (ref — чтобы не пересоздавать
  // columns и не закрывать поповер при выборе диапазона).
  const paidRangeRef = useRef(paidRange);
  paidRangeRef.current = paidRange;
  const paidHeader = useCallback(
    () => (
      <DateFilter
        variant="header"
        label="дата оплаты"
        value={paidRangeRef.current}
        onChange={setPaidRange}
      />
    ),
    [],
  );

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "id",
        meta: { mobileLabel: "№ заказа" },
        header: () => <span>№ заказа</span>,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => {
              setActiveId(row.original.id);
              setOpenModal("view");
            }}
            className="w-fit font-semibold text-brand underline underline-offset-2"
          >
            #{row.original.id}
          </button>
        ),
      },
      {
        accessorKey: "salon",
        meta: { mobileLabel: "Услуга" },
        header: () => <span>услуга</span>,
        cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-ink">
                {row.original.salon}
              </span>
              <span className="text-ink-muted">{row.original.service}</span>
            </div>
        ),
      },
      {
        accessorKey: "client",
        meta: { mobileLabel: "Клиент" },
        header: () => <span>клиент</span>,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setClientId(row.original.clientId)}
            className="w-fit text-left font-semibold text-brand underline underline-offset-2"
          >
            {row.original.client}
          </button>
        ),
      },
      {
        accessorKey: "city",
        meta: { mobileLabel: "Город", mobileFilter: true },
        header: cityHeader,
        cell: ({ row }) => <span>{row.original.city}</span>,
      },
      {
        accessorKey: "paidAt",
        meta: { mobileLabel: "Дата оплаты", mobileFilter: true },
        header: paidHeader,
        cell: ({ row }) => <span>{row.original.paidAt}</span>,
      },
      {
        accessorKey: "startAt",
        meta: { mobileLabel: "Время записи", mobileFilter: true },
        header: () => (
          <SortMenu
            label="время записи"
            value={sort?.field === "start_at" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "start_at", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.startAt}</span>,
      },
      {
        accessorKey: "amount",
        meta: { mobileLabel: "Сумма заказа", mobileFilter: true },
        header: () => (
          <SortMenu
            label="сумма заказа"
            value={sort?.field === "service_price" ? sort.dir : null}
            onChange={(dir) => setSort({ field: "service_price", dir })}
          />
        ),
        cell: ({ row }) => <span>{row.original.amount}</span>,
      },
      {
        accessorKey: "status",
        meta: { mobileLabel: "Статус", mobileFilter: true },
        header: statusHeader,
        cell: ({ row }) => (
          <AppointmentStatusBadge
            status={STATUS_TO_BADGE[row.original.status]}
          />
        ),
      },
    ],
    [cityHeader, statusHeader, paidHeader, sort],
  );


  const closeModal = () => setOpenModal(null);

  // Число активных фильтров (для кнопки «Сбросить фильтры» у поиска).
  const activeFilters =
    (cities.length > 0 ? 1 : 0) +
    (statuses.length > 0 ? 1 : 0) +
    (paidRange?.from ? 1 : 0);
  const clearFilters = () => {
    setCities([]);
    setStatuses([]);
    setPaidRange(undefined);
  };

  return (
    <>
      <AppointmentViewDialog
        open={openModal === "view" && detailQuery.isSuccess}
        onOpenChange={(open) => !open && closeModal()}
        appointment={detail ? toView(detail) : null}
        canCancel={canCancelDetail}
        onRequestCancel={() => setOpenModal("cancel")}
      />

      <AppointmentCancelDialog
        open={openModal === "cancel"}
        onOpenChange={(open) => !open && closeModal()}
        onConfirm={cancelRecord}
      />

      {/* Карточка клиента по клику на «клиент». */}
      <UserInfoDialog
        key={`client-${clientId}`}
        open={clientId !== null && clientQuery.isSuccess}
        onOpenChange={(open) => !open && setClientId(null)}
        client={clientQuery.data}
      />

      <DateFilter value={range} onChange={setRange} />

      {/* KPI-карточки */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Всего записей"
          value={formatCount(stats?.total_records)}
          delta={totalDelta.text}
          deltaUp={totalDelta.up}
          icon={Calendar}
          tone="brand"
        />
        <StatCard
          title="Завершены"
          value={formatCount(stats?.completed_records)}
          delta={formatPercent(stats?.completed_records_percent)}
          icon={Check}
          tone="success"
        />
        <StatCard
          title="Ожидают"
          value={formatCount(stats?.waiting_records)}
          delta={formatPercent(stats?.waiting_records_percent)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          title="Отменены"
          value={formatCount(stats?.canceled_records)}
          delta={formatPercent(stats?.canceled_records_percent)}
          icon={Ban}
          tone="danger"
        />
      </div>

      {/* Таблица записей */}
      <Card>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по № записи, салону, клиенту"
            className="max-w-[547px]"
          />
          <ClearFiltersButton count={activeFilters} onClick={clearFilters} />
        </div>

        <div className="mt-9">
          {isLoading ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Загрузка записей…
            </p>
          ) : isError && !data ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-base text-danger">
                Не удалось загрузить записи.
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

export default AppointmentsPage;
