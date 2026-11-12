import { useEffect, useRef, useState } from "react";
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
import { BUSINESS_BANK_META } from "@/lib/business-bank-status";
import { buildBusinessPatch } from "@/lib/api/business-registry";
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

/** Схема формы данных партнёра (все поля опциональны — частичная правка). */
const partnerSchema = z.object({
  full_name: z.string().trim().optional(),
  inn: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Проверьте e-mail").or(z.literal("")).optional(),
  activity_type: z.string().trim().optional(),
  business_type: z.enum(["SE", "IE", "LLC"]),
  comment: z.string().trim().optional(),
  identity: z.object({
    registration_address: z.string().trim().min(1, "Укажите адрес"),
    passport_series: z.string().regex(/^\d{4}$/, "4 цифры"),
    passport_number: z.string().regex(/^\d{6}$/, "6 цифр"),
    birth_date: z.string().date("Укажите дату"),
    passport_issue_date: z.string().date("Укажите дату"),
    department_code: z.string().regex(/^\d{3}-\d{3}$/, "Формат 000-000"),
    birth_place: z.string().trim().min(1, "Укажите место рождения"),
  }).refine((v) => v.birth_date <= format(new Date(), "yyyy-MM-dd"), {
    path: ["birth_date"], message: "Дата не может быть в будущем",
  }).refine((v) => v.passport_issue_date >= v.birth_date && v.passport_issue_date <= format(new Date(), "yyyy-MM-dd"), {
    path: ["passport_issue_date"], message: "Проверьте дату выдачи",
  }).optional(),
});
type PartnerForm = z.infer<typeof partnerSchema>;

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
  const [downloadError, setDownloadError] = useState(false);
  const downloadOriginal = async () => {
    setDownloading(true);
    setDownloadError(false);
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
    } catch {
      setDownloadError(true);
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
      {downloadError && <span role="alert" className="w-full text-xs text-danger">Не удалось скачать файл. Повторите попытку.</span>}
    </div>
  );
}

