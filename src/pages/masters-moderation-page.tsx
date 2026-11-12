import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteModerationRequests } from "@/lib/api/infinite-lists";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

import {
  AccountCell,
  Card,
  CheckboxFilterMenu,
  CityFilterMenu,
  DataTable,
  MasterProfileDialog,
  ModerationActions,
  PageBackHeader,
  RejectReasonDialog,
  RejectionReasonViewDialog,
  RoleBadge,
  SalonProfileDialog,
  SearchInput,
  SortMenu,
  type AccountRole,
  type SortDir,
} from "@/components";
import { useToast } from "@/components/ui";
import {
  useCitySuggestions,

  useApproveModerationRequest,
  useRejectModerationRequest,
  useProviderProfile,
  type AdminMasterProfile,
  type AdminSalonProfile,
  type ModerationListItem,
  type ModerationReviewer,
  type ModerationStatus,
  type ModerationSubjectType,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 10;

/** Три вкладки очереди модерации; у каждой свой статус и набор колонок. */
const TABS = ["На модерации", "Одобренные", "Отклонённые"] as const;
type Tab = (typeof TABS)[number];

const TAB_STATUS: Record<Tab, ModerationStatus> = {
  "На модерации": "PENDING",
  "Одобренные": "APPROVED",
  "Отклонённые": "REJECTED",
};

/** Роль: API ↔ UI. */
const ROLE_TO_UI: Record<ModerationSubjectType, AccountRole> = {
  MASTER: "master",
  SALON: "salon",
};
const ROLE_TO_API: Record<AccountRole, ModerationSubjectType> = {
  master: "MASTER",
  salon: "SALON",
};

const ROLE_OPTIONS: { value: AccountRole; label: string }[] = [
  { value: "master", label: "Мастер" },
  { value: "salon", label: "Салон" },
];

/** Сетка колонок таблицы — своя для каждой вкладки. */
const GRID: Record<Tab, string> = {
  "На модерации": "grid-cols-[2fr_0.8fr_0.8fr_1fr_1.8fr]",
  "Одобренные": "grid-cols-[1.8fr_0.7fr_0.7fr_1fr_1.4fr]",
  "Отклонённые": "grid-cols-[1.6fr_0.6fr_0.6fr_0.9fr_0.9fr_2.2fr]",
};

/** Подпись колонки даты — своя для каждой вкладки. */
const DATE_LABEL: Record<Tab, string> = {
  "На модерации": "ожидание",
  "Одобренные": "дата одобрения",
  "Отклонённые": "дата отклонения",
};

type Row = {
  requestId: number;
  profileId: number;
  /** Роль в API — для профиля и фильтров. */
  apiRole: ModerationSubjectType;
  role: AccountRole;
  name: string;
  avatar: number | null;
  city: string;
  services: number;
  submittedAt: string;
  reviewedAt: string | null;
  manager: string;
  reason: string;
};

/** Имя админа-обработчика («Одобренные»/«Отклонённые»). */
const managerName = (reviewer: ModerationReviewer | null | undefined): string => {
  if (!reviewer) return "—";
  const full = `${reviewer.first_name ?? ""} ${reviewer.last_name ?? ""}`.trim();
  return full || "—";
};

/** Относительное время подачи, напр. «около 2 часов назад». */
const formatWaiting = (iso: string): string =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });

const formatDate = (iso: string): string => format(new Date(iso), "dd.MM.yyyy");

/** Заявка из API → строка таблицы. */
const toRow = (item: ModerationListItem): Row => ({
  requestId: item.request_id,
  profileId: item.profile_id,
  apiRole: item.role,
  role: ROLE_TO_UI[item.role],
  name: item.name || "Без имени",
  avatar: item.avatar ?? null,
  city: item.city ?? "—",
  services: item.services_count ?? 0,
  submittedAt: item.submitted_at,
  reviewedAt: item.reviewed_at ?? null,
  manager: managerName(item.reviewed_by),
  reason: item.rejection_comment ?? "",
});

/* --------------------------------------------------------------------- экран */

