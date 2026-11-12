import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/card";
import { DeltaBadge } from "@/components/delta-badge";

export type KpiStat = {
  up: boolean;
  title: string;
  value: string;
  delta: string;
};

/** Карточка KPI: заголовок, ссылка-стрелка (если задан onOpen), значение и бейдж. */
export const KpiCard = ({
  up,
  title,
  value,
  delta,
  onOpen,
}: KpiStat & { onOpen?: () => void }) => {
  return (
    <Card className="flex min-h-[180px] flex-col justify-between gap-6 sm:h-[220px]">
      <div className="flex items-center justify-between">
        <p className="text-base font-medium leading-[1.3] tracking-tight text-ink">
          {title}
        </p>

        <button
          type="button"
          aria-label={`Подробнее: ${title}`}
          onClick={onOpen}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-grey-5 text-ink transition-colors sm:size-8",
            onOpen && "hover:bg-grey-4",
          )}
        >
          <ArrowUpRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="break-words text-[32px] font-medium leading-[1.1] tracking-tight text-ink xl:text-[40px]">
          {value}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <DeltaBadge up={up}>{delta}</DeltaBadge>

          <span className="text-sm font-medium leading-[1.3] tracking-tight text-ink-muted">
            К прошлому периоду
          </span>
        </div>
      </div>
    </Card>
  );
};
