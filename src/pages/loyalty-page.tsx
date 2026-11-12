import { Pencil, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Card,
  DataTable,
  DateFilter,
  LoyaltyRewardDialog,
  MetricChartCard,
  SegmentTabs,
  StatCard,
  type ChartRow,
  type ChartSeries,
  type DateRange,
} from "@/components";
import { useToast } from "@/components/ui";
import { usePersistentState } from "@/lib/use-persistent-state";
import {
  useReferralProfit,
  useReferralRules,
  useReferralStats,
  useUpdateReferralRule,
  type AdminReferralRule,
  type AdminReferralRuleUpdate,
} from "@/lib/api";

/* ------------------------------------------------------------------ данные */

/** Интервал вознаграждения API → подпись. */
const INTERVAL_LABEL: Record<string, string> = {
  ALL_SERVICES: "на все услуги",
  NEXT_SERVICE: "на следующую услугу",
};

const INTERVAL_OPTIONS = [
  { value: "ALL_SERVICES", label: "на все услуги" },
  { value: "NEXT_SERVICE", label: "на следующую услугу" },
];

const numberFmt = new Intl.NumberFormat("ru-RU");

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Дефолтный период — последние 30 дней. */
const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
};

const round1 = (value: number) => Math.round(value * 10) / 10;

const formatCount = (value: number | undefined) =>
  value == null ? "—" : numberFmt.format(value);

/** Дельта к прошлому периоду (проценты): текст со знаком + направление. */
const formatDelta = (
  percent: number | null | undefined,
): { text?: string; up?: boolean } => {
  if (percent == null) return {};
  const v = round1(percent);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return { text: `${sign}${numberFmt.format(Math.abs(v))}%`, up: v >= 0 };
};

/** Дельта конверсии — в процентных пунктах. */
const formatPointsDelta = (
  points: number | null | undefined,
): { text?: string; up?: boolean } => {
  if (points == null) return {};
  const v = round1(points);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return { text: `${sign}${numberFmt.format(Math.abs(v))} п.п.`, up: v >= 0 };
};

/** Компактная сумма для оси Y (₽): млн / тыс / рубли. */
const formatMoneyShort = (value: number) => {
  if (value >= 1_000_000) return `₽ ${round1(value / 1_000_000)} млн`;
  if (value >= 1_000) return `₽ ${Math.round(value / 1_000)} тыс`;
  return `₽ ${numberFmt.format(value)}`;
};

/** Округление вверх до «красивого» значения (1/2/5 × 10ⁿ). */
const niceCeil = (value: number) => {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const norm = value / pow;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * pow;
};

/* ------------------------------------------------------------------- график */

const CHART_SERIES: ChartSeries[] = [
  { key: "earned", label: "Заработано", color: "var(--color-chart-gmv)", short: "З" },
  { key: "spent", label: "Потрачено", color: "var(--color-chart-rev)", short: "П", dashed: true },
];

/* --------------------------------------------------------------------- табы */

type Tab = "all" | "friends" | "masters";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "friends", label: "Друзья" },
  { value: "masters", label: "Мастера" },
];

/* -------------------------------------------------------------------- секция */

const COLS = "grid grid-cols-[1fr_140px_1fr_44px] items-center gap-4";

