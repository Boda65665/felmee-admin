import { ErrorPopup } from "@/components/error-popup";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteReferralPartners } from "@/lib/api/infinite-lists";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Users } from "lucide-react";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Card,
  StatCard,
  DataTable,
  StatusPill,
  DateFilter,
  AccountCell,
  SearchInput,
  SegmentTabs,
  CheckboxFilterMenu,
  PartnerInfoDialog,
  type DateRange,
} from "@/components";
import { useToast } from "@/components/ui";
import {
  useReferralPartnerSummary,
  useReferralSystemLevels,
  useUpdateReferralLevelRate,
  type AdminReferralPartnerItem,
  type AdminReferralSystemLevel,
  type ReferralPartnerStatus,
  type ReferralLevelCode,
  type ReferralTarget,
} from "@/lib/api";
import { formatMillions } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ данные

  Полностью на admin-API рефералки: 3 KPI ← partners/summary, вкладка
  «Партнёры» ← partners (+ карточка партнёра с приглашёнными), вкладка
  «Уровни и ставки» ← levels + PATCH. Демо-вкладки «Рефералы» и «Проверка
  документов» убраны — admin-эндпоинтов под них нет.
  -------------------------------------------------------------------------- */

const numberFmt = new Intl.NumberFormat("ru-RU");

const round1 = (value: number) => Math.round(value * 10) / 10;

const formatCount = (value: number | undefined) =>
  value == null ? "—" : numberFmt.format(value);

/** Крупная сумма в ₽: ≥1 млн — «N,N млн ₽», иначе — «N ₽». */
const formatAccruedMln = (rub: number | undefined) => {
  if (rub == null) return "—";
  if (rub >= 1_000_000) return `${formatMillions(rub / 1_000_000)} млн ₽`;
  return `${numberFmt.format(rub)} ₽`;
};

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Дельта к прошлому периоду: текст со знаком + направление для бейджа. */
const formatDelta = (
  percent: number | null | undefined,
): { text?: string; up?: boolean } => {
  if (percent == null) return {};
  const v = round1(percent);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return { text: `${sign}${numberFmt.format(Math.abs(v))}%`, up: v >= 0 };
};

const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
};

/** Вкладки раздела (из макета 5580-13173 / 5643-5321). */
const TABS = ["Партнёры", "Уровни и ставки"] as const;
type Tab = (typeof TABS)[number];

/** Тон уровня: 1 — зелёный, 2 — синий, 3 — фиолетовый, 4 — оранжевый. */
type LevelTone = "green" | "blue" | "purple" | "orange";

/** Классы пилюли уровня — цветной текст на приглушённом фоне того же цвета. */
const LEVEL_TONE_CLS: Record<LevelTone, string> = {
  green: "bg-success/10 text-success",
  blue: "bg-[#3b82f6]/10 text-[#3b82f6]",
  purple: "bg-[#7c3aed]/10 text-[#7c3aed]",
  orange: "bg-warning/10 text-warning",
};

/** Тон по названию уровня (полные и краткие формы). */
const LEVEL_TONE_BY_NAME: Record<string, LevelTone> = {
  Старт: "green",
  Развитие: "blue",
  Профессиональный: "purple",
  Профи: "purple",
  Стратегический: "orange",
  Стратег: "orange",
};

/** Коды уровней линии (API) → русские подписи для фильтра. */
const LEVEL_CODE_OPTIONS: { value: ReferralLevelCode; label: string }[] = [
  { value: "START", label: "Старт" },
  { value: "DEVELOPMENT", label: "Развитие" },
  { value: "PROFESSIONAL", label: "Профессиональный" },
  { value: "STRATEGIC", label: "Стратегический" },
];

/** Тон пилюли по коду уровня. */
const LEVEL_TONE_BY_CODE: Record<string, LevelTone> = {
  START: "green",
  DEVELOPMENT: "blue",
  PROFESSIONAL: "purple",
  STRATEGIC: "orange",
};

/** Статусы партнёра для фильтра. */
const STATUS_OPTIONS: { value: ReferralPartnerStatus; label: string }[] = [
  { value: "ACTIVE", label: "Активен" },
  { value: "INACTIVE", label: "Неактивен" },
];

/** Чип уровня «Название • N%» — тон по level_code (фолбэк — по названию). */
function LevelChip({ level }: { level: AdminReferralSystemLevel }) {
  const tone =
    LEVEL_TONE_BY_CODE[level.level_code] ??
    LEVEL_TONE_BY_NAME[level.title] ??
    "purple";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium tracking-tight",
        LEVEL_TONE_CLS[tone],
      )}
    >
      {level.title} • {level.reward_percent}%
    </span>
  );
}

/* --------------------------------------------------- вкладка «Уровни и ставки» */

