import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { DateFilter } from "@/components/date-filter";
import { PageBackHeader } from "@/components/page-back-header";
import { ClearFiltersButton } from "@/components/table-controls";
import { MetricChartCard, type ChartSeries } from "./metric-chart-card";
import { useBusinessOverview, type OverviewDay } from "@/lib/api/business-overview";
import { overviewNumber, useOverviewPeriod } from "@/lib/business-overview";

const compactNumber = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });
type MetricKey = Exclude<keyof OverviewDay, "date">;

export function OverviewPeriodFilter({ selection }: { selection: ReturnType<typeof useOverviewPeriod> }) {
  return <div className="flex flex-wrap items-center gap-3">
    <DateFilter value={selection.range} onChange={selection.onChange} />
    <ClearFiltersButton count={selection.dirty ? 1 : 0} onClick={selection.reset} />
    {!selection.valid && <p role="alert" className="text-danger">Выберите период до 366 дней</p>}
  </div>;
}

export function OverviewChart({ title, days, series }: {
  title: string;
  days: OverviewDay[];
  series: (ChartSeries & { key: MetricKey })[];
}) {
  const data = days.map((day, index) => ({
    day: index + 1,
    ...Object.fromEntries(series.map(({ key }) => [key, day[key]])),
  }));
  const unit = series[0]?.key === "booking_payment_percent" ? "%" : " ₽";
  const values = days.flatMap((day) => series.map(({ key }) => day[key]).filter((value) => value !== null));
  if (values.length === 0) {
    return <p className="rounded-xl bg-white p-5 text-ink-muted">За выбранный период данных нет</p>;
  }
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const step = Math.max(1, 10 ** Math.floor(Math.log10((max - min || 1) / 4)));
  const domain: [number, number] = [Math.floor(min / step) * step, Math.max(step, Math.ceil(max / step) * step)];
  const tickCount = Math.min(days.length, 7);
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    1 + Math.round((index * (days.length - 1)) / Math.max(1, tickCount - 1)));
  const label = (index: number) => {
    const day = days[Math.round(index) - 1];
    return day ? format(parseISO(day.date), "d MMM", { locale: ru }) : "";
  };
  return <MetricChartCard title={title} subtitle="За выбранный период" data={data} series={series}
    yDomain={domain} xDomain={[1, Math.max(2, days.length)]} xTicks={ticks}
    formatXTick={label} formatTooltipLabel={label} formatYTick={(value) => `${compactNumber.format(value)}${unit}`}
    formatTooltipValue={(value) => `${overviewNumber.format(value)}${unit}`}
    height={418} yAxisWidth={72} lineType="linear" showViewToggle={false} />;
}

export function OverviewLoading({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  return error ? (
    <div role="alert" className="flex items-center gap-3 rounded-xl bg-white p-5 text-danger">
      Не удалось загрузить данные
      <button type="button" className="text-brand underline" onClick={onRetry}>Повторить</button>
    </div>
  ) : <p role="status" className="text-ink-muted">Загрузка данных…</p>;
}

export function OverviewMetricPage({ title, field, showBackHeader = true, children }: {
  title: string;
  field: MetricKey;
  showBackHeader?: boolean;
  children?: (period: ReturnType<typeof useOverviewPeriod>["period"]) => ReactNode;
}) {
  const selection = useOverviewPeriod();
  const { period, valid } = selection;
  const stats = useBusinessOverview(period, valid);
  return <>
    {showBackHeader && <PageBackHeader title={title} />}
    <OverviewPeriodFilter selection={selection} />
    {valid && (stats.data ? <OverviewChart title={title} days={stats.data.days}
      series={[{ key: field, label: title, color: "var(--color-chart-gmv)" }]} />
      : <OverviewLoading error={stats.isError} onRetry={() => void stats.refetch()} />)}
    {valid && children?.(period)}
  </>;
}
