import { useEffect, useId, useRef, useState } from "react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useAddressSuggestions, type AddressSuggestion } from "@/lib/api";
import { usePlaceAddressSuggestions, type PlaceSuggestion } from "@/lib/api/suggestions";
import { cn } from "@/lib/utils";

/**
 * Поле «Адрес»: с place ищет внутри выбранного населённого пункта через
 * `/api/search/addresses`, без него — через `/api/suggestions/address`. Комбобокс на
 * Radix Popover: ввод (с дебаунсом) → список адресов; выбрать можно мышью или
 * с клавиатуры (↑/↓ + Enter, Escape — закрыть). Выбор из списка отдаёт
 * `address` + `geolocation` наружу (`onSelect`); свободный ввод без выбора
 * координат не даёт — такой адрес на сохранение не уйдёт (geolocation
 * обязателен в PATCH), о чём подскажет подпись.
 *
 * Popover сам порталит список и корректно встраивается слоем внутрь модалки —
 * выпадашка лежит поверх диалога и не обрезается его `overflow`.
 */
export function AddressAutocompleteField({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  error,
  helperText,
  className,
  place,
  disabled = false,
}: {
  label: string;
  /** Текущий текст адреса (контролируемый). */
  value: string;
  /** Правка текста вручную — сбрасывает ранее выбранную геопозицию у родителя. */
  onChange: (text: string) => void;
  /** Выбор подсказки — адрес + координаты. */
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  className?: string;
  place?: PlaceSuggestion | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = `${inputId}-suggestions`;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const globalAddresses = useAddressSuggestions(debounced, place === undefined && !disabled);
  const scopedAddresses = usePlaceAddressSuggestions(disabled ? "" : debounced, place);
  const { data: suggestions = [], isFetching, isError, isSuccess, isPlaceholderData } = place === undefined ? globalAddresses : scopedAddresses;

  const showList = !disabled && open && query.trim() === debounced && !isPlaceholderData && suggestions.length > 0;
  const noResults = !disabled && open && Boolean(debounced) && query.trim() === debounced
    && isSuccess && !isFetching && !isPlaceholderData && suggestions.length === 0;

  // Новый набор подсказок — сбрасываем подсветку.
  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  // Держим подсвеченный пункт в зоне видимости при навигации с клавиатуры.
  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleInput = (text: string) => {
    onChange(text);
    setQuery(text);
    setOpen(true);
  };

  const handlePick = (s: AddressSuggestion) => {
    onSelect(s);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showList) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (showList) e.preventDefault();
      if (showList && activeIndex >= 0) {
        e.preventDefault();
        handlePick(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (showList) { e.preventDefault(); e.stopPropagation(); }
      setOpen(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm leading-[1.3] text-ink-muted">{label}</label>
      <Popover open={showList} onOpenChange={(o) => !o && setOpen(false)}>
        <PopoverAnchor asChild>
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            type="text"
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand disabled:cursor-not-allowed disabled:bg-grey-5"
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          // Фокус остаётся в инпуте — продолжаем печатать и управлять списком.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => { if (e.target === inputRef.current) e.preventDefault(); }}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="max-h-55 overflow-y-auto p-1"
        >
          <ul ref={listRef} id={listId} role="listbox">
            {suggestions.map((s, i) => (
              <li key={`${s.address}-${i}`}>
                <button
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  // preventDefault — чтобы инпут не терял фокус при клике.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(s)}
                  className={cn(
                    "flex w-full items-start rounded-lg px-3 py-2.5 text-left text-sm leading-[1.3] text-ink transition-colors",
                    i === activeIndex && "bg-grey-5",
                  )}
                >
                  {s.address}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {open && query.trim() && isFetching && <span role="status" className="text-xs text-ink-muted">Поиск адресов…</span>}
      {open && query.trim() === debounced && isError && <span role="alert" className="text-xs text-danger">Не удалось загрузить подсказки адреса</span>}
      {noResults ? (
        <span role="status" className="text-xs leading-[1.3] text-ink-muted">Адреса не найдены. Уточните улицу или номер дома.</span>
      ) : error ? (
        <span className="text-xs leading-[1.3] text-danger">{error}</span>
      ) : helperText && (
        <span className="text-xs leading-[1.3] text-ink-muted">{helperText}</span>
      )}
    </div>
  );
}