/** Карточка уровня: название + редактируемая ставка + «Сохранить» (PATCH). */
function LevelCard({
  level,
  onSave,
}: {
  level: AdminReferralSystemLevel;
  onSave: (percent: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(level.reward_percent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);

  const dirty = value.trim() !== String(level.reward_percent);
  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= 100;

  const save = async () => {
    if (!valid || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(parsed);
    } catch (err) {
      setError(err instanceof Error ? err : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const tone = LEVEL_TONE_BY_CODE[level.level_code] ?? "purple";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-grey-4 bg-white p-4">
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
          LEVEL_TONE_CLS[tone],
        )}
      >
        {level.title}
      </span>

      <div className="mt-auto flex flex-col gap-1.5">
        <span className="text-xs text-ink-muted">Ставка, %</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 min-w-0 w-full rounded-xl border border-grey-3 bg-white px-3 text-base text-ink outline-none transition-colors focus:border-brand"
          />
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !valid || saving}
            className="h-11 shrink-0 cursor-pointer rounded-xl border border-grey-3 px-4 text-sm font-medium text-ink transition-colors hover:bg-grey-5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
        <ErrorPopup error={error} onDismiss={() => setError(null)} />
      </div>
    </div>
  );
}

/** Секция линии с карточками уровней. */
function LevelSection({
  title,
  levels,
  onSave,
}: {
  title: string;
  levels: AdminReferralSystemLevel[];
  onSave: (level: AdminReferralSystemLevel, percent: number) => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
      {levels.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {levels.map((level) => (
            <LevelCard
              key={level.level_code}
              level={level}
              onSave={(percent) => onSave(level, percent)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Уровни не заданы.</p>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------- экран */

const ReferralProgramPage = () => {
  const [range, setRange] = useState<DateRange | undefined>(defaultRange);
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [query, setQuery] = useState("");
  // Выбранный партнёр для модалки «Информация о партнёре» (partners/{id}).
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<ReferralPartnerStatus[]>([]);
  const [clientLevel, setClientLevel] = useState<ReferralLevelCode[]>([]);
  const [businessLevel, setBusinessLevel] = useState<ReferralLevelCode[]>([]);
  const LIMIT = 20;

  const from = range?.from ? toIsoDate(range.from) : "";
  const to = range?.to ? toIsoDate(range.to) : "";

  // Дебаунс поискового запроса (300мс) → серверный search.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);


  const { data: summary } = useReferralPartnerSummary({ from, to });
  const partnersQuery = useInfiniteReferralPartners({
    from,
    to,
    search: debouncedQuery || undefined,
    statuses: statusFilter,
    client_level_codes: clientLevel,
    business_level_codes: businessLevel,
    limit: LIMIT,
  });
  const partners = partnersQuery.data?.items ?? [];
  const levelsQuery = useReferralSystemLevels();
  const updateLevel = useUpdateReferralLevelRate();
  const toast = useToast();

  const clientLevels = levelsQuery.data?.client_line.levels ?? [];
  const businessLevels = levelsQuery.data?.business_line.levels ?? [];

  const saveRate = async (
    targetType: ReferralTarget,
    level: AdminReferralSystemLevel,
    percent: number,
  ) => {
    try {
      await updateLevel.mutateAsync({
        targetType,
        levelCode: level.level_code,
        reward_percent: percent,
      });
      toast.success("Ставка сохранена");
    } catch (err) {
      toast.error(
        "Не удалось сохранить ставку",
        err instanceof Error ? err : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  const filterValues = useRef({ clientLevel, businessLevel, statusFilter });
  filterValues.current = { clientLevel, businessLevel, statusFilter };
  const clientLevelHeader = useCallback(() => (
    <CheckboxFilterMenu label="уровень клиента" options={LEVEL_CODE_OPTIONS} selected={filterValues.current.clientLevel} onApply={setClientLevel} />
  ), []);
  const businessLevelHeader = useCallback(() => (
    <CheckboxFilterMenu label="уровень бизнеса" options={LEVEL_CODE_OPTIONS} selected={filterValues.current.businessLevel} onApply={setBusinessLevel} />
  ), []);
  const statusHeader = useCallback(() => (
    <CheckboxFilterMenu label="статус" options={STATUS_OPTIONS} selected={filterValues.current.statusFilter} onApply={setStatusFilter} />
  ), []);

  const partnerColumns: ColumnDef<AdminReferralPartnerItem>[] = [
    {
      accessorKey: "name",
      meta: { mobileLabel: "Аккаунт" },
      header: () => <span>партнёр</span>,
      cell: ({ row }) => (
        <AccountCell
          name={row.original.name}
          subtitle=""
          onNameClick={() =>
            setSelectedPartnerId(row.original.referral_user_id)
          }
        />
      ),
    },
    {
      id: "client_level",
      meta: { mobileLabel: "Уровень клиента", mobileFilter: true },
      header: clientLevelHeader,
      cell: ({ row }) => <LevelChip level={row.original.levels.client} />,
    },
    {
      id: "business_level",
      meta: { mobileLabel: "Уровень бизнеса", mobileFilter: true },
      header: businessLevelHeader,
      cell: ({ row }) => <LevelChip level={row.original.levels.business} />,
    },
    {
      accessorKey: "referrals_count",
      meta: { mobileLabel: "Рефералы" },
      header: () => <span>рефералы</span>,
      cell: ({ row }) => <span>{row.original.referrals_count}</span>,
    },
    {
      accessorKey: "total_accrued_rub",
      meta: { mobileLabel: "Всего начислено" },
      header: () => <span>всего начислено</span>,
      cell: ({ row }) => (
        <span>{numberFmt.format(row.original.total_accrued_rub)} ₽</span>
      ),
    },
    {
      accessorKey: "status",
      meta: { mobileLabel: "Статус", mobileFilter: true },
      header: statusHeader,
      cell: ({ row }) =>
        row.original.status === "ACTIVE" ? (
          <StatusPill label="Активен" cls="bg-success-bg text-success-fg" />
        ) : (
          <StatusPill label="Неактивен" cls="bg-warning-bg text-warning" info />
        ),
    },
  ];

  return (
    <>
      <PartnerInfoDialog
        key={`${selectedPartnerId}-${from}-${to}`}
        open={selectedPartnerId !== null}
        onOpenChange={(open) => !open && setSelectedPartnerId(null)}
        partnerId={selectedPartnerId}
        from={from || undefined}
        to={to || undefined}
      />

      <DateFilter value={range} onChange={setRange} />

      {/* KPI из partners/summary (живые): активные/неактивные партнёры + сумма. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Активные партнёры"
          value={formatCount(summary?.active_partners_count)}
          delta={formatDelta(summary?.active_partners_change_percent).text}
          deltaUp={formatDelta(summary?.active_partners_change_percent).up}
          icon={Users}
          tone="brand"
        />
        <StatCard
          title="Общая сумма вознаграждений"
          value={formatAccruedMln(summary?.total_accrued_rub)}
          delta={formatDelta(summary?.total_accrued_change_percent).text}
          deltaUp={formatDelta(summary?.total_accrued_change_percent).up}
          icon={CreditCard}
          tone="success"
        />
        <StatCard
          title="Неактивные партнёры"
          value={formatCount(summary?.inactive_partners_count)}
          delta={formatDelta(summary?.inactive_partners_change_percent).text}
          deltaUp={formatDelta(summary?.inactive_partners_change_percent).up}
          icon={Users}
          tone="warning"
        />
      </div>

      {/* Вкладки (общий компонент SegmentTabs, как на «Программе лояльности») */}
      <SegmentTabs
        value={activeTab}
        onChange={setActiveTab}
        options={TABS.map((tab) => ({ value: tab, label: tab }))}
      />

      <Card>
        {activeTab === "Партнёры" && (
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Поиск по имени партнёра"
              className="max-w-[547px]"
            />
            {partnersQuery.isLoading ? (
              <p className="py-8 text-center text-ink-muted">Загрузка партнёров…</p>
            ) : partnersQuery.isError && !partnersQuery.data ? (
              <div className="mt-9 text-sm text-ink-muted"><button type="button" onClick={() => partnersQuery.refetch()} disabled={partnersQuery.isFetching} className="ml-3 underline">Повторить</button>
              </div>
            ) : (
              <div className="mt-9 flex flex-col gap-4">
                <DataTable
                  data={partners}
                  columns={partnerColumns}
                  gridClassName="grid grid-cols-[2fr_1.1fr_1.1fr_0.8fr_1.1fr_1fr] items-center gap-4"
                />
                <InfiniteScrollSentinel
                  hasNextPage={partnersQuery.hasNextPage}
                  isFetching={partnersQuery.isFetching}
                  isError={partnersQuery.isError}
                  onLoadMore={() => partnersQuery.isError && !partnersQuery.hasNextPage ? partnersQuery.refetch() : partnersQuery.fetchNextPage()}
                />
              </div>
            )}
          </>
        )}

        {activeTab === "Уровни и ставки" && (
          <div className="flex flex-col gap-8">
            {levelsQuery.isLoading ? (
              <p className="py-8 text-center text-base text-ink-muted">
                Загрузка уровней…
              </p>
            ) : levelsQuery.isError ? (
              <span className="text-sm text-ink-muted">Данные не загружены.</span>
            ) : (
              <>
                <LevelSection
                  title="Клиентская линия"
                  levels={clientLevels}
                  onSave={(level, percent) => saveRate("CLIENT", level, percent)}
                />
                <LevelSection
                  title="Бизнес линия"
                  levels={businessLevels}
                  onSave={(level, percent) =>
                    saveRate("BUSINESS", level, percent)
                  }
                />
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
};

export default ReferralProgramPage;
