import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteActionHistory } from "@/lib/api/infinite-lists";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Avatar,
  Card,
  DataTable,
  DateFilter,
  SearchInput,
  type DateRange,
} from "@/components";
import {

  type AdminActionHistoryItem,
} from "@/lib/api";
import { usePersistentState } from "@/lib/use-persistent-state";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 20;

type LogEntry = {
  id: number;
  date: string;
  time: string;
  actor: string;
  event: string;
};

/** Запись журнала из API → строка таблицы. */
const toEntry = (item: AdminActionHistoryItem): LogEntry => {
  const at = parseISO(item.created_at);
  const actor = [item.actor.first_name, item.actor.last_name]
    .filter(Boolean)
    .join(" ");
  return {
    id: item.id,
    date: format(at, "dd.MM.yyyy"),
    time: format(at, "HH:mm"),
    actor,
    event: item.event,
  };
};

/** Дата в формат `YYYY-MM-DD` для query-параметров. */
const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Дефолтный период — последние 30 дней. */
const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
};

const COLUMNS: ColumnDef<LogEntry>[] = [
  {
    accessorKey: "date",
    meta: { mobileLabel: "Дата" },
    header: () => <span>дата и время</span>,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm text-ink">{row.original.date}</span>
        <span className="text-xs text-ink-muted">{row.original.time}</span>
      </div>
    ),
  },
  {
    accessorKey: "actor",
    meta: { mobileLabel: "Кто выполнил" },
    header: () => <span>кто выполнил</span>,
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={row.original.actor} className="size-9 rounded-xl text-sm" />
        <span className="truncate text-sm font-medium leading-tight text-ink">
          {row.original.actor}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "event",
    meta: { mobileLabel: "Событие" },
    header: () => <span>событие</span>,
    cell: ({ row }) => (
      <span className="text-sm text-ink">{row.original.event}</span>
    ),
  },
];

const GRID = "grid grid-cols-[160px_260px_1fr] items-center gap-4";

/* --------------------------------------------------------------------- экран */

const HistoryPage = () => {
  const [range, setRange] = usePersistentState<DateRange | undefined>(
    "history.range",
    defaultRange,
  );
  const [query, setQuery] = usePersistentState("history.query", "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Дебаунс поиска — не бьём по бэкенду на каждый символ.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);


  const from = range?.from ? toIsoDate(range.from) : null;
  const to = range?.to ? toIsoDate(range.to) : null;

  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteActionHistory({
    from: from ?? "",
    to: to ?? "",
    query: debouncedQuery || undefined,

    limit: PAGE_SIZE,
  });

  const entries = useMemo(
    () => (data?.items ?? []).map(toEntry),
    [data],
  );


  return (
    <>
      <DateFilter value={range} onChange={setRange} />

      <Card>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Поиск по событию или сотруднику"
        />

        <div className="mt-9">
          {isLoading ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Загрузка истории…
            </p>
          ) : isError && !data ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-base text-danger">
                Не удалось загрузить историю действий.
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
                className={isFetching ? "opacity-60 transition-opacity" : undefined}
              >
                <DataTable
                  data={entries}
                  columns={COLUMNS}
                  gridClassName={GRID}
                />
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

export default HistoryPage;
