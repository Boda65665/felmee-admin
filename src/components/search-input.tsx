import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Поле поиска над таблицами: иконка + input. Работает в управляемом
 * (`value`+`onChange`) и неуправляемом режимах. Ширину/отступы задаёт
 * `className` на обёртке (напр. `max-w-[547px]`).
 */
export const SearchInput = ({
  value,
  onChange,
  placeholder,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  return (
    <label
      className={cn(
        "flex h-12 w-full min-w-0 max-w-full items-center gap-2 rounded-xl border border-grey-4 px-3 sm:px-4",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-base leading-[1.3] tracking-tight text-ink outline-none placeholder:text-ink-muted"
      />
    </label>
  );
};
