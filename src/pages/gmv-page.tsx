import { TransactionsTable } from "@/components";
import { OverviewMetricPage } from "@/components/dashboard/overview-metrics";

const GmvPage = () => (
  <OverviewMetricPage title="Оборот" field="gmv_rub" showBackHeader={false}>
    {(period) => <TransactionsTable period={period} />}
  </OverviewMetricPage>
);

export default GmvPage;
