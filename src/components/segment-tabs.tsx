import { cn } from "@/lib/utils";

/** Один сегмент табов: значение + подпись + опциональный счётчик-бейдж. */
export type SegmentTabOption<T extends string> = {
  value: T;
  label: string;
  /** Счётчик рядом с подписью (напр. число заявок на вкладке). */
  badge?: string | number;
};

/**
 * Сегмент-табы (пилюли): компактная группа переключателей на сером фоне,
 * активный — белая пилюля с тенью. Общий компонент для разделов «Программа
 * лояльности» и «Реферальная программа».
 */
export function SegmentTabs<T extends string>({
  value,
  onChange,
  options,
  className,
  variant = "segmented",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentTabOption<T>[];
  /** Доп. классы контейнера (напр. `w-full` для растяжения на всю ширину). */
  className?: string;
  variant?: "segmented" | "flat";
}) {
  return (
    <div
      className={cn(
        "flex w-fit max-w-full shrink-0 items-center gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-grey-4/60 p-1",
        className,
        variant === "flat" && "gap-2 rounded-none bg-transparent p-0",
      )}
    >
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-5",
            value === item.value
              ? "bg-white text-ink shadow-sm"
              : "text-ink-muted hover:text-ink",
            variant === "flat" && "min-h-11 rounded-[10px] py-2 sm:min-h-[37px] sm:px-6",
            variant === "flat" && value === item.value && "bg-ink/5 shadow-none",
          )}
        >
          {item.label}
          {item.badge != null && (
            <span
              className={cn(
                "ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none",
                value === item.value
                  ? "bg-brand text-white"
                  : "bg-grey-3 text-ink-muted",
                variant === "flat" && value === item.value && "bg-status-blue",
              )}
            >
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
