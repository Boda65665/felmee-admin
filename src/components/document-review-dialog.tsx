import { businessPartnerSchema as partnerSchema, type BusinessPartnerForm as PartnerForm } from "@/lib/business-partner-form";
import { useEffect, useId, useRef, useState } from "react";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";
import {
  X,
  Clock,
  Download,
  FileText,
  CheckCheck,
  Plus,
} from "lucide-react";
import type { ComponentType } from "react";
import { format, parseISO } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Dialog, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import documentPdf from "@/assets/document-pdf.svg";
import documentDownload from "@/assets/document-download.svg";
import documentBankRefresh from "@/assets/document-bank-refresh.svg";
import {
  ApiError,
  useFileUrl,
  type BusinessApplicationCard,
  type BusinessApplicationComment,
  type BusinessApplicationDocument,
  type BusinessApplicationPartnerUpdate,
  type BusinessApplicationRequisitesUpdate,
  type BusinessApplicationDocumentDecision,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { BUSINESS_BANK_META, BALANCE_TRANSFER_META, isBeneficiaryMigrationLocked, isBusinessApplicationConfirmed } from "@/lib/business-bank-status";
import { formatRubles } from "@/lib/format";
import { ErrorPopup } from "./error-popup";
import { useErrorPopupStore } from "@/lib/error-popup-store";
import { buildBusinessPatch, buildBusinessPartnerPatch, documentReviewBlockReason, documentReviewCompleteBlockReason } from "@/lib/api/business-registry";
import { useDocumentRequirements, useDocumentHistory, type RegistrationDocumentType } from "@/lib/api/business-registry";
import { DOCUMENT_TYPE_LABELS, typeChangeFiles, type DocumentDrafts } from "@/lib/document-types";
import { uploadFile, getFileStatus, getDocumentBlob, isProtectedFileUrl, useDocumentFile } from "@/lib/api/files";
import { initials } from "./avatar";
import { ModalShell } from "./modal-shell";
import { SegmentTabs } from "./segment-tabs";
import { Field, TextAreaField } from "./profile-form";

/* ------------------------------------------------------------------ данные */

/** Данные партнёра для шапки модалки (из строки таблицы, мгновенно). */
export type DocumentReview = {
  name: string;
  phone: string | null;
  submittedAt: string;
  /** Юр. статус — подпись + классы чипа. */
  legalLabel: string;
  legalCls: string;
  /** Статус проверки — подпись + классы пилюли. */
  statusLabel: string;
  statusCls: string;
};

const TABS = ["partner", "documents", "requisites", "comments"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  partner: "Данные партнёра",
  documents: "Документы",
  requisites: "Реквизиты",
  comments: "Комментарии",
};

const FOOTER_SECONDARY = "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-grey-4 px-4 text-sm font-medium text-ink transition-colors hover:bg-grey-5 sm:min-h-10";
const FOOTER_PRIMARY = "flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:bg-brand/40 sm:min-h-10";


/** Дата комментария `created_at` (ISO) → «28.04.2026, 13:00». */
const formatCommentDate = (value: string): string => {
  try {
    return format(parseISO(value), "dd.MM.yyyy, HH:mm");
  } catch {
    return value;
  }
};

type DocStatus = BusinessApplicationDocument["status"];
const DOC_STATUS_META: Record<
  DocStatus,
  { label: string; cls: string; icon: ComponentType<{ className?: string }> }
> = {
  APPROVED: { label: "Проверен", cls: "text-success", icon: CheckCheck },
  REUPLOAD_REQUIRED: {
    label: "Уточнение",
    cls: "text-warning",
    icon: Clock,
  },
  PENDING: { label: "Новый документ", cls: "text-status-blue", icon: Plus },
};

/** Черновое решение администратора → короткая подпись. */
const DRAFT_LABEL: Record<
  NonNullable<BusinessApplicationDocument["draft_decision"]>,
  string
> = {
  APPROVE: "черновик: подтверждён",
  REQUEST_REUPLOAD: "черновик: перезагрузка",
};

/** Юр. статус → подпись для селекта. */
const BUSINESS_TYPE_OPTIONS: { value: PartnerForm["business_type"]; label: string }[] = [
  { value: "SE", label: "Самозанятость" },
  { value: "IE", label: "ИП" },
  { value: "LLC", label: "ООО" },
];

const digits = (len: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${len}}$`), `${len} цифр`)
    .or(z.literal(""))
    .optional();

/** Схема формы банковских реквизитов. */
const requisitesSchema = z.object({
  recipient_name: z.string().trim().optional(),
  bank_name: z.string().trim().optional(),
  bik: digits(9),
  settlement_account: digits(20),
  correspondent_account: digits(20),
  comment: z.string().trim().optional(),
});
type RequisitesForm = z.infer<typeof requisitesSchema>;

/** Человекочитаемый размер файла. */
const formatSize = (bytes: number | null | undefined): string => {
  if (bytes == null) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** Короткая метка типа файла (PDF / JPG …). */
const fileKind = (contentType: string | null | undefined): string => {
  if (!contentType) return "Файл";
  const sub = contentType.split("/")[1] ?? "";
  if (sub.includes("pdf")) return "PDF";
  if (sub.startsWith("jp") || sub === "png" || sub === "webp")
    return sub.replace("jpeg", "jpg").toUpperCase();
  return sub.toUpperCase() || "Файл";
};

/* ------------------------------------------------------------------ части UI */

/** Пилюля статуса в шапке (юр. статус / статус проверки). */
function HeaderChip({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-medium tracking-tight",
        cls,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="min-w-0 break-words text-base font-semibold tracking-tight text-ink">{children}</h3>
  );
}

/** Строка загруженного документа: иконка, имя, статус/черновик, действия. */
function DocRow({
  doc,
  onView,
}: {
  doc: BusinessApplicationDocument;
  onView: () => void;
}) {
  const meta = DOC_STATUS_META[doc.status];
  const StatusIcon = meta.icon;
  const { data: file } = useFileUrl(doc.file_id, "FULL");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const downloadOriginal = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      if (file?.url && !isProtectedFileUrl(file.url)) {
        const link = document.createElement("a");
        link.href = file.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download = doc.filename;
        link.click();
        return;
      }
      const blob = await getDocumentBlob(doc.file_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setDownloading(false);
    }
  };
  const parts = [fileKind(doc.content_type), formatSize(doc.size_bytes)].filter(
    Boolean,
  );
  return (
    <div data-slot="document-file-row" className="flex min-w-0 flex-wrap items-center gap-3 rounded border border-grey-4 p-3">
      {doc.content_type === "application/pdf" ? <img src={documentPdf} alt="" className="shrink-0" /> : <FileText className="size-8 shrink-0 text-ink-muted" />}
      <div className="flex min-w-0 flex-1 basis-[calc(100%-4rem)] flex-col sm:basis-0">
        <button type="button" onClick={onView} title={doc.filename} className="w-fit max-w-full truncate text-left text-sm font-medium text-brand underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand">
          {doc.filename}
        </button>
        <span className="text-xs text-ink-muted">{doc.document_type ? DOCUMENT_TYPE_LABELS[doc.document_type] : "Документ"}{doc.revision ? ` · Версия ${doc.revision}` : ""}</span>
        <span className="text-xs text-ink-muted">{parts.join(" · ")}</span>
      </div>
      <span
        className={cn(
          "mr-auto inline-flex min-w-0 items-center gap-1 text-sm font-medium sm:ml-auto sm:mr-0",
          meta.cls,
        )}
      >
        <StatusIcon className="size-4" />
        {doc.draft_decision ? DRAFT_LABEL[doc.draft_decision] : meta.label}
      </span>
      <button
        type="button"
        aria-label="Скачать документ"
        onClick={() => void downloadOriginal()}
        disabled={!file?.url || downloading}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl border border-grey-4 text-ink transition-colors hover:bg-grey-5 sm:size-[38px]",
          !file?.url && "pointer-events-none opacity-40",
        )}
      >
        <img src={documentDownload} alt="" />
      </button>
      <ErrorPopup error={downloadError} title="Не удалось скачать файл" onDismiss={() => setDownloadError(null)} />
    </div>
  );
}

/** Предпросмотр документа; решение доступно только для новой заявки и PENDING. */
function DocPreview({
  doc,
  applicationStatus,
  onDecision,
  onBack,
  readOnly = false,
}: {
  doc: BusinessApplicationDocument;
  applicationStatus: BusinessApplicationCard["status"];
  onDecision: (body: BusinessApplicationDocumentDecision) => Promise<void>;
  onBack: () => void;
  readOnly?: boolean;
}) {
  const { data: file, isError: fileError, refetch: reloadFile } = useDocumentFile(doc.file_id);
  const [reupload, setReupload] = useState(false);
  const [comment, setComment] = useState(doc.draft_comment ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const isImage = (doc.content_type ?? "").startsWith("image/");
  const isPdf = doc.content_type === "application/pdf";
  const blockedReason = documentReviewBlockReason(applicationStatus, doc.status);
  const blockedHintId = useId();

  const submit = async (decision: BusinessApplicationDocumentDecision["decision"]) => {
    if (readOnly || blockedReason) return;
    setError(null);
    setPending(true);
    try {
      await onDecision({
        decision,
        comment: decision === "REQUEST_REUPLOAD" ? comment.trim() : undefined,
      });
      onBack();
    } catch (e) {
      setError(e instanceof ApiError ? e : "Не удалось сохранить решение");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>{doc.filename}</SectionTitle>
      <div className={cn("flex min-h-[360px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-grey-5 text-center", isPdf && file?.url ? "p-0" : "p-6")}>
        {isImage && file?.url ? (
          <img
            src={file.url}
            alt={doc.filename}
            className="max-h-[360px] max-w-full rounded-xl object-contain"
          />
        ) : isPdf && file?.url ? (
          <iframe
            src={`${file.url.split("#")[0]}#toolbar=0&navpanes=0&view=FitH`}
            title={doc.filename}
            className="h-[min(60dvh,560px)] w-full rounded-xl border-0"
          />
        ) : (
          <>
            <FileText className="size-10 text-ink-muted" />
            <p className="max-w-sm text-sm text-ink-muted">
              {fileError
                ? "Не удалось загрузить файл."
                : file?.status === "FAILED"
                ? "Не удалось обработать файл."
                : file?.url
                ? "Предпросмотр недоступен — откройте файл по кнопке скачивания."
                : "Загрузка файла…"}
            </p>
            {fileError && <button type="button" onClick={() => void reloadFile()} className="text-sm text-brand underline">Повторить</button>}
          </>
        )}
      </div>
      {file?.url && (
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-brand underline">
          <Download className="size-4" />Открыть оригинал файла
        </a>
      )}

      {reupload && !blockedReason && !readOnly && (
        <TextAreaField
          label="Что не так с документом"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Уточните, какой документ нечитаемый или не соответствует требованиям…"
          rows={3}
        />
      )}
      <ErrorPopup error={error} onDismiss={() => setError(null)} />
      {!readOnly && blockedReason && <p id={blockedHintId} role="status" className="text-sm text-ink-muted">{blockedReason}</p>}

      <div className={cn("grid w-full grid-cols-1 gap-3", !readOnly && "sm:grid-cols-3")}>
        {!readOnly && <>
        <button
          type="button"
          onClick={() => submit("APPROVE")}
          disabled={pending || Boolean(blockedReason)}
          aria-describedby={blockedReason ? blockedHintId : undefined}
          title={blockedReason ?? undefined}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-success text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Сохранение…" : "Подтвердить"}
        </button>
        <button
          type="button"
          onClick={() =>
            reupload ? submit("REQUEST_REUPLOAD") : setReupload(true)
          }
          disabled={pending || Boolean(blockedReason) || (reupload && comment.trim() === "")}
          aria-describedby={blockedReason ? blockedHintId : undefined}
          title={blockedReason ?? undefined}
          className="flex h-12 flex-1 items-center justify-center rounded-full border border-grey-2 text-base font-medium text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
        >
          Запросить перезагрузку
        </button>
        </>}
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="flex h-12 flex-1 items-center justify-center rounded-full border border-grey-2 text-base font-medium text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
        >
          Назад
        </button>
      </div>
    </div>
  );
}

