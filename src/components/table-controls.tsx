import { ArrowUpDown, Check, Search, SlidersHorizontal, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { citySuggestionContext, useCitySuggestions, type CitySuggestion } from "@/lib/api/suggestions";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

/* ------------------------------------------------------------------- атомы */

/** Квадратный чекбокс: залит брендом с галочкой либо пустой с рамкой. */
function CheckBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
        checked ? "border-brand bg-brand text-white" : "border-grey-4 bg-white",
        className,
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

/** Радио-кнопка: брендовое кольцо с точкой либо пустое с рамкой. */
function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
        checked ? "border-brand" : "border-grey-4",
      )}
    >
      {checked && <span className="size-2 rounded-full bg-brand" />}
    </span>
  );
}

/** Строка-опция меню (чекбокс/радио + подпись), подсвечивается при выборе. */
function OptionRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-ink transition-colors",
        active ? "bg-grey-5 font-medium" : "hover:bg-grey-5/60",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Кнопка-заголовок колонки: подпись + иконка. Когда фильтр активен — подпись
 * и иконка брендовые; для мультивыбора вместо иконки показывается бейдж с числом
 * выбранных, чтобы активность фильтра была явно видна.
 */
function ColumnTrigger({
  label,
  icon: Icon,
  active,
  count,
  ariaLabel,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  /** Число выбранных значений — показывается бейджем (для мультивыбора). */
  count?: number;
  ariaLabel?: string;
}) {
  return (
    <PopoverTrigger
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1.5 text-left uppercase outline-none transition-colors",
        active && "font-semibold text-brand",
      )}
    >
      {label}
      {count && count > 0 ? (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold normal-case leading-none text-white">
          {count}
        </span>
      ) : (
        <Icon className={cn("size-4", active && "text-brand")} />
      )}
    </PopoverTrigger>
  );
}

/* ------------------------------------------------------------------- меню */

/** Сортировка колонки (по убыванию / по возрастанию) — применяется сразу. */
export function SortMenu({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SortDir | null;
  onChange: (dir: SortDir) => void;
}) {
  const [open, setOpen] = useState(false);

  function pick(dir: SortDir) {
    onChange(dir);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ColumnTrigger label={label} icon={ArrowUpDown} active={value !== null} />
      <PopoverContent className="flex w-[220px] flex-col gap-0.5">
        <OptionRow active={value === "desc"} onClick={() => pick("desc")}>
          <Radio checked={value === "desc"} />
          По убыванию
        </OptionRow>
        <OptionRow active={value === "asc"} onClick={() => pick("asc")}>
          <Radio checked={value === "asc"} />
          По возрастанию
        </OptionRow>
      </PopoverContent>
    </Popover>
  );
}

