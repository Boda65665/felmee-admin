import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteBusinessApplications, useInfiniteBusinessComments } from "@/lib/api/infinite-lists";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Card,
  DataTable,
  StatusPill,
  DateFilter,
  SearchInput,
  SegmentTabs,
  CheckboxFilterMenu,
  DocumentReviewDialog,
  type DateRange,
  type StatusPillMeta,
  type DocumentReview,
} from "@/components";
import {
  useAddDocumentAttachments,
  usePutApplicationDocument,
  useRequestBusinessBankVerification,
  type BusinessApplicationCard,

  useBusinessApplication,
  useUpdateBusinessPartner,
  useUpdateBusinessRequisites,
  useSetDocumentDecision,
  useCompleteDocumentsReview,
  type BusinessApplicationKey,
  type BusinessApplicationListItem,
  type BusinessApplicationSource,
  type BusinessApplicationStatus,
  type BusinessType,
  type BusinessBankStatus,
} from "@/lib/api/business-registry";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/lib/use-persistent-state";
import { Avatar } from "@/components/avatar";
import { BUSINESS_BANK_META } from "@/lib/business-bank-status";

/* ------------------------------------------------------------------ данные

  Страница на живом бэкенде (business-registry). По макету 6072-8531: табы =
  источник заявки, карточка с поиском и таблицей; фильтры юр.статуса, даты
  подачи и статуса проверки — в заголовках колонок (KPI/верхнего фильтра
  периода в макете нет).
  -------------------------------------------------------------------------- */

const PAGE_SIZE = 10;

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** `submitted_at` (ISO) → «28.04.2026, 13:00»; при непарсящейся строке — как есть. */
const formatSubmittedAt = (value: string): string => {
  try {
    return format(parseISO(value), "dd.MM.yyyy, HH:mm");
  } catch {
    return value;
  }
};

/** Вкладки раздела = источник заявки. */
const TABS: BusinessApplicationSource[] = ["REFERRAL", "BUSINESS"];
const TAB_LABEL: Record<BusinessApplicationSource, string> = {
  REFERRAL: "Реферальная программа",
  BUSINESS: "Бизнес",
};

/** Юридический статус (business_type) → подпись + классы чипа. */
const LEGAL_LABEL: Record<BusinessType, string> = {
  SE: "Самозанятость",
  IE: "ИП",
  LLC: "ООО",
};
const LEGAL_CLS: Record<BusinessType, string> = {
  SE: "bg-brand/10 text-brand",
  IE: "bg-warning-bg text-warning",
  LLC: "bg-success-bg text-success-fg",
};

const LEGAL_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "SE", label: "Самозанятость" },
  { value: "IE", label: "ИП" },
  { value: "LLC", label: "ООО" },
];

/** Статус проверки заявки → мета пилюли (подпись + цвет). */
const VERIFY_META: Record<BusinessApplicationStatus, StatusPillMeta> = {
  NEW_APPLICATION: {
    label: "Новая заявка",
    cls: "bg-status-blue-bg text-status-blue",
  },
  NEEDS_CLARIFICATION: {
    label: "Нужно уточнение",
    cls: "bg-warning-bg text-warning",
  },
  DOCUMENTS_VERIFIED: {
    label: "Документы проверены",
    cls: "bg-success-bg text-success-fg",
  },
};

const STATUS_OPTIONS: { value: BusinessApplicationStatus; label: string }[] = [
  { value: "NEW_APPLICATION", label: "Новая заявка" },
  { value: "NEEDS_CLARIFICATION", label: "Нужно уточнение" },
  { value: "DOCUMENTS_VERIFIED", label: "Документы проверены" },
];

/** Чип юридического статуса. */
function LegalChip({ type }: { type: BusinessType }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-medium tracking-tight",
        LEGAL_CLS[type],
      )}
    >
      {LEGAL_LABEL[type]}
    </span>
  );
}

/** Bank status comes directly from the list response. */
function BankStatusCell({ application }: { application: BusinessApplicationListItem }) {
  const meta = BUSINESS_BANK_META[application.bank_status];
  return <div data-slot="business-bank-status" className="min-w-0 text-sm">
    {meta ? <div title={meta.label} className={cn("flex max-w-full items-center gap-2", meta.className)}><span className="size-1 shrink-0 rounded-full bg-current" /><span className="min-w-0 truncate">{meta.label}</span></div>
      : <span className="text-ink-muted">—</span>}
  </div>;
}

/* --------------------------------------------------------------------- экран */

