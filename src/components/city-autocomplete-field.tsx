import { useEffect, useId, useRef, useState } from "react";

import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useCitySuggestions } from "@/lib/api";
import { citySuggestionContext, useInfinitePlaceSuggestions, type CitySuggestion, type PlaceSuggestion } from "@/lib/api/suggestions";
import { cn } from "@/lib/utils";

/**
 * Поле «Город»: с onSelect использует `/api/search/places` и сохраняет FIAS/type,
 * без него — `/api/suggestions/cities` и сохраняет название. Комбобокс на
 * Radix Popover: ввод (с дебаунсом) → список городов; выбрать можно мышью или
 * с клавиатуры (↑/↓ + Enter, Escape — закрыть). Город — просто строка (без
 * координат), поэтому свободный ввод тоже допустим.
 *
 * Popover сам порталит список и корректно встраивается слоем внутрь модалки —
 * выпадашка лежит поверх диалога и не обрезается его `overflow`.
 */
export function CityAutocompleteField({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  error,
  className,
}: {
  label: string;
  /** Текущий текст города (контролируемый). */
  value: string;
  /** Правка текста — вручную или выбором подсказки. */
  onChange: (text: string) => void;
  onSelect?: (place: PlaceSuggestion) => void;
  placeholder?: string;
  error?: string;
  className?: string;
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

  const searchReady = open && query.trim() === debounced;
  const cities = useCitySuggestions(debounced, searchReady && !onSelect);
  const places = useInfinitePlaceSuggestions(debounced, searchReady && Boolean(onSelect));
  const suggestions = onSelect ? places : cities;
  const { isFetching, isFetchingNextPage } = suggestions;

  const list: Array<CitySuggestion | PlaceSuggestion> = (onSelect ? places.data : cities.data) ?? [];
  const showList = searchReady && list.length > 0;

  // Новый набор подсказок — сбрасываем подсветку.
  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  const handleInput = (text: string) => {
    onChange(text);
    setQuery(text);
    setOpen(true);
  };

  const handlePick = (place: CitySuggestion | PlaceSuggestion) => {
    if (onSelect && "fias_id" in place) onSelect(place);
    else onChange(place.name);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!showList) setOpen(true);
      const down = e.key === "ArrowDown";
      if (down && showList && activeIndex === list.length - 1 && suggestions.hasNextPage && !isFetching) {
        void suggestions.fetchNextPage();
      }
      const next = Math.min(Math.max(activeIndex + (down ? 1 : -1), 0), list.length - 1);
      setActiveIndex(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (showList) e.preventDefault();
      if (showList && activeIndex >= 0) {
        e.preventDefault();
        handlePick(list[activeIndex]);
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
            value={value}
            placeholder={placeholder}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          // Фокус остаётся в инпуте — продолжаем печатать и управлять списком.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => { if (e.target === inputRef.current) e.preventDefault(); }}
          // Выпадающий список в портале: не отдаём жест блокировке скролла модалки.
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="max-h-[min(13.75rem,var(--radix-popover-content-available-height))] p-1"
        >
          <ul ref={listRef} id={listId} role="listbox">
            {list.map((place, i) => {
              const context = citySuggestionContext(place);
              return (
                <li key={`${"fias_id" in place ? place.fias_id : place.name}-${i}`}>
                  <button
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    // preventDefault — чтобы инпут не терял фокус при клике.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(place)}
                    className={cn(
                      "flex w-full items-start rounded-lg px-3 py-2.5 text-left text-sm leading-[1.3] text-ink transition-colors",
                      i === activeIndex && "bg-grey-5",
                    )}
                  >
                    <span className="min-w-0 break-words">
                      {place.name}
                      {context && <span className="mt-0.5 block text-xs text-ink-muted">{context}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <InfiniteScrollSentinel
            hasNextPage={suggestions.hasNextPage}
            isFetching={isFetching}
            isError={suggestions.isFetchNextPageError}
            onLoadMore={() => suggestions.fetchNextPage()}
          />
        </PopoverContent>
      </Popover>
      {open && query.trim() && isFetching && !isFetchingNextPage && <span role="status" className="text-xs text-ink-muted">Поиск городов…</span>}
      {error && <span className="text-xs leading-[1.3] text-danger">{error}</span>}
    </div>
  );
}