/** Одиночный фильтр колонки с пунктом сброса. */
export function SingleFilterMenu<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (value: T | "") => void;
}) {
  const [open, setOpen] = useState(false);

  function pick(next: T | "") {
    setOpen(false);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ColumnTrigger label={label} icon={SlidersHorizontal} active={value !== ""} count={value ? 1 : undefined} />
      <PopoverContent className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-72 flex-col gap-0.5">
        {[{ value: "" as const, label: "Все" }, ...options].map((option) => (
          <OptionRow key={option.value} active={value === option.value} onClick={() => pick(option.value)}>
            <Radio checked={value === option.value} />
            {option.label}
          </OptionRow>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Фильтр-мультивыбор колонки (чекбоксы, применяется сразу по клику). */
export function CheckboxFilterMenu<T extends string>({
  label,
  options,
  selected,
  onApply,
  allOption,
  ariaLabel,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onApply: (values: T[]) => void;
  /** Показать пункт «Все», отмечающий/снимающий все опции разом. */
  allOption?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const allChecked = selected.length === options.length;

  // Мгновенное применение: клик по опции сразу меняет фильтр (без «Применить»).
  function toggle(value: T) {
    onApply(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ColumnTrigger
        label={label}
        icon={SlidersHorizontal}
        active={selected.length > 0}
        count={selected.length}
        ariaLabel={ariaLabel}
      />
      <PopoverContent className="flex w-[220px] flex-col gap-0.5">
        {allOption && (
          <OptionRow
            active={allChecked}
            onClick={() => onApply(allChecked ? [] : options.map((o) => o.value))}
          >
            <CheckBox checked={allChecked} />
            Все
          </OptionRow>
        )}
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <OptionRow key={option.value} active={checked} onClick={() => toggle(option.value)}>
              <CheckBox checked={checked} />
              {option.label}
            </OptionRow>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** Фильтр по городу: поиск + прокручиваемый список чекбоксов + футер. */
export function CityFilterHeader({
  label = "город",
  selected,
  onApply,
}: {
  label?: string;
  selected: string[];
  onApply: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  // Снимок выбранных на момент открытия — для стабильного порядка (закреплены
  // сверху), чтобы список не «прыгал» при мгновенном выборе.
  const [pinned, setPinned] = useState<string[]>(selected);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const searchReady = query.trim() !== "" && query.trim() === debounced;
  const suggestions = useCitySuggestions(debounced, open && searchReady);
  const { data } = suggestions;

  function handleOpenChange(next: boolean) {
    if (next) {
      setPinned(selected);
      setQuery("");
      setDebounced("");
    }
    setOpen(next);
  }

  // Итоговый список: закреплённые (выбранные при открытии) сверху, затем
  // остальные — оба по алфавиту.
  const displayCities = useMemo(() => {
    const sortRu = (arr: string[]) =>
      [...arr].sort((a, b) => a.localeCompare(b, "ru"));
    const matches = new Map<string, CitySuggestion>();
    if (searchReady) {
      for (const city of data ?? []) {
        if (!matches.has(city.name)) matches.set(city.name, city);
      }
    }
    const top = sortRu(pinned);
    const rest = sortRu([...matches.keys()].filter((name) => !pinned.includes(name)));
    return [...top, ...rest].map((name) => ({
      name,
      context: citySuggestionContext(matches.get(name) ?? {}),
    }));
  }, [data, searchReady, pinned]);

  // Мгновенное применение: клик по городу сразу меняет фильтр (без «Применить»).
  function toggle(city: string) {
    onApply(
      selected.includes(city)
        ? selected.filter((c) => c !== city)
        : [...selected, city],
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <ColumnTrigger
        label={label}
        icon={SlidersHorizontal}
        active={selected.length > 0}
        count={selected.length}
      />
      <PopoverContent className="flex w-[380px] flex-col gap-4 rounded-2xl p-5 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink">Город</span>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
            className="text-ink/40 transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="flex h-11 items-center gap-2 rounded-[10px] border border-grey-4 px-3">
          <Search className="size-4 shrink-0 text-ink/40" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск города"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
          />
        </label>

        <div className="flex max-h-[240px] flex-col overflow-y-auto">
          {displayCities.length === 0 ? (
            !suggestions.isFetching && !suggestions.isError && (
              <p className="py-3.5 text-sm text-ink-muted">Ничего не найдено</p>
            )
          ) : (
            displayCities.map(({ name: city, context }, i) => (
              <div key={city}>
                <button
                  type="button"
                  onClick={() => toggle(city)}
                  className="flex w-full items-center gap-3 py-3.5 text-left text-sm text-ink"
                >
                  <CheckBox
                    checked={selected.includes(city)}
                    className="size-5 rounded-[6px]"
                  />
                  <span className="min-w-0 break-words">
                    <span className={cn(selected.includes(city) && "font-medium")}>{city}</span>
                    {context && <span className="mt-0.5 block text-xs text-ink-muted">{context}</span>}
                  </span>
                </button>
                {i < displayCities.length - 1 && <div className="h-px w-full bg-grey-4" />}
              </div>
            ))
          )}
          {searchReady && (
            <InfiniteScrollSentinel
              hasNextPage={suggestions.hasNextPage}
              isFetching={suggestions.isFetching}
              isError={suggestions.isError}
              onLoadMore={() => suggestions.isError && !suggestions.isFetchNextPageError
                ? suggestions.refetch()
                : suggestions.fetchNextPage()}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Сброс всех настроек выборки на странице, когда они отличаются от начальных. */
export function ClearFiltersButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand/5 px-4 text-sm font-medium text-brand transition-colors hover:border-brand/45 hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <X className="size-4" aria-hidden="true" />
      Сбросить фильтры
      <span className="flex min-w-5 items-center justify-center rounded-full bg-brand/10 px-1.5 text-xs leading-5" aria-label={`Активных фильтров: ${count}`}>{count}</span>
    </button>
  );
}
