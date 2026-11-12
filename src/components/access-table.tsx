import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export type Access = "full" | "read" | "none";
/** `section` — стабильный ключ раздела (enum-код), `name` — подпись для показа. */
export type AccessRow = { section: string; name: string; access: Access };

const ACCESS_OPTIONS: { value: Access; label: string }[] = [
  { value: "full", label: "Полный" },
  { value: "read", label: "Чтение" },
  { value: "none", label: "Нет" },
];

const ACCESS_ACTIVE: Record<Access, string> = {
  full: "bg-success-bg text-success-fg",
  read: "bg-warning-bg text-warning",
  none: "bg-grey-2 text-ink",
};

/** Три пилюли [Полный | Чтение | Нет]; активная подсвечена по типу доступа. */
const AccessControl = ({
  value,
  onChange,
}: {
  value: Access;
  onChange: (value: Access) => void;
}) => {
  return (
    <ToggleGroup
      type="single"
      className="w-full sm:w-auto"
      value={value}
      onValueChange={(next) => next && onChange(next as Access)}
    >
      {ACCESS_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              "min-h-11 flex-1 sm:flex-none",
              active
                ? ACCESS_ACTIVE[option.value]
                : "bg-grey-5 text-ink-muted hover:bg-grey-4",
            )}
          >
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
};

/**
 * Таблица доступов сотрудника — отдельный тип таблицы (не `DataTable`):
 * интерактивная панель с шапкой-карточкой сотрудника и сегмент-контролом
 * `[Полный | Чтение | Нет]` по каждой строке-разделу.
 */
export const AccessTable = ({
  employeeName,
  rows,
  onChange,
}: {
  employeeName: string;
  rows: AccessRow[];
  onChange: (section: string, access: Access) => void;
}) => {
  return (
    <div className="mt-1 flex min-w-0 flex-col gap-4 rounded-2xl border border-grey-4 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex-1 text-xs font-medium uppercase tracking-tight text-ink-muted">
          Раздел панели
        </span>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={employeeName} className="size-9 rounded-xl text-sm" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-ink">
              {employeeName}
            </span>
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-grey-4" />

      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.section}
            className="flex flex-col items-stretch gap-3 border-b border-grey-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:py-2.5"
          >
            <span className="flex-1 text-sm text-ink">{row.name}</span>
            <AccessControl
              value={row.access}
              onChange={(value) => onChange(row.section, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