/** Колонки таблицы правил (общие для секций «Друзья» / «Мастера»). */
const ruleColumns = (
  onEdit: (rule: AdminReferralRule) => void,
): ColumnDef<AdminReferralRule>[] => [
  {
    accessorKey: "condition_text",
    meta: { mobileLabel: "Условия программы" },
    header: () => <span>условия программы лояльности</span>,
    cell: ({ row }) => (
      <span className="text-sm text-ink">{row.original.condition_text}</span>
    ),
  },
  {
    accessorKey: "reward_percent",
    meta: { mobileLabel: "Вознаграждение" },
    header: () => <span>вознаграждение</span>,
    cell: ({ row }) => (
      <span className="text-sm text-ink">{row.original.reward_percent}%</span>
    ),
  },
  {
    accessorKey: "reward_interval",
    meta: { mobileLabel: "Интервал вознаграждения" },
    header: () => <span>интервал вознаграждения</span>,
    cell: ({ row }) => (
      <span className="text-sm text-ink-muted">
        {INTERVAL_LABEL[row.original.reward_interval] ??
          row.original.reward_interval}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span />,
    meta: { mobileLabel: "Действия", cellClassName: "flex justify-end" },
    cell: ({ row }) => (
      <button
        type="button"
        aria-label="Изменить"
        onClick={() => onEdit(row.original)}
        className="flex size-9 items-center justify-center rounded-lg border border-grey-3 text-ink transition-colors hover:bg-grey-5"
      >
        <Pencil className="size-4" />
      </button>
    ),
  },
];

/** Таблица правил одной сущности (Друзья / Мастера) с заголовком. */
function RulesSection({
  title,
  rules,
  onEdit,
}: {
  title: string;
  rules: AdminReferralRule[];
  onEdit: (rule: AdminReferralRule) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold leading-tight tracking-tight text-ink">
        {title}
      </h2>

      {rules.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">Нет правил</p>
      ) : (
        <DataTable
          data={rules}
          columns={ruleColumns(onEdit)}
          gridClassName={COLS}
          rowClassName="py-3 text-sm"
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- экран */

export default function LoyaltyPage() {
  const [range, setRange] = usePersistentState<DateRange | undefined>(
    "loyalty.range",
    defaultRange,
  );
  const [tab, setTab] = usePersistentState<Tab>("loyalty.tab", "all");
  const [editing, setEditing] = useState<AdminReferralRule | null>(null);

  const from = range?.from ? toIsoDate(range.from) : "";
  const to = range?.to ? toIsoDate(range.to) : "";

  const { data: stats } = useReferralStats({ from, to });
  const {
    data: rules,
    isLoading: rulesLoading,
    isError: rulesError,
    refetch: refetchRules,
    isFetching: rulesFetching,
  } = useReferralRules();
  const profitQuery = useReferralProfit({ from, to });
  const profit = profitQuery.data;

  const toast = useToast();
  const updateMutation = useUpdateReferralRule();

  const errText = (err: unknown) =>
    err instanceof Error ? err : "Попробуйте ещё раз.";

  const friends = useMemo(
    () => (rules ?? []).filter((r) => r.target_type === "CLIENT"),
    [rules],
  );
  const masters = useMemo(
    () => (rules ?? []).filter((r) => r.target_type === "BUSINESS"),
    [rules],
  );

  const showFriends = tab === "all" || tab === "friends";
  const showMasters = tab === "all" || tab === "masters";

  // Ошибку пробрасываем, чтобы диалог показал её инлайном и не закрылся.
  const saveRule = async (percent: number, interval: string) => {
    if (!editing) return;
    try {
      await updateMutation.mutateAsync({
        ruleId: editing.id,
        body: {
          reward_percent: percent,
          reward_interval: interval as AdminReferralRuleUpdate["reward_interval"],
        },
      });
      toast.success("Правило обновлено");
    } catch (err) {
      toast.error("Не удалось обновить правило", errText(err));
      throw err;
    }
  };

  const totalDelta = formatDelta(stats?.total_referrals_change_percent);
  const ambassadorsDelta = formatDelta(
    stats?.active_ambassadors_change_percent,
  );
  const conversionDelta = formatPointsDelta(
    stats?.conversion_change_percentage_points,
  );

  // Данные графика: дневные точки в ₽ + подписи-даты по индексу дня.
  const points = profit?.points ?? [];
  const chartData: ChartRow[] = points.map((p, i) => ({
    day: i + 1,
    earned: p.earned_amount,
    spent: p.spent_amount,
  }));
  const chartDates = points.map((p) => parseISO(p.date));
  const chartMax = niceCeil(
    Math.max(1, ...points.flatMap((p) => [p.earned_amount, p.spent_amount])),
  );
  const yTicks = [0, 1, 2, 3, 4].map((i) => (chartMax / 4) * i);
  const xLast = Math.max(1, chartData.length);
  const xStep = Math.max(1, Math.ceil(xLast / 6));
  const xTicks = Array.from(
    { length: Math.floor((xLast - 1) / xStep) + 1 },
    (_, i) => 1 + i * xStep,
  );
  const shortDate = (day: number) => {
    const date = chartDates[day - 1];
    return date ? format(date, "d MMM", { locale: ru }) : "";
  };
  const fullDate = (day: number) => {
    const date = chartDates[day - 1];
    return date ? format(date, "d MMMM", { locale: ru }) : "";
  };

  return (
    <>
      <LoyaltyRewardDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.condition_text ?? ""}
        percent={editing?.reward_percent ?? 0}
        interval={editing?.reward_interval ?? "ALL_SERVICES"}
        intervalOptions={INTERVAL_OPTIONS}
        onSave={saveRule}
      />

      <DateFilter value={range} onChange={setRange} />

      {/* KPI-карточки */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Всего рефералов"
          value={formatCount(stats?.total_referrals)}
          delta={totalDelta.text}
          deltaUp={totalDelta.up}
          icon={Users}
        />
        <StatCard
          title="Конверсия рефералов"
          value={
            stats?.conversion_percent == null
              ? "—"
              : `${numberFmt.format(round1(stats.conversion_percent))}%`
          }
          delta={conversionDelta.text}
          deltaUp={conversionDelta.up}
          icon={Users}
        />
        <StatCard
          title="Активные амбассадоры"
          value={formatCount(stats?.active_ambassadors)}
          delta={ambassadorsDelta.text}
          deltaUp={ambassadorsDelta.up}
          icon={Users}
        />
      </div>

      {/* Табы (общий компонент SegmentTabs) */}
      <SegmentTabs value={tab} onChange={setTab} options={TABS} />

      {/* Таблицы правил — «Друзья» и «Мастера» в отдельных блоках */}
      {rulesLoading ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink-muted">
            Загрузка правил…
          </p>
        </Card>
      ) : rulesError ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="text-sm text-ink-muted">Данные не загружены.</span>
            <button
              type="button"
              onClick={() => refetchRules()}
              disabled={rulesFetching}
              className="rounded-lg border border-grey-4 px-3 py-1 text-sm text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
            >
              Повторить
            </button>
          </div>
        </Card>
      ) : (
        <>
          {showFriends && (
            <Card>
              <RulesSection title="Друзья" rules={friends} onEdit={setEditing} />
            </Card>
          )}
          {showMasters && (
            <Card>
              <RulesSection
                title="Мастера"
                rules={masters}
                onEdit={setEditing}
              />
            </Card>
          )}
        </>
      )}

      {/* График */}
      {profitQuery.isError ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="text-sm text-ink-muted">Данные не загружены.</span>
            <button
              type="button"
              onClick={() => profitQuery.refetch()}
              disabled={profitQuery.isFetching}
              className="rounded-lg border border-grey-4 px-3 py-1 text-sm text-ink disabled:opacity-60"
            >Повторить</button>
          </div>
        </Card>
      ) : profitQuery.isLoading ? (
        <Card><p className="py-6 text-center text-sm text-ink-muted">Загрузка графика…</p></Card>
      ) : (
        <MetricChartCard
        title="Выгода программы лояльности"
        subtitle=""
        data={chartData}
        series={CHART_SERIES}
        yDomain={[0, chartMax]}
        yTicks={yTicks}
        xDomain={[1, xLast]}
        xTicks={xTicks}
        formatYTick={formatMoneyShort}
        formatXTick={shortDate}
        formatTooltipValue={(v) => `₽ ${numberFmt.format(v)}`}
        formatTooltipLabel={fullDate}
        />
      )}
    </>
  );
}
