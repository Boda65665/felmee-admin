import { useEffect, useState } from "react";
import { useBusinessOperations, type OperationSort, type OperationStatus, type OverviewPeriod } from "@/lib/api/business-overview";
import { overviewNumber } from "@/lib/business-overview";
import { OverviewLoading } from "./overview-metrics";

import { Card } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import { StatusPill } from "@/components/status-pill";
import { CheckboxFilterMenu, ClearFiltersButton, SortMenu } from "@/components/table-controls";
import { cn } from "@/lib/utils";

const transactionDate = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk", year: "2-digit", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
import type { ColumnDef, ColumnFiltersState, SortingState } from "@tanstack/react-table";

function formatOperationTime(value: string) {
  const parts = Object.fromEntries(transactionDate.formatToParts(new Date(value)).map(({ type, value }) => [type, value]));
  return `${parts.day}.${parts.month}.${parts.year} в ${parts.hour}:${parts.minute}`;
}

export type TransactionStatus = OperationStatus;

/** Метаданные статуса: подпись, цвет пилюли и приносит ли комиссию. */
const STATUS: Record<
  TransactionStatus,
  { label: string; cls: string }
> = {
  COMPLETED: { label: "Выполнена", cls: "bg-success-bg text-success-fg" },
  REFUND: { label: "Возврат", cls: "bg-success-bg text-success-fg" },
  FROZEN: { label: "Деньги заморожены", cls: "bg-info/10 text-info" },
  CANCELED: { label: "Отмена", cls: "bg-danger-bg text-danger" },
};

const STATUS_OPTIONS = (Object.keys(STATUS) as TransactionStatus[]).map(
  (value) => ({ value, label: STATUS[value].label }),
);

export type Transaction = {
  operation: string;
  service: string;
  user: string;
  amount: string;
  time: string;
  status: TransactionStatus;
  fee: number | null;
};

/** Пилюля статуса операции с цветной точкой. */
function StatusBadge({ status }: { status: TransactionStatus }) {
  const { label, cls } = STATUS[status];
  return <StatusPill label={label} cls={cls} />;
}

const COLUMNS: ColumnDef<Transaction>[] = [
  {
    accessorKey: "operation",
    header: () => <span>операция</span>,
    cell: ({ row }) => <span>{row.original.operation}</span>,
  },
  {
    accessorKey: "service",
    meta: { mobileLabel: "Услуга" },
    header: () => <span>услуга</span>,
    cell: ({ row }) => (
      <span>{row.original.service}</span>
    ),
  },
  {
    accessorKey: "user",
    meta: { mobileLabel: "Пользователь" },
    header: () => <span>пользователь</span>,
    cell: ({ row }) => (
      <span>{row.original.user}</span>
    ),
  },
  {
    accessorKey: "amount",
    meta: { mobileLabel: "Сумма", mobileFilter: true },
    header: ({ column }) => (
      <SortMenu
        label="сумма"
        value={column.getIsSorted() || null}
        onChange={(dir) => column.toggleSorting(dir === "desc")}
      />
    ),
    cell: ({ row }) => <span>{row.original.amount}</span>,
  },
  {
    accessorKey: "time",
    meta: { mobileLabel: "Время операции", mobileFilter: true },
    header: ({ column }) => (
      <SortMenu
        label="время операции"
        value={column.getIsSorted() || null}
        onChange={(dir) => column.toggleSorting(dir === "desc")}
      />
    ),
    cell: ({ row }) => <span>{row.original.time}</span>,
  },
  {
    accessorKey: "status",
    meta: { mobileLabel: "Статус", mobileFilter: true },
    header: ({ column }) => (
      <CheckboxFilterMenu
        label="статус"
        options={STATUS_OPTIONS}
        selected={(column.getFilterValue() as TransactionStatus[]) ?? []}
        onApply={(values) =>
          column.setFilterValue(values.length ? values : undefined)
        }
        allOption
      />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "fee",
    header: () => <span>комиссия платформы</span>,
    meta: { mobileLabel: "Комиссия платформы", headerClassName: "text-right", cellClassName: "text-right max-md:text-left" },
    cell: ({ row }) => {
      const fee = row.original.fee;
      const positive = fee !== null && fee > 0;
      return (
        <span className={cn("font-bold", positive ? "text-success-fg" : "text-ink")}>
          {fee === null ? "—" : `${positive ? "+" : ""}${overviewNumber.format(fee)} ₽`}
        </span>
      );
    },
  },
];

const GRID =
  "grid grid-cols-[1.5fr_1fr_1.6fr_0.9fr_1.3fr_1.5fr_1fr] items-center gap-4";

/** Таблица операций: поиск, сортируемые колонки и статусы. */
export function TransactionsTable({ period }: { period: OverviewPeriod }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const selected = columnFilters.find(({ id }) => id === "status")?.value as OperationStatus[] | undefined;
  const sorted = sorting[0];
  const sort: OperationSort = sorted
    ? `${sorted.id === "amount" ? "amount_rub" : "occurred_at"}:${sorted.desc ? "desc" : "asc"}`
    : "occurred_at:desc";
  const operations = useBusinessOperations({ ...period, query: debounced || undefined, status: selected, sort }, true);
  const rows: Transaction[] = (operations.data ?? []).map((item) => ({
    operation: { PAYMENT: "Оплата услуги", REFUND: "Возврат" }[item.type],
    service: item.service_name ?? "—",
    user: item.client_name ?? "—",
    amount: `${overviewNumber.format(item.amount_rub)} ₽`,
    time: formatOperationTime(item.occurred_at),
    status: item.status,
    fee: item.commission_rub,
  }));
  const activeFilters = (query.trim() ? 1 : 0) + columnFilters.length + sorting.length;

  const clearFilters = () => {
    setQuery("");
    setDebounced("");
    setColumnFilters([]);
    setSorting([]);
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={query} onChange={(value) => setQuery(value.slice(0, 150))} placeholder="Поиск по пользователю, операции, времени" className="max-w-[547px]" />
        <ClearFiltersButton count={activeFilters} onClick={clearFilters} />
      </div>

      <div className="mt-9">
        {operations.data ? <DataTable
          data={rows}
          columns={COLUMNS}
          gridClassName={GRID}
          manualFiltering
          manualSorting
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          sorting={sorting}
          onSortingChange={setSorting}
        /> : <OverviewLoading error={operations.isError} onRetry={() => void operations.refetch()} />}
        {operations.isFetchNextPageError && <p role="alert" className="mt-3 text-danger">Не удалось загрузить следующие операции</p>}
        {operations.hasNextPage && (
          <button type="button" className="mt-5 rounded-xl border border-grey-4 px-4 py-2 text-ink"
            disabled={operations.isFetchingNextPage} onClick={() => void operations.fetchNextPage()}>
            {operations.isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
          </button>
        )}
      </div>
    </Card>
  );
}
