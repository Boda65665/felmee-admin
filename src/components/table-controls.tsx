import { ArrowUpDown, Check, Search, SlidersHorizontal, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCitySuggestions } from "@/lib/api";
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
export function CityFilterMenu({
  label,
  cities,
  selected,
  onApply,
  onSearchChange,
}: {
  label: string;
  cities: string[];
  selected: string[];
  onApply: (values: string[]) => void;
  /**
   * Если задан — поиск делегируется наружу (серверный автокомплит):
   * компонент не фильтрует `cities` локально, а сообщает строку поиска, а
   * `cities` приходят уже отобранными. Без пропа — локальная фильтрация.
   */
  onSearchChange?: (query: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Снимок выбранных на момент открытия — для стабильного порядка (закреплены
  // сверху), чтобы список не «прыгал» при мгновенном выборе.
  const [pinned, setPinned] = useState<string[]>(selected);

  const asyncMode = onSearchChange != null;

  function handleOpenChange(next: boolean) {
    if (next) {
      setPinned(selected);
      setQuery("");
      onSearchChange?.("");
    }
    setOpen(next);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    onSearchChange?.(next);
  }

  // Итоговый список: закреплённые (выбранные при открытии) сверху, затем
  // остальные — оба по алфавиту.
  const displayCities = useMemo(() => {
    const sortRu = (arr: string[]) =>
      [...arr].sort((a, b) => a.localeCompare(b, "ru"));
    const base = asyncMode
      ? cities
      : cities.filter((c) =>
          c.toLowerCase().includes(query.trim().toLowerCase()),
        );
    const top = sortRu(pinned);
    const rest = sortRu(base.filter((c) => !pinned.includes(c)));
    return [...top, ...rest];
  }, [asyncMode, cities, query, pinned]);

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
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Поиск города"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
          />
        </label>

        <div className="flex max-h-[240px] flex-col overflow-y-auto">
          {displayCities.length === 0 ? (
            <p className="py-3.5 text-sm text-ink-muted">Ничего не найдено</p>
          ) : (
            displayCities.map((city, i) => (
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
                  <span className={cn(selected.includes(city) && "font-medium")}>{city}</span>
                </button>
                {i < displayCities.length - 1 && <div className="h-px w-full bg-grey-4" />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Самодостаточный заголовок-фильтр города для колонок таблиц. Держит строку
 * поиска, дебаунс и серверный автокомплит (`useCitySuggestions`) ВНУТРИ себя,
 * чтобы ввод не менял стейт страницы и не пересоздавал `columns` — иначе
 * `flexRender` размонтирует заголовок и стирает ввод/закрывает меню. Наружу
 * страница даёт только применённые города (`selected`) и `onApply`.
 */
export function CityFilterHeader({
  selected,
  onApply,
  label = "город",
}: {
  selected: string[];
  onApply: (values: string[]) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const { data } = useCitySuggestions(debounced);

  const cities = query.trim() === "" ? selected : (data ?? []);

  return (
    <CityFilterMenu
      label={label}
      cities={cities}
      selected={selected}
      onApply={onApply}
      onSearchChange={setQuery}
    />
  );
}

/**
 * Кнопка «Сбросить фильтры» справа от строки поиска. Появляется, когда активен
 * хотя бы один фильтр (`count > 0`); клик сбрасывает все фильтры. Какие именно
 * фильтры активны — видно по брендовым заголовкам колонок со счётчиком.
 */
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
      className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-grey-4 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-grey-5 hover:text-ink"
    >
      <X className="size-4" />
      Сбросить фильтры
    </button>
  );
}
