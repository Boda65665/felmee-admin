import type { ReactNode } from "react";

import { PageBackHeader } from "@/components/page-back-header";
import { DateFilter } from "@/components/date-filter";
import {
  MetricChartCard,
  type ChartRow,
  type ChartSeries,
} from "@/components/dashboard/metric-chart-card";

/**
 * Экран-деталь метрики, открываемый из KPI-карточки дашборда: шапка «назад»,
 * фильтр периода и график метрики. Заголовок общий для шапки и графика.
 * Дополнительный контент под графиком (напр. таблица операций GMV) — `children`.
 */
export const MetricDetailScreen = ({
  title,
  data,
  series,
  yDomain,
  yTicks,
  formatYTick,
  formatTooltipValue,
  yAxisWidth,
  showBackHeader = true,
  children,
}: {
  title: string;
  data: ChartRow[];
  series: ChartSeries[];
  yDomain: [number, number];
  yTicks: number[];
  formatYTick?: (value: number) => string;
  formatTooltipValue?: (value: number) => string;
  yAxisWidth?: number;
  showBackHeader?: boolean;
  children?: ReactNode;
}) => {
  return (
    <>
      {showBackHeader && <PageBackHeader title={title} />}
      <DateFilter />
      <MetricChartCard
        title={title}
        data={data}
        series={series}
        yDomain={yDomain}
        yTicks={yTicks}
        formatYTick={formatYTick}
        formatTooltipValue={formatTooltipValue}
        yAxisWidth={yAxisWidth}
        height={418}
        showViewToggle={false}
        lineType="linear"
      />
      {children}
    </>
  );
};
