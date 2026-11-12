import {
  MetricDetailScreen,
  TransactionsTable,
  type ChartRow,
  type ChartSeries,
  type Transaction,
  type TransactionStatus,
} from "@/components";

/* ------------------------------------------------------------------ данные */

const GMV_SERIES: ChartSeries[] = [
  { key: "value", label: "Оборот", color: "var(--color-chart-gmv)" },
];

/** Точки графика «Оборот» (млн ₽), приближение к макету. */
const GMV_DATA: ChartRow[] = [
  { day: 1, value: 5.2 },
  { day: 2, value: 5.0 },
  { day: 3, value: 5.4 },
  { day: 4, value: 5.1 },
  { day: 5, value: 5.6 },
  { day: 6, value: 6.2 },
  { day: 7, value: 5.9 },
  { day: 8, value: 6.3 },
  { day: 9, value: 7.0 },
  { day: 10, value: 6.6 },
  { day: 11, value: 7.1 },
  { day: 12, value: 6.8 },
  { day: 13, value: 7.2 },
  { day: 14, value: 6.9 },
  { day: 15, value: 7.3 },
  { day: 16, value: 7.0 },
  { day: 17, value: 7.4 },
  { day: 18, value: 7.1 },
  { day: 19, value: 6.5 },
  { day: 20, value: 4.2 },
  { day: 21, value: 5.8 },
  { day: 22, value: 7.0 },
  { day: 23, value: 7.6 },
  { day: 24, value: 8.1 },
  { day: 25, value: 9.8 },
  { day: 26, value: 10.3 },
  { day: 27, value: 11.6 },
  { day: 28, value: 12.0 },
  { day: 29, value: 12.6 },
  { day: 30, value: 13.0 },
];

/** Операции таблицы: пары «операция / статус», остальное — общий демо-набор. */
const TX_SPEC: [operation: string, status: TransactionStatus][] = [
  ["Оплата услуги", "done"],
  ["Оплата услуги", "frozen"],
  ["Оплата услуги", "done"],
  ["Возврат", "cancelled"],
  ["Оплата услуги", "done"],
  ["Оплата услуги", "refund"],
  ["Оплата услуги", "done"],
  ["Оплата услуги", "done"],
  ["Оплата услуги", "done"],
  ["Оплата услуги", "done"],
  ["Оплата услуги", "done"],
  ["Оплата услуги", "done"],
];

const TRANSACTIONS: Transaction[] = TX_SPEC.map(([operation, status]) => ({
  operation,
  service: "Маникюр",
  user: "Екатерина Морозова",
  amount: "₽ 2 763",
  time: "12.04.26 в 14:32",
  status,
  fee: status === "done" || status === "refund" ? 763 : 0,
}));

/* --------------------------------------------------------------------- экран */

const GmvPage = () => (
  <MetricDetailScreen
    title="Оборот"
    data={GMV_DATA}
    series={GMV_SERIES}
    yDomain={[1, 13]}
    yTicks={[1, 5, 9, 13]}
    showBackHeader={false}
  >
    <TransactionsTable rows={TRANSACTIONS} />
  </MetricDetailScreen>
);

export default GmvPage;
