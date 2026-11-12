import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { DeltaBadge } from "./delta-badge";

export type StatTone = "brand" | "success" | "danger" | "warning";

/** Тон иконки карточки: фон квадрата + цвет глифа. */
const TONE: Record<StatTone, { wrap: string; icon: string }> = {
  brand: { wrap: "bg-brand/10", icon: "text-brand" },
  success: { wrap: "bg-success-bg", icon: "text-success" },
  danger: { wrap: "bg-danger/10", icon: "text-danger" },
  warning: { wrap: "bg-warning-bg", icon: "text-warning" },
};

/**
 * KPI-карточка разделов управления: иконка в цветном квадрате, подпись,
 * крупное значение и дельта. По умолчанию дельта — приглушённый текст;
 * с `deltaUp` она рендерится цветным бейджем роста/падения. Используется
 * на экранах «Пользователи», «Мастера и салоны» и «Записи».
 */
export function StatCard({
  title,
  value,
  delta,
  deltaUp,
  icon: Icon,
  tone = "brand",
}: {
  title: string;
  value: string;
  delta?: string;
  /** Если задано — дельта показывается зелёным/красным бейджем вместо текста. */
  deltaUp?: boolean;
  icon: ComponentType<{ className?: string }>;
  tone?: StatTone;
}) {
  const t = TONE[tone];
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[20px] border border-grey-4 bg-white p-4 sm:gap-4 sm:rounded-[28px] sm:p-5 xl:gap-5 xl:p-6">
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl xl:size-[72px]",
          t.wrap,
        )}
      >
        <Icon className={cn("size-6 xl:size-8", t.icon)} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:gap-2">
        <p className="text-sm font-medium leading-[1.3] tracking-tight text-ink-muted">
          {title}
        </p>
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <p className="break-words text-2xl font-medium leading-[1.3] tracking-tight text-ink xl:text-[32px]">
            {value}
          </p>
          {delta &&
            (deltaUp === undefined ? (
              <span className="pb-1.5 text-sm font-bold tracking-tight text-ink/60">
                {delta}
              </span>
            ) : (
              <span className="pb-1">
                <DeltaBadge up={deltaUp}>{delta}</DeltaBadge>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