/** Предпросмотр документа + решение по нему (открывается «глазом»). */
function DocPreview({
  doc,
  onDecision,
  onBack,
}: {
  doc: BusinessApplicationDocument;
  onDecision: (body: BusinessApplicationDocumentDecision) => Promise<void>;
  onBack: () => void;
}) {
  const { data: file, isError: fileError, refetch: reloadFile } = useDocumentFile(doc.file_id);
  const [reupload, setReupload] = useState(false);
  const [comment, setComment] = useState(doc.draft_comment ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = (doc.content_type ?? "").startsWith("image/");
  const isPdf = doc.content_type === "application/pdf";

  const submit = async (decision: BusinessApplicationDocumentDecision["decision"]) => {
    setError(null);
    setPending(true);
    try {
      await onDecision({
        decision,
        comment: decision === "REQUEST_REUPLOAD" ? comment.trim() : undefined,
      });
      onBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить решение");
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

      {reupload && (
        <TextAreaField
          label="Что не так с документом"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Уточните, какой документ нечитаемый или не соответствует требованиям…"
          rows={3}
        />
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => submit("APPROVE")}
          disabled={pending}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-success text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Сохранение…" : "Подтвердить"}
        </button>
        <button
          type="button"
          onClick={() =>
            reupload ? submit("REQUEST_REUPLOAD") : setReupload(true)
          }
          disabled={pending || (reupload && comment.trim() === "")}
          className="flex h-12 flex-1 items-center justify-center rounded-full border border-grey-2 text-base font-medium text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
        >
          Запросить перезагрузку
        </button>
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
  const [formError, setFormError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bankPending, setBankPending] = useState(false);
  const [bankMessage, setBankMessage] = useState<string | null>(null);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const wasOpen = useRef(false);

  const partnerForm = useForm<PartnerForm>({
    resolver: zodResolver(partnerSchema),
  });
  const requisitesForm = useForm<RequisitesForm>({
    resolver: zodResolver(requisitesSchema),
  });

  // Сброс вкладки/предпросмотра при открытии.
  if (open && !wasOpen.current) {
    setTab("partner");
    setPreviewId(null);
    setFormError(null);
    setBankMessage(null);
  }
  wasOpen.current = open;

  // Предзаполнение форм, когда подъехала карточка.
  useEffect(() => {
    if (!card) return;
    setEditingIdentity(Boolean(card.partner.identity));
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
  }, [card]);

  if (!review) return null;

  const savePartner = partnerForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const body = buildBusinessPatch(values, partnerForm.formState.dirtyFields);
      if (!Object.keys(body).length) {
        setFormError("Нет изменённых непустых полей. API не поддерживает очистку значений.");
        return;
      }
      await onPartnerSave(body);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    }
  });

  const saveRequisites = requisitesForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const body = buildBusinessPatch(values, requisitesForm.formState.dirtyFields);
      if (!Object.keys(body).some((field) => field !== "comment")) {
        setFormError("Измените хотя бы один банковский реквизит. Отдельный комментарий API не принимает.");
        return;
      }
      await onRequisitesSave(body);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    }
  });

  const completeReview = async () => {
    setFormError(null);
    setCompleting(true);
    try {
      await onCompleteReview();
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e.message : "Не удалось завершить проверку",
      );
    } finally {
      setCompleting(false);
    }
  };

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setFormError(null);
    try {
      const ids: number[] = [];
      for (const file of Array.from(files)) {
        const id = await uploadFile(file, "DOCUMENT");
        let ready = false;
        for (let attempt = 0; attempt < 30; attempt++) {
          const status = await getFileStatus(id);
          if (status.status === "UPLOADED") { ready = true; break; }
          if (status.status !== "PENDING") throw new Error("Не удалось обработать файл");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (!ready) throw new Error("Обработка файла заняла слишком много времени. Файл не прикреплён.");
        ids.push(id);
      }
      await onAttachFiles(ids);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось прикрепить файлы");
    } finally {
      setUploading(false);
    }
  };

  const verifyBank = async () => {
    setBankPending(true);
    setFormError(null);
    setBankMessage(null);
    try {
      const action = await onBankVerification();
      setBankMessage(action === "QUEUED" ? "Проверка банка поставлена в очередь" : "Подтверждённые банком данные актуальны");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось запросить проверку банка");
    } finally { setBankPending(false); }
  };

  const previewDoc =
    previewId != null
      ? card?.documents.find((d) => d.file_id === previewId) ?? null
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="document-review max-w-[760px] [&>*]:shrink-0 [&_input]:border-grey-1 [&_input]:text-sm [&_textarea]:border-grey-1 [&_textarea]:text-sm [&_label>span:first-child]:text-xs [&_label>span:first-child]:text-ink">
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
                {card && <div className={cn("inline-flex min-h-[26px] items-center gap-2 text-sm", BUSINESS_BANK_META[card.bank_status].className)}>
                  <span className="size-1 shrink-0 rounded-full bg-current" />
                  <span>{BUSINESS_BANK_META[card.bank_status].label}</span>
                  <button type="button" aria-label="Отправить на проверку банка" title="Отправить на проверку банка" onClick={verifyBank} disabled={bankPending || card.bank_status === "UNDER_REVIEW"} className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-grey-5 disabled:opacity-40">
                    <img src={documentBankRefresh} alt="" className={bankPending ? "animate-spin" : undefined} />
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
        {card?.bank_error_code && <p className="text-xs text-danger">Код ошибки банка: {card.bank_error_code}</p>}

        {loading ? (
          <p className="py-10 text-center text-base text-ink-muted">
            Загрузка заявки…
          </p>
        ) : error || !card ? (
          <p className="py-10 text-center text-base text-danger">
            Не удалось загрузить заявку.
          </p>
        ) : previewDoc ? (
          <DocPreview
            doc={previewDoc}
            onBack={() => setPreviewId(null)}
            onDecision={(body) => onDocumentDecision(previewDoc.file_id, body)}
          />
        ) : (
          <>
            <SegmentTabs
              variant="flat"
              className="w-full [&>button]:flex-1 [&>button]:px-3"
              value={tab}
              onChange={setTab}
              options={TABS.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
            />

            {tab === "partner" && (
              <form onSubmit={savePartner} className="flex flex-col gap-6">
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
                    <Select value={partnerForm.watch("business_type")} disabled>
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

                <p className="text-sm text-ink-muted">Изменение юридического статуса пока недоступно: для этого нужны документы владельца по новому статусу.</p>
                {card.business_type !== "LLC" && !editingIdentity && (
                  <button type="button" onClick={() => setEditingIdentity(true)} className="w-fit text-sm text-brand underline">
                    Добавить паспортные данные
                  </button>
                )}
                {editingIdentity && card.business_type !== "LLC" && (
                  <>
                    <SectionTitle>Паспортные данные</SectionTitle>
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
                {formError && <p className="text-sm text-danger">{formError}</p>}

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <DialogClose className={FOOTER_SECONDARY}>
                    Отмена
                  </DialogClose>
                  <button
                    type="submit"
                    disabled={partnerForm.formState.isSubmitting || !partnerForm.formState.isDirty}
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
                <label className="flex min-h-11 cursor-pointer items-center gap-1 text-sm text-brand">
                  <Plus className="size-4" />{uploading ? "Загрузка файлов…" : "Добавить документ"}
                  <input aria-label="Добавить документы" className="sr-only" type="file" multiple disabled={uploading} onChange={(event) => {
                    void attachFiles(event.target.files);
                    event.target.value = "";
                  }} />
                </label>
                </div>
                {card.documents.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Документы ещё не загружены.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {card.documents.map((doc) => (
                      <DocRow
                        key={doc.file_id}
                        doc={doc}
                        onView={() => setPreviewId(doc.file_id)}
                      />
                    ))}
                  </div>
                )}

                {formError && <p className="text-sm text-danger">{formError}</p>}

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <DialogClose className={FOOTER_SECONDARY}>
                    Отмена
                  </DialogClose>
                  <button
                    type="button"
                    onClick={completeReview}
                    disabled={completing || uploading || card.documents.length === 0 || card.documents.some(doc => doc.status === "PENDING" && !doc.draft_decision)}
                    className={FOOTER_PRIMARY}
                  >
                    {completing ? "Завершение…" : "Готово"}
                  </button>
                </div>
              </div>
            )}

            {tab === "requisites" && (
              <form onSubmit={saveRequisites} className="flex flex-col gap-6">
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
                {formError && <p className="text-sm text-danger">{formError}</p>}

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <DialogClose className={FOOTER_SECONDARY}>
                    Отмена
                  </DialogClose>
                  <button
                    type="submit"
                    disabled={requisitesForm.formState.isSubmitting || !requisitesForm.formState.isDirty}
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
                  <div className="text-sm text-danger">Не удалось загрузить комментарии.
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
