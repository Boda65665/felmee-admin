import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type RowData,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

// Классы для выравнивания ячеек шапки/тела задаются через meta колонки.
// Сигнатура дженериков обязана совпадать с оригинальной ColumnMeta (не используются).
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
    mobileLabel?: string;
    mobileFilter?: boolean;
    mobileSpan?: "full";
    wrap?: boolean;
  }
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Классы CSS-grid для строки (общие для шапки и тела): grid-cols + gap. */
  gridClassName: string;
  /** Строка глобального поиска (управляется страницей). */
  globalFilter?: string;
  /** Как матчить строку под глобальный поиск (по умолчанию — по всем полям). */
  globalFilterFn?: FilterFn<T>;
  /** Включает пагинацию с заданным размером страницы. */
  pageSize?: number;
  /** Доп. классы строки тела (переопределяют дефолтные отступы/размер текста). */
  rowClassName?: string;
  headerRowClassName?: string;
}

/**
 * Переиспользуемая таблица на @tanstack/react-table (headless): логика
 * сортировки/фильтрации/пагинации — из библиотеки, разметка — наш CSS-grid
 * (карточный вид как в макете). Сортировка и фильтры колонок навешиваются в
 * `header` колонки через компоненты из `table-controls`, привязанные к API
 * колонки (`column.toggleSorting`, `column.setFilterValue`).
 */
export function DataTable<T>({
  data,
  columns,
  gridClassName,
  globalFilter,
  globalFilterFn,
  pageSize,
  rowClassName,
  headerRowClassName,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: globalFilter ?? "" },
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
  });

  const rows = table.getRowModel().rows;
  const mobileFilters = table.getFlatHeaders().filter((header) => header.column.columnDef.meta?.mobileFilter);
  const minWidth = columns.length >= 7 ? 960 : columns.length >= 5 ? 800 : 640;

  return (
    <div data-slot="data-table" className="min-w-0">
      {mobileFilters.length > 0 && (
        <div role="group" aria-label="Фильтры и сортировка списка" className="mb-4 flex flex-wrap items-center gap-2 md:hidden">
          {mobileFilters.map((header) => (
            <div key={header.id} className="flex min-h-11 items-center rounded-xl border border-grey-4 px-3 text-xs text-ink-muted">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          ))}
        </div>
      )}
      <div className="table-scroll relative min-w-0 overflow-x-auto overscroll-x-contain">
      <div className="flex min-w-0 flex-col md:min-w-[var(--table-min-width)]" style={{ "--table-min-width": `${minWidth}px` } as CSSProperties}>
      {/* Шапка */}
      {table.getHeaderGroups().map((group) => (
        <div
          key={group.id}
          className={cn(
            gridClassName,
            "hidden border-b border-grey-4 pb-3 text-xs font-medium uppercase tracking-tight text-ink-muted md:grid",
            headerRowClassName,
          )}
        >
          {group.headers.map((header) => (
            <div
              key={header.id}
              className={header.column.columnDef.meta?.headerClassName}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          ))}
        </div>
      ))}

      {/* Строки */}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-ink-muted">
          Ничего не найдено
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            data-slot="data-table-row"
            className={cn(
              gridClassName,
              "border-b border-grey-4 py-4 text-base tracking-tight text-ink last:border-b-0 max-md:mb-3 max-md:grid-cols-2 max-md:items-start max-md:gap-x-4 max-md:gap-y-3 max-md:rounded-2xl max-md:border max-md:p-4 max-md:text-sm max-md:last:mb-0 max-md:last:border-b",
              rowClassName,
            )}
          >
            {row.getVisibleCells().map((cell, index) => (
              <div
                key={cell.id}
                data-slot="data-table-cell"
                title={typeof cell.getValue() === "string" || typeof cell.getValue() === "number" ? String(cell.getValue()) : undefined}
                className={cn(
                  "min-w-0 break-words",
                  cell.column.columnDef.meta?.cellClassName,
                  (index === 0 || cell.column.id === "actions" || cell.column.columnDef.meta?.mobileSpan === "full") && "max-md:col-span-2",
                  index === 0 && "max-md:border-b max-md:border-grey-4 max-md:pb-3",
                  cell.column.id === "actions" && "max-md:border-t max-md:border-grey-4 max-md:pt-3",
                )}
              >
                {index > 0 && cell.column.id !== "actions" && cell.column.columnDef.meta?.mobileLabel && (
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted md:hidden">
                    {cell.column.columnDef.meta.mobileLabel}
                  </span>
                )}
                {cell.column.id === "actions" ? (
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                ) : (
                  <div className="table-cell-value" data-wrap={cell.column.columnDef.meta?.wrap || undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Пагинация */}
      {pageSize && table.getPageCount() > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            aria-label="Предыдущая страница"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex size-9 items-center justify-center rounded-lg border border-grey-4 text-ink transition-colors hover:bg-grey-5 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium tracking-tight text-ink-muted">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            type="button"
            aria-label="Следующая страница"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex size-9 items-center justify-center rounded-lg border border-grey-4 text-ink transition-colors hover:bg-grey-5 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