const MastersModerationPage = () => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [sort, setSort] = useState<SortDir | null>(null);

  // Диалоги действий.
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [reasonView, setReasonView] = useState<string | null>(null);
  const [pendingApproveId, setPendingApproveId] = useState<number | null>(null);

  // Просмотр профиля мастера/салона — по клику на имя.
  const [profileTarget, setProfileTarget] = useState<{
    id: number;
    role: ModerationSubjectType;
    variant: AccountRole;
  } | null>(null);
  const profileQuery = useProviderProfile(
    profileTarget?.id ?? null,
    profileTarget?.role ?? null,
  );

  // Поиск городов для фильтра — серверный автокомплит с дебаунсом.
  const [cityQuery, setCityQuery] = useState("");
  const [debouncedCityQuery, setDebouncedCityQuery] = useState("");
  const { data: cityOptions } = useCitySuggestions(debouncedCityQuery);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedCityQuery(cityQuery), 250);
    return () => clearTimeout(id);
  }, [cityQuery]);


  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteModerationRequests(
    {
      status: TAB_STATUS[activeTab],
      role: roles.length ? roles.map((r) => ROLE_TO_API[r]) : undefined,
      city: cities.length ? cities : undefined,
      query: debouncedQuery || undefined,
      sort: sort ? `submitted_at:${sort}` : undefined,

      limit: PAGE_SIZE,
    },
  );

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const { mutateAsync: approveFn } = useApproveModerationRequest();
  const rejectMutation = useRejectModerationRequest();

  /** Текст ошибки из ApiError, иначе — общий фолбэк. */
  const errText = (err: unknown) =>
    err instanceof Error ? err : "Попробуйте ещё раз.";

  const handleApprove = async (requestId: number) => {
    setPendingApproveId(requestId);
    try {
      await approveFn(requestId);
      toast.success("Заявка одобрена");
    } catch (err) {
      toast.error("Не удалось одобрить заявку", errText(err));
    } finally {
      setPendingApproveId(null);
    }
  };

  // Ошибку пробрасываем, чтобы диалог показал её инлайном и не закрылся.
  const handleReject = async (comment: string) => {
    if (rejectTarget === null) return;
    try {
      await rejectMutation.mutateAsync({ requestId: rejectTarget, comment });
      toast.success("Заявка отклонена");
    } catch (err) {
      toast.error("Не удалось отклонить заявку", errText(err));
      throw err;
    }
  };

  // Набор колонок зависит от вкладки; ячейки замыкаются на действия/диалоги.
  const filterValues = useRef({ roles, cities, cityOptions });
  filterValues.current = { roles, cities, cityOptions };
  const roleHeader = useCallback(() => (
    <CheckboxFilterMenu label="роль" options={ROLE_OPTIONS} selected={filterValues.current.roles} onApply={setRoles} allOption />
  ), [setRoles]);
  const cityHeader = useCallback(() => (
    <CityFilterMenu label="город" cities={filterValues.current.cityOptions ?? []} selected={filterValues.current.cities} onApply={setCities} onSearchChange={setCityQuery} />
  ), [setCities]);
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const base: ColumnDef<Row>[] = [
      {
        accessorKey: "name",
        meta: { mobileLabel: "Аккаунт" },
        header: () => <span>аккаунт</span>,
        cell: ({ row }) => (
          <AccountCell
            name={row.original.name}
            avatarId={row.original.avatar}
            subtitle={`${row.original.city} · ${row.original.services} услуг`}
            subtitleClassName="text-sm text-ink-muted"
            onNameClick={() =>
              setProfileTarget({
                id: row.original.profileId,
                role: row.original.apiRole,
                variant: row.original.role,
              })
            }
          />
        ),
      },
      {
        accessorKey: "role",
        meta: { mobileLabel: "Роль", mobileFilter: true },
        header: roleHeader,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "city",
        meta: { mobileLabel: "Город", mobileFilter: true },
        header: cityHeader,
        cell: ({ row }) => <span>{row.original.city}</span>,
      },
      {
        accessorKey: "date",
        meta: { mobileLabel: "Дата", mobileFilter: true },
        header: () => (
          <SortMenu
            label={DATE_LABEL[activeTab]}
            value={sort}
            onChange={(dir) => setSort(dir)}
          />
        ),
        cell: ({ row }) =>
          activeTab === "На модерации" ? (
            <span>{formatWaiting(row.original.submittedAt)}</span>
          ) : (
            <span>
              {row.original.reviewedAt
                ? formatDate(row.original.reviewedAt)
                : "—"}
            </span>
          ),
      },
    ];

    if (activeTab === "На модерации") {
      base.push({
        id: "actions",
        header: () => <span>действия</span>,
        meta: { mobileLabel: "Действия", headerClassName: "text-right", cellClassName: "flex justify-end" },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-3">
            <ModerationActions
              pending={pendingApproveId === row.original.requestId}
              onApprove={() => handleApprove(row.original.requestId)}
              onReject={() => setRejectTarget(row.original.requestId)}
            />
          </div>
        ),
      });
    } else if (activeTab === "Одобренные") {
      base.push({
        accessorKey: "manager",
        meta: { mobileLabel: "Менеджер" },
        header: () => <span>менеджер</span>,
        cell: ({ row }) => <span>{row.original.manager}</span>,
      });
    } else {
      base.push(
        {
          accessorKey: "manager",
          meta: { mobileLabel: "Менеджер" },
          header: () => <span>менеджер</span>,
          cell: ({ row }) => <span>{row.original.manager}</span>,
        },
        {
          id: "reason",
          meta: { mobileLabel: "Причина" },
          header: () => <span>причина</span>,
          cell: ({ row }) => (
            <div className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 flex-1 truncate">
                {row.original.reason || "—"}
              </span>
              {row.original.reason && (
                <button
                  type="button"
                  onClick={() => setReasonView(row.original.reason)}
                  className="shrink-0 text-brand transition-opacity hover:opacity-70"
                >
                  читать
                </button>
              )}
            </div>
          ),
        },
      );
    }

    return base;
  }, [activeTab, roleHeader, cityHeader, sort, pendingApproveId]);


  return (
    <>
      <RejectReasonDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        onSubmit={handleReject}
      />
      <RejectionReasonViewDialog
        open={reasonView !== null}
        onOpenChange={(open) => !open && setReasonView(null)}
        reason={reasonView ?? ""}
      />

      {/* Профиль: салон или мастер по роли строки; данные из useProviderProfile. */}
      <SalonProfileDialog
        key={`salon-${profileTarget?.id}`}
        open={profileTarget?.variant === "salon" && profileQuery.isSuccess}
        onOpenChange={(open) => !open && setProfileTarget(null)}
        profile={profileQuery.data as AdminSalonProfile | undefined}
      />
      <MasterProfileDialog
        key={`master-${profileTarget?.id}`}
        open={profileTarget?.variant === "master" && profileQuery.isSuccess}
        onOpenChange={(open) => !open && setProfileTarget(null)}
        profile={profileQuery.data as AdminMasterProfile | undefined}
      />

      <PageBackHeader title="Очередь модерации" />

      {/* Вкладки */}
      <div className="flex w-full flex-wrap gap-1 rounded-xl border border-grey-4 bg-white p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex min-w-0 flex-1 basis-[180px] items-center justify-center rounded-[10px] px-6 py-2 text-base font-medium tracking-tight transition-colors",
              activeTab === tab
                ? "bg-black/5 text-ink"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Контент вкладки: общий поиск + таблица; набор колонок зависит от вкладки */}
      <Card>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Поиск по имени, названию, причине"
        />

        <div className="mt-9">
          {isLoading ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Загрузка заявок…
            </p>
          ) : isError && !data ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="text-sm text-ink-muted">Данные не загружены.</span>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="rounded-lg border border-grey-4 px-3 py-1 text-sm text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
              >
                Повторить
              </button>
            </div>
          ) : (
            <>
              <div
                className={isFetching ? "opacity-60 transition-opacity" : undefined}
              >
                <DataTable
                  data={rows}
                  columns={columns}
                  gridClassName={cn("grid items-center gap-4", GRID[activeTab])}
                />
              </div>

              <InfiniteScrollSentinel
                hasNextPage={hasNextPage}
                isFetching={isFetching}
                isError={isError}
                onLoadMore={() => isError && !hasNextPage ? refetch() : fetchNextPage()}
              />
            </>
          )}
        </div>
      </Card>
    </>
  );
};

export default MastersModerationPage;
