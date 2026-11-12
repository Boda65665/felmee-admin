import { useNavigate } from "react-router-dom";

import {
  KpiCard,
  DateFilter,
  MetricsGrid,
  MetricChartCard,
  type ChartRow,
  type ChartSeries,
  type KpiStat,
} from "@/components";
import { ROUTES, type RoutePath } from "@/lib/routes";

/* ------------------------------------------------------------------ данные */

/** Верхние KPI-карточки; `to` — маршрут деталей для карточек с переходом. */
const KPIS: (KpiStat & { to?: RoutePath })[] = [
  {
    title: "Оборот (GMV)",
    value: "₽ 12 480 200",
    delta: "+14,2%",
    up: true,
    to: ROUTES.gmv,
  },
  {
    title: "Выручка (комиссия)",
    value: "₽ 1 872 030",
    delta: "+14,2%",
    up: true,
    to: ROUTES.revenue,
  },
  {
    title: "Средний чек",
    value: "₽ 2 763",
    delta: "-0.9%",
    up: false,
    to: ROUTES.averageCheck,
  },
];

const CHART_SERIES: ChartSeries[] = [
  { key: "gmv", label: "Оборот", color: "var(--color-chart-gmv)", short: "О" },
  {
    key: "rev",
    label: "Выручка",
    color: "var(--color-chart-rev)",
    short: "В",
    dashed: true,
  },
];

/** Точки графика «Оборот и выручка» (млн ₽), приближение к макету. */
const CHART_DATA: ChartRow[] = [
  { day: 1, gmv: 5.2, rev: 1.5 },
  { day: 2, gmv: 5.0, rev: 1.6 },
  { day: 3, gmv: 5.4, rev: 1.7 },
  { day: 4, gmv: 5.1, rev: 1.8 },
  { day: 5, gmv: 5.6, rev: 1.9 },
  { day: 6, gmv: 6.2, rev: 2.0 },
  { day: 7, gmv: 5.9, rev: 2.05 },
  { day: 8, gmv: 6.3, rev: 2.1 },
  { day: 9, gmv: 7.0, rev: 2.15 },
  { day: 10, gmv: 6.6, rev: 2.2 },
  { day: 11, gmv: 7.1, rev: 2.25 },
  { day: 12, gmv: 6.8, rev: 2.2 },
  { day: 13, gmv: 7.2, rev: 2.15 },
  { day: 14, gmv: 6.9, rev: 2.1 },
  { day: 15, gmv: 7.3, rev: 2.05 },
  { day: 16, gmv: 7.0, rev: 2.0 },
  { day: 17, gmv: 7.4, rev: 1.95 },
  { day: 18, gmv: 7.1, rev: 1.9 },
  { day: 19, gmv: 6.5, rev: 1.85 },
  { day: 20, gmv: 4.2, rev: 1.8 },
  { day: 21, gmv: 5.8, rev: 2.2 },
  { day: 22, gmv: 7.0, rev: 2.8 },
  { day: 23, gmv: 7.6, rev: 3.3 },
  { day: 24, gmv: 8.1, rev: 3.8 },
  { day: 25, gmv: 9.8, rev: 4.3 },
  { day: 26, gmv: 10.3, rev: 4.8 },
  { day: 27, gmv: 11.6, rev: 5.1 },
  { day: 28, gmv: 12.0, rev: 5.3 },
  { day: 29, gmv: 12.6, rev: 5.4 },
  { day: 30, gmv: 13.0, rev: 5.5 },
];

/* --------------------------------------------------------------------- экран */

const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <DateFilter />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map(({ to, ...kpi }) => (
          <KpiCard
            key={kpi.title}
            {...kpi}
            onOpen={to ? () => navigate(to) : undefined}
          />
        ))}
      </div>

      <MetricChartCard
        title="Оборот и выручка"
        data={CHART_DATA}
        series={CHART_SERIES}
        yDomain={[1, 13]}
        yTicks={[1, 5, 9, 13]}
        height={418}
        showViewToggle={false}
        lineType="linear"
      />

      <MetricsGrid />
    </>
  );
};

export default DashboardPage;