/** Одна карточка комментария к заявке (автор + дата + текст). */
function CommentCard({ comment }: { comment: BusinessApplicationComment }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-grey-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <span className="text-base font-medium text-ink">
          {comment.author.name}
        </span>
        <span className="shrink-0 text-xs text-ink-muted">
          {formatCommentDate(comment.created_at)}
        </span>
      </div>
      <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-[1.5] text-ink">
        {comment.comment}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ модалка */

/**
 * Модалка просмотра заявки Business Registry (открывается по имени в таблице
 * «Документы»). Четыре вкладки: данные партнёра (правка), документы (решение по
 * каждому файлу + завершение проверки), банковские реквизиты (правка) и
 * комментарии (read-only история). Шапка заполняется мгновенно из строки
 * (`review`), тело — из карточки `card`.
 */
export function DocumentReviewDialog({
  open,
  onOpenChange,
  review,
  card,
  loading,
  error,
  comments,
  commentsLoading,
  commentsError,
  commentsHasNextPage,
  onCommentsLoadMore,
  onCommentsRetry,
  onAttachFiles,
  onPutDocument,
  onReloadCard,
  bankVerificationQueued = false,
  onBankVerification,
  onPartnerSave,
  onRequisitesSave,
  onDocumentDecision,
  onCompleteReview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: DocumentReview | null;
  card: BusinessApplicationCard | undefined;
  loading: boolean;
  error: boolean;
  comments: BusinessApplicationComment[];
  commentsLoading: boolean;
  commentsError: boolean;
  commentsHasNextPage: boolean;
  onCommentsLoadMore: () => unknown;
  onCommentsRetry: () => void;
  onAttachFiles: (fileIds: number[]) => Promise<void>;
  onPutDocument: (type: RegistrationDocumentType, fileId: number, expectedRevision: number) => Promise<void>;
  onReloadCard: () => Promise<void>;
  bankVerificationQueued?: boolean;
  onBankVerification: () => Promise<"QUEUED" | "ALREADY_CURRENT">;
  onPartnerSave: (body: BusinessApplicationPartnerUpdate) => Promise<void>;
  onRequisitesSave: (body: BusinessApplicationRequisitesUpdate) => Promise<void>;
  onDocumentDecision: (
    fileId: number,
    body: BusinessApplicationDocumentDecision,
  ) => Promise<void>;
  onCompleteReview: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("partner");
  // Файл, открытый в предпросмотре (клик по «глазу» в списке) либо null — список.
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | Error | null>(null);
  const [completing, setCompleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<RegistrationDocumentType | "ADDITIONAL">("ADDITIONAL");
  const [uploadRevision, setUploadRevision] = useState(0);
  const [uploadSelection, setUploadSelection] = useState<File[]>([]);
  const [uploadConflict, setUploadConflict] = useState(false);
  const [typeDrafts, setTypeDrafts] = useState<DocumentDrafts>({});
  const [typeUploads, setTypeUploads] = useState<Partial<Record<RegistrationDocumentType, string>>>({});
  const hasUploads = uploading || Object.keys(typeUploads).length > 0;
  const [historyType, setHistoryType] = useState<RegistrationDocumentType | null>(null);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyPreview, setHistoryPreview] = useState<BusinessApplicationDocument | null>(null);
  const uploadGeneration = useRef(0);
  useEffect(() => () => { uploadGeneration.current++; }, []);
  const [bankPending, setBankPending] = useState(false);
  const [bankAlreadyCurrent, setBankAlreadyCurrent] = useState(false);
  const bankQueued = bankVerificationQueued && card?.bank_status === "NOT_SENT";
  const migrationLocked = isBeneficiaryMigrationLocked(card?.balance_transfer_status);
  const bankProcessing = bankQueued || card?.bank_status === "UNDER_REVIEW" || migrationLocked;
  const confirmed = isBusinessApplicationConfirmed(card);
  const transferMeta = card?.balance_transfer_status ? BALANCE_TRANSFER_META[card.balance_transfer_status] : null;
  const bankStatusMeta = card?.bank_status === "VERIFIED" && !confirmed
    ? { label: "Ожидается перенос остатка", className: "text-status-blue" }
    : BUSINESS_BANK_META[bankQueued ? "UNDER_REVIEW" : card?.bank_status ?? "NOT_SENT"];
  const bankMessage = bankQueued ? "Проверка банка поставлена в очередь"
    : bankAlreadyCurrent && confirmed ? "Подтверждённые банком данные актуальны" : null;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open || !card?.bank_error_code) return;
    console.warn("[documents] Ошибка проверки банком", {
      code: card.bank_error_code,
      source: card.source,
      businessType: card.business_type,
      businessEntityId: card.business_entity_id,
    });
  }, [open, card?.bank_error_code, card?.source, card?.business_type, card?.business_entity_id]);

  const partnerForm = useForm<PartnerForm>({
    resolver: zodResolver(partnerSchema),
  });
  const requisitesForm = useForm<RequisitesForm>({
    resolver: zodResolver(requisitesSchema),
  });
  const selectedBusinessType = partnerForm.watch("business_type");
  const applicationKey = card ? { source: card.source, businessType: card.business_type, businessEntityId: card.business_entity_id } : null;
  const changingType = Boolean(card && selectedBusinessType && selectedBusinessType !== card.business_type);
  const requirements = useDocumentRequirements(applicationKey, changingType ? selectedBusinessType : undefined, open && changingType);
  const currentRequirements = useDocumentRequirements(applicationKey, undefined, open && uploadOpen);
  const history = useDocumentHistory(open ? applicationKey : null, historyType, historyOffset);
  const typeFilesComplete = Boolean(!changingType || !requirements.isFetching && !requirements.isError && requirements.data && requirements.data.business_type === selectedBusinessType && requirements.data.required_documents.every(item => !item.needs_upload || typeDrafts[item.document_type]));

  // Сброс вкладки/предпросмотра при открытии.
  if (open && !wasOpen.current) {
    setTab("partner");
    setPreviewId(null);
    setFormError(null);
    setBankAlreadyCurrent(false);
  }
  wasOpen.current = open;

  // Предзаполнение форм, когда подъехала карточка.
  useEffect(() => {
    if (!card) return;
    partnerForm.reset({
      full_name: card.partner.name ?? "",
      inn: card.partner.inn ?? "",
      phone: card.partner.phone ?? "",
      email: card.partner.email ?? "",
      activity_type: card.partner.activity_type ?? "",
      business_type: card.business_type,
      comment: "",
      identity: card.partner.identity ? {
        registration_address: card.partner.identity.registration_address,
        passport_series: card.partner.identity.passport_series,
        passport_number: card.partner.identity.passport_number,
        birth_date: card.partner.identity.birth_date,
        passport_issue_date: card.partner.identity.passport_issue_date,
        department_code: card.partner.identity.department_code,
        birth_place: card.partner.identity.birth_place,
      } : undefined,
    });
    requisitesForm.reset({
      recipient_name: card.requisites?.recipient_name ?? "",
      bank_name: card.requisites?.bank_name ?? "",
      bik: card.requisites?.bik ?? "",
      settlement_account: card.requisites?.settlement_account ?? "",
      correspondent_account: card.requisites?.correspondent_account ?? "",
      comment: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.partner, card?.requisites, card?.business_type]);

  if (!review) return null;

  const savePartner = partnerForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (!card) return;
      if (hasUploads) return;
      if (bankProcessing) {
        setFormError("Дождитесь завершения проверки банком, прежде чем изменять данные получателя.");
        return;
      }
      const body = buildBusinessPartnerPatch(values, partnerForm.formState.dirtyFields, card.business_type);
      if (values.business_type !== card.business_type) {
        if (card.status !== "DOCUMENTS_VERIFIED") {
          setFormError("Сначала завершите проверку документов текущей заявки, затем измените юридический статус.");
          return;
        }
        if (requirements.isFetching) return;
        if (!requirements.data || requirements.data.business_type !== values.business_type) {
          setFormError("Дождитесь загрузки требований к документам нового статуса.");
          return;
        }
        body.files = typeChangeFiles(requirements.data, typeDrafts);
        const required = ["full_name", "inn", "phone", "email", "activity_type"] as const;
        if (required.some(field => !values[field]?.trim())) {
          setFormError("Для смены юридического статуса заполните ФИО, ИНН, телефон, e-mail и вид деятельности.");
          return;
        }
        if (values.business_type !== "LLC" && card.business_type === "LLC" && !values.identity) {
          setFormError("Для перехода с ООО на ИП или самозанятость заполните паспортные данные.");
          return;
        }
      }
      if (!Object.keys(body).length) {
        setFormError("Нет изменённых непустых полей. API не поддерживает очистку значений.");
        return;
      }
      await onPartnerSave(body);
    } catch (e) {
      setFormError(e instanceof ApiError ? e : "Не удалось сохранить");
    }
  });

  const saveRequisites = requisitesForm.handleSubmit(async (values) => {
    if (bankProcessing) return;
    setFormError(null);
    try {
      const body = buildBusinessPatch(values, requisitesForm.formState.dirtyFields);
      if (!Object.keys(body).some((field) => field !== "comment")) {
        setFormError("Измените хотя бы один банковский реквизит. Отдельный комментарий API не принимает.");
        return;
      }
      await onRequisitesSave(body);
    } catch (e) {
      setFormError(e instanceof ApiError ? e : "Не удалось сохранить");
    }
  });

  const completeReview = async () => {
    if (!card || bankProcessing || documentReviewCompleteBlockReason(card.status, card.documents)) return;
    setFormError(null);
    setCompleting(true);
    try {
      await onCompleteReview();
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e : "Не удалось завершить проверку",
      );
    } finally {
      setCompleting(false);
    }
  };

  const uploadDocumentFile = async (file: File, generation: number) => {
    const id = await uploadFile(file, "DOCUMENT");
    for (let attempt = 0; attempt < 30; attempt++) {
      if (generation !== uploadGeneration.current) throw new Error("Загрузка отменена. Выберите файл снова.");
      const status = await getFileStatus(id);
      if (status.status === "UPLOADED") return id;
      if (status.status !== "PENDING") throw new Error("Не удалось обработать файл");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error("Обработка файла заняла слишком много времени. Файл не сохранён.");
  };

  const attachFiles = async () => {
    if (!uploadSelection.length || hasUploads || !card || bankProcessing || uploadConflict) return;
    if (uploadType === "ADDITIONAL" && uploadSelection.length > 20) {
      setFormError("За один раз можно добавить не больше 20 дополнительных файлов.");
      return;
    }
    if (uploadType !== "ADDITIONAL" && uploadSelection.length !== 1) {
      setFormError("Для выбранного типа укажите один файл. Несколько страниц объедините в PDF.");
      return;
    }
    const generation = uploadGeneration.current;
    setUploading(true);
    setFormError(null);
    try {
      const ids: number[] = [];
      for (const file of uploadSelection) ids.push(await uploadDocumentFile(file, generation));
      if (generation !== uploadGeneration.current) return;
      setDocumentSaving(true);
      if (uploadType === "ADDITIONAL") await onAttachFiles(ids);
      else await onPutDocument(uploadType, ids[0], uploadRevision);
      setUploadOpen(false);
      setUploadSelection([]);
    } catch (e) {
      if (generation !== uploadGeneration.current) return;
      if (e instanceof ApiError && e.status === 409) setUploadConflict(true);
      setFormError(e instanceof ApiError ? e : e instanceof Error ? e.message : "Не удалось прикрепить файлы");
    } finally {
      if (generation === uploadGeneration.current) { setUploading(false); setDocumentSaving(false); }
    }
  };

  const stageTypeDocument = async (type: RegistrationDocumentType, file: File | undefined) => {
    if (!file || uploading || typeUploads[type] || !card || bankProcessing) return;
    const generation = uploadGeneration.current;
    setTypeUploads(current => ({ ...current, [type]: file.name }));
    setTypeDrafts(current => {
      const next = { ...current };
      delete next[type];
      return next;
    });
    setFormError(null);
    try {
      const fileId = await uploadDocumentFile(file, generation);
      if (generation === uploadGeneration.current) setTypeDrafts(current => ({ ...current, [type]: { fileId, filename: file.name } }));
    } catch (error) {
      if (generation === uploadGeneration.current) setFormError(error instanceof Error ? error : "Не удалось загрузить документ");
    } finally {
      if (generation === uploadGeneration.current) setTypeUploads(current => {
        const next = { ...current };
        delete next[type];
        return next;
      });
    }
  };

  const openDocumentUpload = (type: RegistrationDocumentType | "ADDITIONAL" = "ADDITIONAL") => {
    setUploadType(type);
    setUploadRevision(type === "ADDITIONAL" ? 0 : card?.documents.find(doc => doc.document_type === type)?.revision ?? 0);
    setUploadSelection([]);
    setUploadConflict(false);
    setUploadOpen(true);
  };

  const verifyBank = async () => {
    if (!card || card.status !== "DOCUMENTS_VERIFIED" || hasUploads || bankPending || bankProcessing || partnerForm.formState.isSubmitting) return;
    setBankPending(true);
    setFormError(null);
    setBankAlreadyCurrent(false);
    try {
      const action = await onBankVerification();
      setBankAlreadyCurrent(action === "ALREADY_CURRENT");
    } catch (e) {
      setFormError(e instanceof Error ? e : "Не удалось запросить проверку банка");
    } finally { setBankPending(false); }
  };

  const completeBlockedReason = card ? documentReviewCompleteBlockReason(card.status, card.documents) : null;
  const previewDoc =
    previewId != null
      ? card?.documents.find((d) => d.file_id === previewId) ?? null
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="document-review max-w-[760px] [&>*]:shrink-0 [&_input]:border-grey-1 [&_input]:text-sm [&_textarea]:border-grey-1 [&_textarea]:text-sm [&_label>span:first-child]:text-xs [&_label>span:first-child]:text-ink">
        <ErrorPopup error={formError} onDismiss={() => setFormError(null)} />
        <Dialog open={uploadOpen} onOpenChange={next => {
          if (!next && documentSaving) return;
          if (!next) { uploadGeneration.current++; setUploading(false); setUploadSelection([]); }
          setUploadOpen(next);
        }}>
          <ModalShell className="sm:max-w-[560px]">
            <DialogTitle className="text-xl font-semibold">{uploadRevision > 0 && uploadType !== "ADDITIONAL" ? "Заменить документ" : "Добавить документ"}</DialogTitle>
            <label className="flex flex-col gap-2 text-sm">Тип документа
              <Select value={uploadType} disabled={uploading} onValueChange={value => {
                if (!(value in DOCUMENT_TYPE_LABELS)) return;
                const next = value as RegistrationDocumentType | "ADDITIONAL";
                setUploadType(next); setUploadSelection([]); setUploadConflict(false);
                setUploadRevision(next === "ADDITIONAL" ? 0 : card?.documents.find(doc => doc.document_type === next)?.revision ?? 0);
              }}>
                <SelectTrigger aria-label="Тип документа"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADDITIONAL">Дополнительный документ</SelectItem>
                  {currentRequirements.data?.required_documents.map(item => <SelectItem key={item.document_type} value={item.document_type}>{item.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            {currentRequirements.isError && <button type="button" onClick={() => currentRequirements.refetch()} className="self-start text-sm text-brand underline">Повторить загрузку типов документов</button>}
            <p className="text-sm text-ink-muted">{uploadType === "ADDITIONAL" ? "Дополнительные файлы прикрепляются отдельно и не заменяют паспорт или другие обязательные документы." : uploadRevision > 0 ? `Новый файл заменит текущую версию ${uploadRevision}. Предыдущая версия сохранится в истории. Потребуется повторная проверка.` : "Будет добавлен новый документ выбранного типа. После загрузки его нужно проверить."}</p>
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand p-4 text-sm text-brand">
              Выбрать {uploadType === "ADDITIONAL" ? "файлы" : "файл"}
              <input key={uploadType} aria-label="Файл документа" type="file" accept="application/pdf,image/*" multiple={uploadType === "ADDITIONAL"} disabled={uploading || uploadConflict} className="sr-only" onChange={event => { setUploadSelection(Array.from(event.target.files ?? [])); }} />
            </label>
            {uploadSelection.map((file, index) => <p key={index} className="break-all text-sm text-ink">{file.name}</p>)}
            {uploadType !== "ADDITIONAL" && <p className="text-xs text-ink-muted">Один актуальный файл на тип. Несколько страниц объедините в один PDF.</p>}
            {uploadConflict && <button type="button" className="min-h-11 text-sm text-brand underline" onClick={async () => {
              try { await onReloadCard(); setUploadOpen(false); setUploadSelection([]); setUploadConflict(false); }
              catch (error) { setFormError(error instanceof Error ? error : "Не удалось обновить карточку"); }
            }}>Обновить карточку</button>}
            <div className="flex flex-wrap gap-3">
              <DialogClose disabled={documentSaving} className={FOOTER_SECONDARY}>Отмена</DialogClose>
              <button type="button" className={FOOTER_PRIMARY} onClick={() => void attachFiles()} disabled={!uploadSelection.length || uploading || uploadConflict || bankProcessing}>{documentSaving ? "Сохранение…" : uploading ? "Загрузка и обработка…" : uploadType !== "ADDITIONAL" && uploadRevision > 0 ? "Заменить" : "Добавить"}</button>
            </div>
          </ModalShell>
        </Dialog>
        <Dialog open={historyType !== null} onOpenChange={next => { if (!next) { setHistoryType(null); setHistoryPreview(null); } }}>
          <ModalShell className="sm:max-w-[760px]">
            <DialogTitle className="text-xl font-semibold">История версий</DialogTitle>
            {historyPreview && card ? <DocPreview key={historyPreview.file_id} doc={historyPreview} applicationStatus={card.status} readOnly onDecision={async () => {}} onBack={() => setHistoryPreview(null)} /> : <>
              <Select value={historyType ?? "PASSPORT_MAIN"} onValueChange={value => {
                if (!(value in DOCUMENT_TYPE_LABELS) || value === "ADDITIONAL") return;
                setHistoryType(value as RegistrationDocumentType); setHistoryOffset(0);
              }}>
                <SelectTrigger aria-label="Тип документа в истории"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOCUMENT_TYPE_LABELS).filter(([type]) => type !== "ADDITIONAL").map(([type, label]) => <SelectItem key={type} value={type}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">История доступна только для просмотра. Решения принимаются по актуальному файлу во вкладке «Документы».</p>
              {history.isFetching ? <p className="text-sm text-ink-muted">Загрузка версий…</p> : history.isError ? <button type="button" onClick={() => history.refetch()} className="text-sm text-brand underline">Повторить загрузку истории</button> : history.data?.items.length === 0 ? <p className="text-sm text-ink-muted">Версий пока нет.</p> : history.data?.items.map(version => <div key={`${version.document_type}:${version.revision}`} className="flex min-w-0 flex-col gap-2 rounded-xl border border-grey-4 p-3">
                <p className="text-xs text-ink-muted">Версия {version.revision}{version.is_current ? " · Актуальная" : " · Предыдущая"} · {DOC_STATUS_META[version.status].label}</p>
                <button type="button" className="break-all text-left text-sm text-brand underline" onClick={() => setHistoryPreview(version)}>{version.filename}</button>
                {version.comment && <p className="text-sm text-ink-muted">{version.comment}</p>}
              </div>)}
              <div className="flex items-center justify-between gap-3 text-sm">
                <button type="button" disabled={historyOffset === 0 || history.isFetching} className="min-h-11 text-brand disabled:opacity-40" onClick={() => setHistoryOffset(offset => Math.max(0, offset - 20))}>Предыдущие</button>
                <span className="text-ink-muted">{history.data?.total ? historyOffset + 1 : 0}–{Math.min(historyOffset + (history.data?.items.length ?? 0), history.data?.total ?? 0)} из {history.data?.total ?? 0}</span>
                <button type="button" disabled={history.isFetching || !history.data || historyOffset + history.data.items.length >= history.data.total} className="min-h-11 text-brand disabled:opacity-40" onClick={() => setHistoryOffset(offset => offset + 20)}>Следующие</button>
              </div>
            </>}
            <DialogClose className={FOOTER_SECONDARY}>Закрыть</DialogClose>
          </ModalShell>
        </Dialog>
        {/* Шапка */}
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:gap-[13px]">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-grey-5 text-xl font-normal text-ink sm:size-[89px] sm:rounded-3xl sm:text-3xl">
              {initials(review.name)}
            </div>
            <div className="flex min-w-0 flex-col gap-3 sm:min-h-[89px] sm:justify-between">
              <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
                {review.name}
              </DialogTitle>
              <p className="wrap-anywhere text-xs text-ink-muted">
                {[review.phone, review.submittedAt]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <HeaderChip label={review.legalLabel} cls={review.legalCls} />
                <HeaderChip label={review.statusLabel} cls={review.statusCls} />
                {card && <div className={cn("inline-flex min-h-[26px] items-center gap-2 text-sm", bankStatusMeta.className)}>
                  <span className="size-1 shrink-0 rounded-full bg-current" />
                  {card.bank_error_code && (card.bank_status === "NOT_VERIFIED" || card.bank_status === "TECHNICAL_ERROR") ? (
                    <button type="button" className="text-left underline underline-offset-2" onClick={() => useErrorPopupStore.getState().show({ code: card.bank_error_code }, "Проверка банком не завершена")}>
                      {bankStatusMeta.label}
                    </button>
                  ) : <span>{bankStatusMeta.label}</span>}
                  <button type="button" aria-label="Отправить на проверку банка" title={card.status !== "DOCUMENTS_VERIFIED" ? "Сначала завершите проверку документов" : migrationLocked ? "Дождитесь завершения переноса остатка или ручной сверки" : "Отправить на проверку банка"} onClick={verifyBank} disabled={card.status !== "DOCUMENTS_VERIFIED" || hasUploads || partnerForm.formState.isSubmitting || bankPending || bankProcessing} className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-grey-5 disabled:opacity-40">
                    <img src={documentBankRefresh} alt="" className={bankPending || bankQueued ? "animate-spin" : undefined} />
                  </button>
                </div>}
              </div>
            </div>
          </div>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
          >
            <X className="size-5" />
          </DialogClose>
        </div>

        <div className="h-px w-full bg-grey-2" />
        {bankMessage && <p role="status" className="text-sm text-ink">{bankMessage}</p>}

        {loading ? (
          <p className="py-10 text-center text-base text-ink-muted">
            Загрузка заявки…
          </p>
        ) : error || !card ? (
          <span className="text-sm text-ink-muted">Данные не загружены.</span>
        ) : previewDoc ? (
          <DocPreview
            doc={previewDoc}
            applicationStatus={card.status}
            onBack={() => setPreviewId(null)}
            onDecision={(body) => onDocumentDecision(previewDoc.file_id, body)}
          />
        ) : (
          <>
            <section aria-label="Баланс Felmee" className="flex flex-col gap-3 rounded-xl border border-grey-4 p-4">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs text-ink-muted">Доступный остаток Felmee</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums text-ink">{formatRubles(card.available_rub)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-ink-muted">Зарезервированный остаток Felmee</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums text-ink">{formatRubles(card.blocked_rub)}</dd></div>
              </dl>
            </section>
            {card.balance_transfer_status && <section aria-label="Перенос остатка" className="flex min-w-0 flex-col gap-2 rounded-xl border border-grey-4 p-4">
              <p role="status" className={cn("text-sm font-semibold", transferMeta?.className ?? "text-warning")}>{transferMeta?.label ?? "Не удалось определить состояние переноса"}</p>
              <p className="text-sm text-ink-muted">{transferMeta?.description ?? "Обновите карточку, чтобы проверить состояние переноса остатка."}</p>
              {card.balance_transfer_status === "PENDING" && card.status !== "DOCUMENTS_VERIFIED" && <p className="text-sm text-ink-muted">Завершите проверку необходимых документов, затем отправьте заявку на проверку банка.</p>}
              {card.balance_transfer_status === "DONE" && <p className="text-sm text-ink">{confirmed ? "Новый получатель подтверждён банком. Перенос остатка завершён." : "Ожидаем окончательного подтверждения нового получателя банком."}</p>}
              {card.balance_transfer_status === "REVIEW_REQUIRED" && <p className="break-all rounded-lg bg-grey-5 p-3 text-xs text-ink">Код причины: <code>{card.bank_error_code ?? "Сервер не передал код причины"}</code></p>}
            </section>}
            <SegmentTabs
              variant="flat"
              className="w-full [&>button]:flex-1 [&>button]:px-3"
              value={tab}
              onChange={setTab}
              options={TABS.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
            />

            {tab === "partner" && (
              <form onSubmit={savePartner} className="flex flex-col gap-6">
                <fieldset className="contents" disabled={partnerForm.formState.isSubmitting || bankProcessing}>
                <SectionTitle>Основная информация</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="ФИО"
                    error={partnerForm.formState.errors.full_name?.message}
                    {...partnerForm.register("full_name")}
                  />
                  <Field
                    label="ИНН"
                    error={partnerForm.formState.errors.inn?.message}
                    {...partnerForm.register("inn")}
                  />
                  <Field
                    label="Телефон"
                    error={partnerForm.formState.errors.phone?.message}
                    {...partnerForm.register("phone")}
                  />
                  <Field
                    label="e-mail"
                    error={partnerForm.formState.errors.email?.message}
                    {...partnerForm.register("email")}
                  />
                  <Field
                    label="Вид деятельности"
                    error={partnerForm.formState.errors.activity_type?.message}
                    {...partnerForm.register("activity_type")}
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm leading-[1.3] text-ink-muted">
                      Юридический статус
                    </span>
                    <Select value={selectedBusinessType} disabled={hasUploads || partnerForm.formState.isSubmitting || bankProcessing}
                      onValueChange={(value) => {
                        if (!BUSINESS_TYPE_OPTIONS.some(option => option.value === value)) return;
                        const nextType = value as PartnerForm["business_type"];
                        partnerForm.setValue("business_type", nextType, { shouldDirty: true, shouldValidate: true });
                        uploadGeneration.current++;
                        setTypeDrafts({});
                        setTypeUploads({});
                        setFormError(null);
                        if (nextType === "LLC") {
                          partnerForm.unregister("identity");
                        } else {
                          if (!partnerForm.getValues("identity") && card.partner.identity) partnerForm.setValue("identity", card.partner.identity);
                        }
                      }}>
                      <SelectTrigger aria-label="Юридический статус" className="border-grey-1 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                      {BUSINESS_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                {selectedBusinessType !== card.business_type && <p className="text-sm text-ink-muted">Для смены статуса текущие документы должны быть проверены. Для нового статуса могут потребоваться дополнительные документы владельца.</p>}
                {changingType && <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-grey-4 p-4">
                  <SectionTitle>Документы для нового статуса</SectionTitle>
                  {requirements.isPending ? <p className="text-sm text-ink-muted">Проверяем комплект документов…</p> : requirements.isError ? (
                    <button type="button" onClick={() => requirements.refetch()} className="self-start text-sm text-brand underline">Повторить загрузку требований</button>
                  ) : requirements.data?.required_documents.map(item => (
                    <div key={item.document_type} className="flex min-w-0 flex-col gap-2 rounded-lg bg-grey-5 p-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      {!item.needs_upload ? <span className="text-xs text-success">Проверенный документ уже есть</span> : <>
                        <span className="break-all text-xs text-ink-muted">{typeUploads[item.document_type] ?? typeDrafts[item.document_type]?.filename ?? "Требуется новый файл"}</span>
                        <label className={cn("flex min-h-11 items-center text-sm text-brand underline", typeUploads[item.document_type] ? "opacity-50" : "cursor-pointer")}>
                          {typeUploads[item.document_type] ? "Загрузка и обработка…" : typeDrafts[item.document_type] ? "Выбрать другой файл" : "Загрузить документ"}
                          <input aria-label={`Документ: ${item.title}`} type="file" accept="application/pdf,image/*" className="sr-only" disabled={Boolean(typeUploads[item.document_type])} onChange={event => {
                            void stageTypeDocument(item.document_type, event.target.files?.[0]); event.target.value = "";
                          }} />
                        </label>
                      </>}
                    </div>
                  ))}
                  <p className="text-xs text-ink-muted">По одному файлу на тип. Несколько страниц объедините в один PDF. Новые документы сохранятся вместе с юридическим статусом и потребуют проверки.</p>
                </div>}
                {selectedBusinessType !== "LLC" && (
                  <>
                    <SectionTitle>Паспортные данные</SectionTitle>
                    <p className="text-sm text-ink-muted">Для ИП и самозанятого заполните все паспортные данные перед сохранением.</p>
                    {partnerForm.formState.errors.identity?.message && <p role="alert" className="text-sm text-danger">{partnerForm.formState.errors.identity.message}</p>}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {([
                        ["registration_address", "Адрес регистрации", "text"],
                        ["passport_series", "Серия паспорта", "text"],
                        ["passport_number", "Номер паспорта", "text"],
                        ["birth_date", "Дата рождения", "date"],
                        ["passport_issue_date", "Дата выдачи", "date"],
                        ["department_code", "Код подразделения", "text"],
                        ["birth_place", "Место рождения", "text"],
                      ] as const).map(([key, label, type]) => (
                        <Field key={key} label={label} type={type}
                          error={partnerForm.formState.errors.identity?.[key]?.message}
                          {...partnerForm.register(`identity.${key}`)} />
                      ))}
                    </div>
                  </>
                )}

                <TextAreaField
                  label="Комментарий партнёру"
                  hideLabel
                  placeholder="Комментарий. Например: данные изменены в соответствии с документом…"
                  rows={5}
                  {...partnerForm.register("comment")}
                />
                </fieldset>
                {bankProcessing && <p role="status" className="text-sm text-ink-muted">Данные проверяются банком. Изменить их можно после завершения проверки.</p>}

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <DialogClose className={FOOTER_SECONDARY}>
                    Отмена
                  </DialogClose>
                  <button
                    type="submit"
                    disabled={hasUploads || !typeFilesComplete || changingType && card.status !== "DOCUMENTS_VERIFIED" || partnerForm.formState.isSubmitting || !partnerForm.formState.isDirty || bankProcessing}
                    className={FOOTER_PRIMARY}
                  >
                    {partnerForm.formState.isSubmitting
                      ? "Сохранение…"
                      : "Сохранить"}
                  </button>
                </div>
              </form>
            )}

            {tab === "documents" && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle>Загруженные документы</SectionTitle>
                <button type="button" onClick={() => openDocumentUpload()} disabled={hasUploads || bankProcessing} className="flex min-h-11 items-center gap-1 text-sm text-brand disabled:opacity-50"><Plus className="size-4" />Добавить документ</button>
                </div>
                <button type="button" className="self-start text-sm text-brand underline" onClick={() => { setHistoryOffset(0); setHistoryType("PASSPORT_MAIN"); setHistoryPreview(null); }}>История документов</button>
                {bankProcessing && <p className="text-sm text-ink-muted">Изменение документов доступно после завершения проверки банком.</p>}
                {card.documents.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Документы ещё не загружены.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {card.documents.map((doc) => (
                      <div key={doc.file_id} className="flex min-w-0 flex-col gap-1">
                        <DocRow doc={doc} onView={() => setPreviewId(doc.file_id)} />
                        {doc.document_type && doc.document_type !== "ADDITIONAL" && <div className="flex flex-wrap gap-4">
                          <button type="button" onClick={() => openDocumentUpload(doc.document_type as RegistrationDocumentType)} disabled={hasUploads || bankProcessing} className="min-h-11 text-sm text-brand underline disabled:opacity-50">Заменить</button>
                          <button type="button" onClick={() => { setHistoryType(doc.document_type as RegistrationDocumentType); setHistoryOffset(0); setHistoryPreview(null); }} className="min-h-11 text-sm text-brand underline">История версий</button>
                        </div>}
                      </div>
                    ))}
                  </div>
                )}

                {completeBlockedReason && <p role="status" className="text-sm text-ink-muted">{completeBlockedReason}</p>}

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <DialogClose className={FOOTER_SECONDARY}>
                    Отмена
                  </DialogClose>
                  <button
                    type="button"
                    onClick={completeReview}
                    disabled={completing || hasUploads || bankProcessing || Boolean(completeBlockedReason)}
                    className={FOOTER_PRIMARY}
                  >
                    {completing ? "Завершение…" : "Готово"}
                  </button>
                </div>
              </div>
            )}

            {tab === "requisites" && (
              <form onSubmit={saveRequisites} className="flex flex-col gap-6">
                <fieldset className="contents" disabled={bankProcessing || requisitesForm.formState.isSubmitting}>
                <SectionTitle>Банковские реквизиты</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Получатель"
                    error={requisitesForm.formState.errors.recipient_name?.message}
                    {...requisitesForm.register("recipient_name")}
                  />
                  <Field
                    label="Банк"
                    error={requisitesForm.formState.errors.bank_name?.message}
                    {...requisitesForm.register("bank_name")}
                  />
                  <Field
                    label="БИК"
                    error={requisitesForm.formState.errors.bik?.message}
                    {...requisitesForm.register("bik")}
                  />
                  <Field
                    label="Расчётный счёт"
                    error={
                      requisitesForm.formState.errors.settlement_account?.message
                    }
                    {...requisitesForm.register("settlement_account")}
                  />
                  <Field
                    label="Корреспондентский счёт"
                    className="sm:col-span-2"
                    error={
                      requisitesForm.formState.errors.correspondent_account
                        ?.message
                    }
                    {...requisitesForm.register("correspondent_account")}
                  />
                </div>

                <TextAreaField
                  label="Комментарий"
                  hideLabel
                  placeholder="Комментарий при правке реквизитов…"
                  rows={5}
                  {...requisitesForm.register("comment")}
                />
                </fieldset>

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <DialogClose className={FOOTER_SECONDARY}>
                    Отмена
                  </DialogClose>
                  <button
                    type="submit"
                    disabled={bankProcessing || requisitesForm.formState.isSubmitting || !requisitesForm.formState.isDirty}
                    className={FOOTER_PRIMARY}
                  >
                    {requisitesForm.formState.isSubmitting
                      ? "Сохранение…"
                      : "Сохранить"}
                  </button>
                </div>
              </form>
            )}

            {tab === "comments" && (
              <div className="flex flex-col gap-6">
                <SectionTitle>Комментарии</SectionTitle>
                {commentsError && comments.length === 0 ? (
                  <div className="text-sm text-ink-muted">
                    <button type="button" className="ml-3 underline" onClick={onCommentsRetry}>Повторить</button>
                  </div>
                ) : commentsLoading && comments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-muted">
                    Загрузка комментариев…
                  </p>
                ) : comments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-muted">
                    Комментариев пока нет.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <CommentCard key={c.id} comment={c} />
                    ))}
                  </div>
                )}
                {comments.length > 0 && <InfiniteScrollSentinel
                  hasNextPage={commentsHasNextPage}
                  isFetching={commentsLoading}
                  isError={commentsError}
                  onLoadMore={commentsError && !commentsHasNextPage ? onCommentsRetry : onCommentsLoadMore}
                />}
              </div>
            )}
          </>
        )}
      </ModalShell>
    </Dialog>
  );
}
