import {
  MetricDetailScreen,
  type ChartRow,
  type ChartSeries,
} from "@/components";

/* ------------------------------------------------------------------ данные */

const REVENUE_SERIES: ChartSeries[] = [
  { key: "value", label: "Выручка", color: "var(--color-chart-gmv)" },
];

/** Точки графика «Выручка (комиссия)» (млн ₽), приближение к макету. */
const REVENUE_DATA: ChartRow[] = [
  { day: 1, value: 1.05 },
  { day: 2, value: 1.1 },
  { day: 3, value: 1.15 },
  { day: 4, value: 1.1 },
  { day: 5, value: 1.2 },
  { day: 6, value: 1.25 },
  { day: 7, value: 1.2 },
  { day: 8, value: 1.3 },
  { day: 9, value: 1.35 },
  { day: 10, value: 1.3 },
  { day: 11, value: 1.4 },
  { day: 12, value: 1.35 },
  { day: 13, value: 1.45 },
  { day: 14, value: 1.4 },
  { day: 15, value: 1.5 },
  { day: 16, value: 1.45 },
  { day: 17, value: 1.5 },
  { day: 18, value: 1.45 },
  { day: 19, value: 1.3 },
  { day: 20, value: 1.0 },
  { day: 21, value: 1.25 },
  { day: 22, value: 1.4 },
  { day: 23, value: 1.5 },
  { day: 24, value: 1.55 },
  { day: 25, value: 1.7 },
  { day: 26, value: 1.6 },
  { day: 27, value: 1.6 },
  { day: 28, value: 1.75 },
  { day: 29, value: 1.85 },
  { day: 30, value: 1.9 },
];

/* --------------------------------------------------------------------- экран */

const RevenuePage = () => (
  <MetricDetailScreen
    title="Выручка (комиссия)"
    data={REVENUE_DATA}
    series={REVENUE_SERIES}
    yDomain={[0.5, 2]}
    yTicks={[0.5, 1, 1.5, 2]}
  />
);

export default RevenuePage;
