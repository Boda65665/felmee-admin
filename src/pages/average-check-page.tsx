import {
  MetricDetailScreen,
  type ChartRow,
  type ChartSeries,
} from "@/components";

/* ------------------------------------------------------------------ данные */

const AVERAGE_CHECK_SERIES: ChartSeries[] = [
  { key: "value", label: "Средний чек", color: "var(--color-chart-gmv)" },
];

/** Демонстрационные точки графика «Средний чек» в рублях. */
const AVERAGE_CHECK_DATA: ChartRow[] = [
  { day: 1, value: 1450 },
  { day: 2, value: 1320 },
  { day: 3, value: 1450 },
  { day: 4, value: 1410 },
  { day: 5, value: 1790 },
  { day: 6, value: 1700 },
  { day: 7, value: 1610 },
  { day: 8, value: 1840 },
  { day: 9, value: 1880 },
  { day: 10, value: 1750 },
  { day: 11, value: 1790 },
  { day: 12, value: 1960 },
  { day: 13, value: 1870 },
  { day: 14, value: 2050 },
  { day: 15, value: 2040 },
  { day: 16, value: 1810 },
  { day: 17, value: 1820 },
  { day: 18, value: 1930 },
  { day: 19, value: 2130 },
  { day: 20, value: 1150 },
  { day: 21, value: 1720 },
  { day: 22, value: 2020 },
  { day: 23, value: 1850 },
  { day: 24, value: 2420 },
  { day: 25, value: 2680 },
  { day: 26, value: 2570 },
  { day: 27, value: 2810 },
  { day: 28, value: 2750 },
  { day: 29, value: 2910 },
  { day: 30, value: 3000 },
];

const rubles = new Intl.NumberFormat("ru-RU");

/* --------------------------------------------------------------------- экран */

const AverageCheckPage = () => (
  <MetricDetailScreen
    title="Средний чек"
    data={AVERAGE_CHECK_DATA}
    series={AVERAGE_CHECK_SERIES}
    yDomain={[750, 3000]}
    yTicks={[750, 1500, 2250, 3000]}
    formatYTick={(value) => `${rubles.format(value)} ₽`}
    formatTooltipValue={(value) => `₽ ${rubles.format(value)}`}
    yAxisWidth={68}
  />
);

export default AverageCheckPage;