const DocumentsPage = () => {
  const [activeTab, setActiveTab] = usePersistentState<BusinessApplicationSource>(
    "documents.tab",
    "REFERRAL",
  );
  const [statuses, setStatuses] = usePersistentState<BusinessApplicationStatus[]>(
    "documents.statuses",
    [],
  );
  const [bankStatusSelection, setBankStatuses] = usePersistentState<BusinessBankStatus[] | BusinessBankStatus | null>("documents.bankStatus", []);
  // Сохраняем одиночный выбор, уже сделанный до обновления интерфейса.
  const bankStatuses = useMemo(() => Array.isArray(bankStatusSelection) ? bankStatusSelection : bankStatusSelection ? [bankStatusSelection] : [], [bankStatusSelection]);
  // API принимает один business_type; слой выборки объединяет выбранные типы.
  const [businessTypes, setBusinessTypes] = usePersistentState<BusinessType[]>(
    "documents.businessTypes",
    [],
  );
  const [submittedRange, setSubmittedRange] = usePersistentState<
    DateRange | undefined
  >("documents.submittedRange", undefined);
  const [query, setQuery] = usePersistentState("documents.query", "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  // Заявка, открытая в модалке просмотра (ключ + мета-шапка из строки).
  const [selected, setSelected] = useState<{
    key: BusinessApplicationKey;
    review: DocumentReview;
  } | null>(null);

  // Дебаунс строки поиска.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const submittedFrom = submittedRange?.from
    ? toIsoDate(submittedRange.from)
    : undefined;
  const submittedTo = submittedRange?.to
    ? toIsoDate(submittedRange.to)
    : undefined;


  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } =
    useInfiniteBusinessApplications({
      source: activeTab,
      business_types: businessTypes,
      statuses: statuses.length ? statuses : undefined,
      bank_statuses: bankStatuses,
      submitted_from: submittedFrom,
      submitted_to: submittedTo,
      search: debouncedQuery || undefined,

      limit: PAGE_SIZE,
    });

  const rows = useMemo(() => data?.items ?? [], [data]);

  // Карточка открытой заявки + комментарии + мутации по ней.
  const bankVerification = useRequestBusinessBankVerification();
  const bankVerificationQueued = bankVerification.data?.action === "QUEUED" &&
    bankVerification.variables?.source === selected?.key.source &&
    bankVerification.variables?.businessType === selected?.key.businessType &&
    bankVerification.variables?.businessEntityId === selected?.key.businessEntityId;
  const cardQuery = useBusinessApplication(selected?.key ?? null, bankVerificationQueued);
  const bankStatus = cardQuery.data?.bank_status;
  const resetBankVerification = bankVerification.reset;
  useEffect(() => {
    if (bankVerificationQueued && bankStatus && bankStatus !== "NOT_SENT" && bankStatus !== "UNDER_REVIEW") {
      resetBankVerification();
    }
  }, [bankVerificationQueued, bankStatus, resetBankVerification]);
  const commentsQuery = useInfiniteBusinessComments(selected?.key ?? null);
  const addAttachments = useAddDocumentAttachments();
  const putDocument = usePutApplicationDocument();
  const updatePartner = useUpdateBusinessPartner();
  const updateRequisites = useUpdateBusinessRequisites();
  const setDecision = useSetDocumentDecision();
  const completeReview = useCompleteDocumentsReview();

  const openReview = (row: BusinessApplicationListItem) => {
    setSelected({
      key: {
        source: row.source,
        businessType: row.business_type,
        businessEntityId: row.business_entity_id,
      },
      review: {
        name: row.partner.name,
        phone: row.partner.phone ?? null,
        submittedAt: formatSubmittedAt(row.submitted_at),
        legalLabel: LEGAL_LABEL[row.business_type],
        legalCls: LEGAL_CLS[row.business_type],
        statusLabel: VERIFY_META[row.status].label,
        statusCls: VERIFY_META[row.status].cls,
      },
    });

  };

  const acceptCard = (card: BusinessApplicationCard, originalKey: BusinessApplicationKey) => {
    setSelected((current) => {
      if (!current || current.key.source !== originalKey.source ||
        current.key.businessType !== originalKey.businessType ||
        current.key.businessEntityId !== originalKey.businessEntityId) return current;
      return {
        key: { source: card.source, businessType: card.business_type, businessEntityId: card.business_entity_id },
        review: {
          name: card.partner.name ?? "—", phone: card.partner.phone,
          submittedAt: formatSubmittedAt(card.submitted_at),
          legalLabel: LEGAL_LABEL[card.business_type], legalCls: LEGAL_CLS[card.business_type],
          statusLabel: VERIFY_META[card.status].label, statusCls: VERIFY_META[card.status].cls,
        },
      };
    });
  };

  const filterValues = useRef({ businessTypes, statuses, submittedRange, bankStatuses });
  filterValues.current = { businessTypes, statuses, submittedRange, bankStatuses };
  const bankStatusHeader = useCallback(() => (
    <CheckboxFilterMenu
      label="проверка банком"
      ariaLabel="Фильтр проверки банком"
      options={(Object.keys(BUSINESS_BANK_META) as BusinessBankStatus[]).map(value => ({ value, label: BUSINESS_BANK_META[value].label }))}
      selected={filterValues.current.bankStatuses}
      onApply={setBankStatuses}
      allOption
    />
  ), [setBankStatuses]);
  const businessTypeHeader = useCallback(() => (
    <CheckboxFilterMenu label="юр. статус" options={LEGAL_OPTIONS} selected={filterValues.current.businessTypes} onApply={setBusinessTypes} />
  ), [setBusinessTypes]);
  const statusHeader = useCallback(() => (
    <CheckboxFilterMenu label="статус проверки заявки" options={STATUS_OPTIONS} selected={filterValues.current.statuses} onApply={setStatuses} />
  ), [setStatuses]);
  const submittedHeader = useCallback(() => (
    <DateFilter variant="header" label="дата подачи док." value={filterValues.current.submittedRange} onChange={setSubmittedRange} />
  ), [setSubmittedRange]);
  const columns: ColumnDef<BusinessApplicationListItem>[] = [
    {
      accessorKey: "partner",
      meta: { mobileLabel: "Партнёр" },
      header: () => <span>партнёр</span>,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.original.partner.name} className="size-11 rounded-xl bg-grey-5 text-sm font-normal text-ink" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <button type="button" title={row.original.partner.name} onClick={() => openReview(row.original)} className="w-fit max-w-full truncate text-left text-base font-semibold text-brand underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-brand">
              {row.original.partner.name}
            </button>
            <span className="truncate text-xs text-ink-muted">{row.original.partner.phone ?? "—"}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "business_type",
      meta: { mobileLabel: "Юр. статус", mobileFilter: true },
      header: businessTypeHeader,
      cell: ({ row }) => <LegalChip type={row.original.business_type} />,
    },
    {
      accessorKey: "submitted_at",
      meta: { mobileLabel: "Дата подачи документов", mobileFilter: true },
      header: submittedHeader,
      cell: ({ row }) => (
        <span className="text-sm text-ink-muted">
          {formatSubmittedAt(row.original.submitted_at)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      meta: { mobileLabel: "Статус", mobileFilter: true },
      header: statusHeader,
      cell: ({ row }) => <StatusPill {...VERIFY_META[row.original.status]} />,
    },
    {
      id: "bank_status",
      header: bankStatusHeader,
      meta: { mobileLabel: "Проверка банком", mobileFilter: true },
      cell: ({ row }) => <BankStatusCell application={row.original} />,
    },
  ];


  const key = selected?.key ?? null;

  return (
    <>
      <DocumentReviewDialog
        key={selected ? `${selected.key.source}:${selected.key.businessType}:${selected.key.businessEntityId}` : "closed"}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        review={selected?.review ?? null}
        card={cardQuery.data}
        loading={cardQuery.isLoading}
        error={cardQuery.isError}
        comments={commentsQuery.data?.items ?? []}
        commentsLoading={commentsQuery.isFetching}
        commentsError={commentsQuery.isError}
        commentsHasNextPage={commentsQuery.hasNextPage}
        onCommentsLoadMore={() => commentsQuery.fetchNextPage()}
        onCommentsRetry={() => { void commentsQuery.refetch(); }}
        onAttachFiles={async (fileIds) => {
          if (!key) throw new Error("Заявка не выбрана");
          acceptCard(await addAttachments.mutateAsync({ key, fileIds }), key);
        }}
        onPutDocument={async (documentType, fileId, expectedRevision) => {
          if (!key) throw new Error("Заявка не выбрана");
          acceptCard(await putDocument.mutateAsync({ key, documentType, body: { file_id: fileId, expected_revision: expectedRevision } }), key);
        }}
        onReloadCard={async () => { await cardQuery.refetch({ throwOnError: true }); }}
        bankVerificationQueued={bankVerificationQueued}
        onBankVerification={async () => {
          if (!key) throw new Error("Заявка не выбрана");
          const result = await bankVerification.mutateAsync(key);
          return result.action;
        }}
        onPartnerSave={async (body) => {
          if (!key) return;
          const updated = await updatePartner.mutateAsync({ key, body });
          acceptCard(updated, key);
        }}
        onRequisitesSave={async (body) => {
          if (key) acceptCard(await updateRequisites.mutateAsync({ key, body }), key);
        }}
        onDocumentDecision={async (fileId, body) => {
          if (key) acceptCard(await setDecision.mutateAsync({ key, fileId, body }), key);
        }}
        onCompleteReview={async () => {
          if (key) acceptCard(await completeReview.mutateAsync({ key }), key);
        }}
      />

      <SegmentTabs
        variant="flat"
        value={activeTab}
        onChange={setActiveTab}
        options={TABS.map((t) => ({
          value: t,
          label: TAB_LABEL[t],
          badge: t === activeTab ? data?.total : undefined,
        }))}
      />

      <Card className="flex flex-col gap-8 md:min-h-[min(756px,calc(100dvh-100px))]">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Поиск по имени, ИНН"
          className="max-w-[547px]"
        />

        {isLoading ? (
          <p className="py-10 text-center text-base text-ink-muted">
            Загрузка заявок…
          </p>
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
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
                headerRowClassName="border-b-0 pb-5"
                gridClassName="grid grid-cols-[minmax(0,1.65fr)_minmax(0,.9fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.25fr)] items-center gap-6 px-4"
                rowClassName="mb-3 rounded-2xl border !border-b border-grey-4 md:py-[22px]"
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
      </Card>
    </>
  );
};

export default DocumentsPage;
