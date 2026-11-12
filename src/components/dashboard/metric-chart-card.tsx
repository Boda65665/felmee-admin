import { useState } from "react";
import {
  BarChart3 as BarChartIcon,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatMillions } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  /** Короткая метка для тултипа (напр. «О»/«В»); без неё значение без префикса. */
  short?: string;
  dashed?: boolean;
};

export type ChartRow = { day: number } & Record<string, number>;

/** Значение серии по умолчанию — млн ₽ (дашборд). */
const defaultTooltipValue = (v: number) => `₽ ${formatMillions(v)} М`;
/** Подпись оси Y по умолчанию — млн ₽. */
const defaultYTick = (v: number) => `${formatMillions(v)} М`;
/** Подпись точки/оси X по умолчанию (день + месяц). */
const defaultXTick = (v: number) => `${v}, июн`;
const defaultTooltipLabel = (v: number) => `${v} июн`;

/** Тёмная плашка-тултип: дата + значение каждой серии. */
const ChartTooltip = ({
  active,
  payload,
  label,
  series,
  formatValue = defaultTooltipValue,
  formatLabel = defaultTooltipLabel,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: number;
  series: ChartSeries[];
  formatValue?: (value: number) => string;
  formatLabel?: (label: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-ink px-4 py-2 text-white">
      <span className="text-xs leading-[1.3] tracking-tight text-white/60">
        {formatLabel(label ?? 0)}
      </span>
      <span className="text-sm leading-[1.3] tracking-tight">
        {series.map((s) => {
          const value = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
          return (
            <span key={s.key} className="block">
              {s.short ? `${s.short}: ` : ""}
              {formatValue(value)}
            </span>
          );
        })}
      </span>
    </div>
  );
};

/**
 * Карточка-график метрики за 30 дней: заголовок, легенда (для 2+ серий),
 * переключатель линия/столбцы и сетка с осями в млн ₽. Одна или несколько серий.
 */
export const MetricChartCard = ({
  title,
  subtitle = "За последние 30 дней",
  data,
  series,
  yDomain,
  yTicks,
  xDomain = [1, 30],
  xTicks = [1, 5, 10, 15, 20, 25, 30],
  formatYTick = defaultYTick,
  formatXTick = defaultXTick,
  formatTooltipValue = defaultTooltipValue,
  formatTooltipLabel = defaultTooltipLabel,
  height,
  showViewToggle = true,
  lineType = "monotone",
  yAxisWidth = 44,
}: {
  title: string;
  subtitle?: string;
  data: ChartRow[];
  series: ChartSeries[];
  yDomain: [number, number];
  yTicks: number[];
  xDomain?: [number, number];
  xTicks?: number[];
  /** Подпись оси Y (по умолчанию млн ₽). */
  formatYTick?: (value: number) => string;
  /** Подпись оси X (по умолчанию «день, июн»). */
  formatXTick?: (value: number) => string;
  /** Значение серии в тултипе (по умолчанию «₽ N М»). */
  formatTooltipValue?: (value: number) => string;
  /** Подпись точки в тултипе (по умолчанию «день июн»). */
  formatTooltipLabel?: (label: number) => string;
  /** Фиксированная высота карточки в макетах обзора бизнеса. */
  height?: number;
  showViewToggle?: boolean;
  lineType?: "linear" | "monotone";
  yAxisWidth?: number;
}) => {
  const [view, setView] = useState<"line" | "bar">("line");
  const compact = useMediaQuery("(max-width: 639px)");
  const displayedTicks = compact && xTicks.length > 4
    ? xTicks.filter((_, index) => index === 0 || index === xTicks.length - 1 || index % 3 === 0)
    : xTicks;

  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ) satisfies ChartConfig;

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-grey-4)" />
      <XAxis
        dataKey="day"
        type="number"
        domain={xDomain}
        ticks={displayedTicks}
        tickFormatter={formatXTick}
        tickLine={false}
        axisLine={false}
        tickMargin={12}
        tick={{ fill: "var(--color-ink-muted)", fontSize: compact ? 11 : 14 }}
      />
      <YAxis
        domain={yDomain}
        ticks={yTicks}
        tickFormatter={formatYTick}
        tickLine={false}
        axisLine={false}
        width={yAxisWidth}
        tick={{ fill: "var(--color-ink-muted)", fontSize: compact ? 11 : 14 }}
      />
      <Tooltip
        content={
          <ChartTooltip
            series={series}
            formatValue={formatTooltipValue}
            formatLabel={formatTooltipLabel}
          />
        }
        cursor={
          view === "line"
            ? { stroke: "var(--color-grey-4)" }
            : { fill: "var(--color-grey-5)" }
        }
      />
    </>
  );

  return (
    <Card className="relative flex shrink-0 flex-col" style={height ? { height: compact ? 340 : height } : undefined}>
      <div className={cn("mb-4 flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:mb-6", showViewToggle && "sm:pr-24")}>
        <h2 className="text-lg font-medium leading-[1.3] tracking-tight text-ink">
          {title}
        </h2>
        <span className="text-sm font-medium leading-[1.3] tracking-tight text-ink-muted">
          {subtitle}
        </span>
      </div>

      {/* Переключатель типа графика */}
      {showViewToggle && (
        <div className="mb-4 flex w-fit shrink-0 items-center gap-1 rounded-xl border border-grey-4 bg-ink/10 p-1 sm:absolute sm:right-5 sm:top-5 sm:mb-0">
          {(
            [
              ["line", LineChartIcon],
              ["bar", BarChartIcon],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              aria-label={key === "line" ? "Линейный график" : "Столбчатый график"}
              onClick={() => setView(key)}
              className={cn(
                "flex h-10 w-11 items-center justify-center rounded-lg transition-colors sm:h-8 sm:w-[42px]",
                view === key ? "bg-white text-ink" : "text-ink-muted",
              )}
            >
              <Icon className="size-5" />
            </button>
          ))}
        </div>
      )}

      {/* Легенда — только для нескольких серий */}
      {series.length > 1 && (
        <div className="mb-2 flex shrink-0 items-center gap-4">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-sm font-medium leading-[1.3] tracking-tight text-ink">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <ChartContainer
        config={config}
        className={cn("aspect-auto w-full min-w-0", height ? "min-h-0 flex-1" : "h-[240px] sm:h-[300px]")}
      >
        {view === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {axes}
            {series.map((s) => (
              <Line
                key={s.key}
                type={lineType}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "6 6" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barGap={2}
            barCategoryGap="28%"
          >
            {axes}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[6, 6, 0, 0]}
                maxBarSize={16}
              />
            ))}
          </BarChart>
        )}
      </ChartContainer>
    </Card>
  );
};
