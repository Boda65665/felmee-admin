import { useNavigate } from "react-router-dom";

import { KpiCard, MetricsGrid } from "@/components";
import { OverviewChart, OverviewLoading, OverviewPeriodFilter } from "@/components/dashboard/overview-metrics";
import { overviewStat, useOverviewPeriod } from "@/lib/business-overview";
import { useBusinessOverview } from "@/lib/api/business-overview";
import { ROUTES } from "@/lib/routes";

const DashboardPage = () => {
  const navigate = useNavigate();
  const selection = useOverviewPeriod();
  const { period, valid } = selection;
  const stats = useBusinessOverview(period, valid);
  const data = stats.data;

  return <>
    <OverviewPeriodFilter selection={selection} />
    {valid && !data && <OverviewLoading error={stats.isError} onRetry={() => void stats.refetch()} />}
    {data && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { ...overviewStat("Оборот (GMV)", data.gmv_rub, " ₽"), to: ROUTES.gmv },
          { ...overviewStat("Выручка (комиссия)", data.commission_rub, " ₽"), to: ROUTES.revenue },
          { ...overviewStat("Средний чек", data.average_check_rub, " ₽"), to: ROUTES.averageCheck },
        ].map(({ to, ...kpi }) => (
          <KpiCard key={kpi.title} {...kpi} onOpen={() =>
            navigate({ pathname: to, search: new URLSearchParams(period).toString() })} />
        ))}
      </div>
      <OverviewChart title="Оборот и выручка" days={data.days} series={[
        { key: "gmv_rub", label: "Оборот", color: "var(--color-chart-gmv)", short: "О" },
        { key: "commission_rub", label: "Выручка", color: "var(--color-chart-rev)", short: "В", dashed: true },
      ]} />
      <MetricsGrid metrics={[
        overviewStat("Новые клиенты", data.new_clients),
        overviewStat("Доля отменённых записей", {
          value: data.cancellation_percent, change_percent: data.cancellation_change_points,
        }, "%", true),
        overviewStat("Записи", data.records),
      ]} />
    </>}
  </>;
};

export default DashboardPage;
