import { useState } from "react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";

import { Card } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import { StatusPill } from "@/components/status-pill";
import { CheckboxFilterMenu, SortMenu } from "@/components/table-controls";
import { includesSelected, parseMoney } from "@/lib/table";
import { cn } from "@/lib/utils";

export type TransactionStatus = "done" | "refund" | "frozen" | "cancelled";

/** Метаданные статуса: подпись, цвет пилюли и приносит ли комиссию. */
const STATUS: Record<
  TransactionStatus,
  { label: string; cls: string; positive: boolean }
> = {
  done: { label: "Выполнена", cls: "bg-success-bg text-success-fg", positive: true },
  refund: { label: "Возврат", cls: "bg-success-bg text-success-fg", positive: true },
  frozen: { label: "Деньги заморожены", cls: "bg-info/10 text-info", positive: false },
  cancelled: { label: "Отмена", cls: "bg-danger-bg text-danger", positive: false },
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
  /** Комиссия платформы; 0 — операция без комиссии. */
  fee: number;
};

/** «12.04.26 в 14:32» → timestamp, для сортировки времени операции. */
const parseTxTime = (value: string) => {
  const [date, , time] = value.split(" ");
  const [d, m, y] = date.split(".").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(2000 + y, m - 1, d, hh, mm).getTime();
};

/** Глобальный поиск: по операции, услуге, пользователю и времени. */
const searchTx: FilterFn<Transaction> = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase();
  if (!query) return true;
  const { operation, service, user, time } = row.original;
  return `${operation} ${service} ${user} ${time}`.toLowerCase().includes(query);
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
      <a href="#" className="w-fit text-brand underline underline-offset-2">
        {row.original.service}
      </a>
    ),
  },
  {
    accessorKey: "user",
    meta: { mobileLabel: "Пользователь" },
    header: () => <span>пользователь</span>,
    cell: ({ row }) => (
      <a href="#" className="w-fit text-brand underline underline-offset-2">
        {row.original.user}
      </a>
    ),
  },
  {
    accessorKey: "amount",
    meta: { mobileLabel: "Сумма", mobileFilter: true },
    sortingFn: (a, b) => parseMoney(a.original.amount) - parseMoney(b.original.amount),
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
    sortingFn: (a, b) => parseTxTime(a.original.time) - parseTxTime(b.original.time),
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
    filterFn: includesSelected,
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
      const positive = STATUS[row.original.status].positive && row.original.fee > 0;
      return (
        <span className={cn("font-bold", positive ? "text-success-fg" : "text-ink")}>
          {positive ? `+ ${row.original.fee} ₽` : "0 ₽"}
        </span>
      );
    },
  },
];

const GRID =
  "grid grid-cols-[1.5fr_1fr_1.6fr_0.9fr_1.3fr_1.5fr_1fr] items-center gap-4";

/** Таблица операций: поиск, сортируемые колонки и статусы. */
export function TransactionsTable({ rows }: { rows: Transaction[] }) {
  const [query, setQuery] = useState("");

  return (
    <Card>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Поиск по пользователю, операции, времени"
        className="max-w-[547px]"
      />

      <div className="mt-9">
        <DataTable
          data={rows}
          columns={COLUMNS}
          gridClassName={GRID}
          globalFilter={query}
          globalFilterFn={searchTx}
        />
      </div>
    </Card>
  );
}
