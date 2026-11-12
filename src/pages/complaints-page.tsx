import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import {
  Card,
  ChatViewDialog,
  CheckboxFilterMenu,
  ComplaintDecisionDialog,
  ComplaintReasonDialog,
  ComplaintReviewDialog,
  ComplaintServiceDialog,
  ComplaintCaseDialog,
  ComplaintsTable,
  DateFilter,
  SearchInput,
  StatCard,
  UserInfoDialog,
  MasterProfileDialog,
  SalonProfileDialog,
  type Complaint,
  type ComplaintKind,
  type DateRange,
  type ReviewData,
  type ServiceData,
} from "@/components";
import {
  ApiError,
  useComplaint,
  useComplaintsStats,
  useResolveComplaint,
  useResolutionTemplates,
  useClient,
  useProviderProfile,
  type AdminMasterProfile,
  type AdminSalonProfile,
  type ComplaintListItem,
  type ComplaintResolution,
  type ComplaintStatus,
  type ComplaintSubjectType,
  type ComplaintReviewSnapshot,
  type ComplaintServiceSnapshot,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { usePersistentState } from "@/lib/use-persistent-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteComplaints } from "@/lib/api/infinite-lists";
import type { ProfileTarget } from "@/components/profile-name";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 10;

/** Тип объекта жалобы API → вид в таблице. */
const SUBJECT_TO_KIND: Record<ComplaintSubjectType, ComplaintKind> = {
  USER: "user",
  MASTER: "master",
  SALON: "salon",
  SERVICE: "service",
  REVIEW: "review",
};

/** Тип объекта жалобы → роль в подписи «На кого пожаловались». */
const SUBJECT_ROLE: Record<ComplaintSubjectType, string> = {
  USER: "пользователь",
  MASTER: "мастер",
  SALON: "салон",
  SERVICE: "услуга",
  REVIEW: "отзыв",
};

/** Вариант решения API → подпись для select и итога. */
const RESOLUTION_LABEL: Record<ComplaintResolution, string> = {
  BLOCK_USER: "Заблокировать пользователя",
  REPRIMAND_USER: "Предупреждение пользователю",
  BLOCK_MASTER: "Заблокировать мастера",
  REPRIMAND_MASTER: "Предупреждение мастеру",
  BLOCK_SALON: "Заблокировать салон",
  REPRIMAND_SALON: "Предупреждение салону",
  DELETE_SERVICE: "Удалить услугу",
  DELETE_REVIEW: "Удалить отзыв",
  NO_VIOLATION: "Нарушений нет",
  SUBJECT_UNAVAILABLE: "Объект недоступен",
};

const numberFmt = new Intl.NumberFormat("ru-RU");

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Дефолтный период — последние 30 дней. */
const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
};

const formatCount = (value: number | undefined) =>
  value == null ? "—" : numberFmt.format(value);

/** Дельта к прошлому периоду: текст со знаком + направление для бейджа. */
const formatDelta = (
  percent: number | null | undefined,
): { text?: string; up?: boolean } => {
  if (percent == null) return {};
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return {
    text: `${sign}${numberFmt.format(Math.abs(rounded))}%`,
    up: rounded >= 0,
  };
};

/** Ср. время решения в днях (напр. «1,8 дня»). */
const formatDays = (value: number | undefined) =>
  value == null ? "—" : `${numberFmt.format(Math.round(value * 10) / 10)} дн.`;

/** Имя проверяющего из first/last. */
const reviewerName = (
  reviewer: { first_name?: string | null; last_name?: string | null } | null,
) =>
  reviewer
    ? [reviewer.first_name, reviewer.last_name].filter(Boolean).join(" ")
    : "";

/** Жалоба из API → строка таблицы. */
const toRow = (item: ComplaintListItem): Complaint => ({
  complainantAvatar: item.reporter.avatar,
  targetAvatar: item.subject.avatar,
  complainantProfile: item.reporter.account_type === "CLIENT" || item.reporter.account_type === "MASTER"
    ? { id: item.reporter.user_id, role: item.reporter.account_type }
    : undefined,
  targetProfile: item.subject.type === "USER"
    ? { id: item.subject.subject_id, role: "CLIENT" }
    : item.subject.type === "MASTER"
      ? { id: item.subject.subject_id, role: "MASTER" }
      : item.subject.type === "SALON"
        ? { id: item.subject.salon_id ?? item.subject.subject_id, role: "SALON" }
        : undefined,
  id: item.complaint_id,
  disputeNo: String(item.complaint_id),
  status: item.status === "CLOSED" ? "closed" : "open",
  date: format(parseISO(item.created_at), "dd.MM.yyyy"),
  complainant: item.reporter.name || "—",
  target: item.subject.name || "—",
  targetRole: SUBJECT_ROLE[item.subject.type],
  kind: SUBJECT_TO_KIND[item.subject.type],
  reasonPreview: item.reason,
  manager: reviewerName(item.resolved_by ?? null) || undefined,
  decision: item.resolution ? RESOLUTION_LABEL[item.resolution] : undefined,
});

/* ---------------------------------------------------- маппинг снапшотов в UI */

/** Сумма в рублях (целое из API). */
const fmtMoney = (value: number | null | undefined) =>
  value == null ? "—" : `${numberFmt.format(value)} ₽`;

/** Дата-время записи/отзыва: «15 марта 2026, 12:30». */
const fmtDateTime = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "d MMMM yyyy, HH:mm", { locale: ru }) : "";

/** Интервал записи: «15 марта 2026, 12:30-12:45». */
const fmtRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => {
  if (!start) return "";
  const head = format(parseISO(start), "d MMMM yyyy, HH:mm", { locale: ru });
  const tail = end ? format(parseISO(end), "HH:mm", { locale: ru }) : "";
  return tail ? `${head}-${tail}` : head;
};

/** Длительность услуги из минут: «2 ч. 30 мин.». */
const fmtDuration = (min: number | null | undefined) => {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} ч.` : "", m ? `${m} мин.` : ""].filter(Boolean).join(" ") ||
    "0 мин.";
};

/** Подпись к рейтингу отзыва. */
const ratingLabel = (r: number) =>
  r >= 5 ? "Всё отлично" : r >= 4 ? "Хорошо" : r >= 3 ? "Нормально" : r >= 2 ? "Плохо" : "Очень плохо";

const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

/** Статус работы на сегодня из графика услуги. */
const todayHours = (days: ComplaintServiceSnapshot["working_days"]) => {
  const idx = (new Date().getDay() + 6) % 7; // 0 = понедельник
  const row = days.find((d) => d.day_of_week === DAY_ORDER[idx]);
  if (!row || !row.working) return "Сегодня закрыто";
  return row.end_time ? `Открыто · до ${row.end_time}` : "Открыто";
};

/** Снапшот отзыва из жалобы → данные карточки отзыва. */
const snapshotToReview = (rs: ComplaintReviewSnapshot): ReviewData => ({
  authorAvatar: rs.author_avatar_id,
  masterAvatar: rs.executor_avatar_id,
  salonAvatar: rs.salon_avatar_id,
  authorProfile: { id: rs.author_user_id, role: "CLIENT" },
  masterProfile: { id: rs.executor_user_id, role: "MASTER" },
  salonProfile: rs.salon_id != null ? { id: rs.salon_id, role: "SALON" } : undefined,
  author: rs.author_full_name ?? "—",
  when: fmtDateTime(rs.created_at),
  service: rs.service_name ?? "—",
  price: fmtMoney(rs.price),
  date: fmtRange(rs.start_at, rs.end_at),
  master: rs.executor_full_name ?? "—",
  salon: rs.salon_name ?? "",
  rating: rs.rating ?? 0,
  ratingLabel: rs.rating ? ratingLabel(rs.rating) : "",
  liked: rs.liked_text ?? "",
  disliked: rs.disliked_text ?? "",
  comment: rs.comment ?? "",
  tags: rs.tags ?? [],
});

/** Снапшот услуги из жалобы → данные карточки услуги. */
const snapshotToService = (ss: ComplaintServiceSnapshot): ServiceData => {
  const isSalon = ss.provider_type === "SALON";
  return {
    providerProfile: isSalon
      ? (ss.salon_id != null ? { id: ss.salon_id, role: "SALON" } : undefined)
      : { id: ss.provider_user_id, role: "MASTER" },
    imageIds: ss.image_ids ?? [],
    providerAvatar: isSalon ? ss.salon_cover_photo_id : ss.provider_avatar_id,
    priceFrom:
      ss.price == null
        ? "—"
        : ss.is_fix_price
          ? fmtMoney(ss.price)
          : `от ${numberFmt.format(ss.price)} ₽`,
    title: ss.service_name ?? "—",
    rating: ss.rating ?? 0,
    reviews: ss.reviews_count ?? 0,
    duration: fmtDuration(ss.duration),
    description: ss.description ?? "",
    place: (isSalon ? ss.salon_name : ss.provider_full_name) ?? "—",
    placeKind: isSalon ? "Салон" : "Мастер",
    placeRating: (isSalon ? ss.salon_rating : ss.provider_rating) ?? 0,
    placeReviews:
      (isSalon ? ss.salon_reviews_count : ss.provider_reviews_count) ?? 0,
    address: ss.address ?? "",
    hours: todayHours(ss.working_days ?? []),
    advantages: ss.advantages ?? [],
  };
};

/* --------------------------------------------------------------------- экран */

type Modal = "reason" | "decision" | "review" | "service" | "case" | null;

/** Виды объекта, у которых «глаз» открывает разбор «Жалоба №N» с карточкой участника. */
const PARTY_KINDS: ComplaintKind[] = ["user", "master", "salon"];

const TABS: [ComplaintStatus, string][] = [
  ["OPEN", "Открытые"],
  ["CLOSED", "Закрытые"],
];

/** Опции фильтра по типу объекта жалобы. */
const TYPE_OPTIONS: { value: ComplaintSubjectType; label: string }[] = [
  { value: "USER", label: "Пользователь" },
  { value: "MASTER", label: "Мастер" },
  { value: "SALON", label: "Салон" },
  { value: "SERVICE", label: "Услуга" },
  { value: "REVIEW", label: "Отзыв" },
];

export default function ComplaintsPage() {
  const toast = useToast();
  const [range, setRange] = usePersistentState<DateRange | undefined>(
    "complaints.range",
    defaultRange,
  );
  const [status, setStatus] = usePersistentState<ComplaintStatus>(
    "complaints.status",
    "OPEN",
  );
  const [types, setTypes] = usePersistentState<ComplaintSubjectType[]>(
    "complaints.types",
    [],
  );
  const [query, setQuery] = usePersistentState("complaints.query", "");
  // Открытый чат клиента из карточки жалобы (клиент + конкретный диалог).
  const [chatTarget, setChatTarget] = useState<{
    clientId: number;
    dialogId: number;
  } | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const [modal, setModal] = useState<Modal>(null);
  const [active, setActive] = useState<Complaint | null>(null);
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);
  const clientQuery = useClient(profileTarget?.role === "CLIENT" ? profileTarget.id : null);
  const providerQuery = useProviderProfile(
    profileTarget && profileTarget.role !== "CLIENT" ? profileTarget.id : null,
    profileTarget && profileTarget.role !== "CLIENT" ? profileTarget.role : null,
  );
  const profileError = profileTarget?.role === "CLIENT" ? clientQuery.error : providerQuery.error;
  useEffect(() => {
    if (!profileTarget || !profileError) return;
    toast.error("Не удалось открыть профиль", profileError instanceof ApiError ? profileError.message : "Попробуйте ещё раз.");
    setProfileTarget(null);
  }, [profileTarget, profileError, toast]);

  // Дебаунс строки поиска.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const from = range?.from ? toIsoDate(range.from) : null;
  const to = range?.to ? toIsoDate(range.to) : null;


  const { data: stats } = useComplaintsStats({ from: from ?? "", to: to ?? "" });

  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteComplaints({
    from: from ?? "",
    to: to ?? "",
    status,
    type: types.length ? types : undefined,
    query: debouncedQuery || undefined,
    limit: PAGE_SIZE,
  });

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  // Детали активной жалобы нужны всем модалкам разбора (причина/решение/
  // отзыв/услуга/кейс) — в них подставляются реальные данные из снапшотов.
  const detailQuery = useComplaint(active && modal != null ? active.id : null);
  const detail = detailQuery.data;

  // Снапшоты из детали → данные карточек; участник — из subject.
  const reviewData = detail?.review_snapshot
    ? snapshotToReview(detail.review_snapshot)
    : null;
  const serviceData = detail?.service_snapshot
    ? snapshotToService(detail.service_snapshot)
    : null;
  const party =
    detail && active && PARTY_KINDS.includes(active.kind)
      ? {
          name: detail.subject.name ?? active.target,
          role: active.targetRole,
          avatarId: detail.subject.avatar,
          profile: toRow(detail).targetProfile,
        }
      : null;

  // Клиент, чью историю чатов открываем из карточки жалобы: если объект жалобы —
  // пользователь, это он сам (`subject_id`); иначе (жалоба на мастера/салон) —
  // заявитель-клиент (`reporter.user_id`). Диалог открываем по `dialog_id`.
  const chatClientId =
    detail?.subject.type === "USER"
      ? detail.subject.subject_id
      : (detail?.reporter.user_id ?? null);

  // Шаблоны текстов решений — префетчим, пока открыт разбор жалобы, чтобы к
  // моменту выбора решения поля подставились без задержки.
  const templatesQuery = useResolutionTemplates(
    active &&
      active.status === "open" &&
      (modal === "case" || modal === "reason" || modal === "decision")
      ? active.id
      : null,
  );

  const resolveMutation = useResolveComplaint();

  // «Глаз» (просмотр жалобы): открытая жалоба на отзыв → двухколоночный разбор
  // «Жалоба №N» с кнопкой решения; остальные — причина/решение.
  const openComplaint = (c: Complaint) => {
    setActive(c);
    if (c.status !== "open") setModal("reason");
    else if (
      c.kind === "review" ||
      c.kind === "service" ||
      PARTY_KINDS.includes(c.kind)
    )
      setModal("case");
    else setModal("reason");
  };

  // Клик по имени/виду жалобы: для отзыва/услуги — карточка содержимого,
  // для остальных — разбор причины.
  const openSubject = (c: Complaint) => {
    setActive(c);
    if (c.kind === "review") setModal("review");
    else if (c.kind === "service") setModal("service");
    else setModal("reason");
  };

  const resolve = async (
    resolution: string,
    messages: {
      reporterMessage: string;
      subjectMessage: string;
      comment: string;
    },
  ) => {
    if (!active) return;
    try {
      await resolveMutation.mutateAsync({
        id: active.id,
        body: {
          resolution: resolution as ComplaintResolution,
          reporter_message: messages.reporterMessage,
          subject_message: messages.subjectMessage,
          comment: messages.comment,
        },
      });
      toast.success("Решение вынесено");
    } catch (err) {
      toast.error(
        "Не удалось вынести решение",
        err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
      );
      // Пробрасываем — модалка покажет инлайн-ошибку и останется открытой.
      throw err;
    }
  };

  const totalDelta = formatDelta(stats?.total_complaints_change_percent);
  const openDelta = formatDelta(stats?.open_complaints_change_percent);
  const closedDelta = formatDelta(stats?.closed_complaints_change_percent);

  const decisionOptions = (detail?.available_resolutions ?? []).map((r) => ({
    value: r,
    label: RESOLUTION_LABEL[r],
  }));


  return (
    <>
      <UserInfoDialog
        key={`client-${profileTarget?.id}`}
        open={profileTarget?.role === "CLIENT" && clientQuery.isSuccess}
        onOpenChange={(open) => !open && setProfileTarget(null)}
        client={clientQuery.data}
      />
      <MasterProfileDialog
        key={`master-${profileTarget?.id}`}
        open={profileTarget?.role === "MASTER" && providerQuery.isSuccess}
        onOpenChange={(open) => !open && setProfileTarget(null)}
        profile={providerQuery.data as AdminMasterProfile | undefined}
      />
      <SalonProfileDialog
        key={`salon-${profileTarget?.id}`}
        open={profileTarget?.role === "SALON" && providerQuery.isSuccess}
        onOpenChange={(open) => !open && setProfileTarget(null)}
        profile={providerQuery.data as AdminSalonProfile | undefined}
      />
      <ComplaintReasonDialog
        key={active?.id}
        open={modal === "reason" && detailQuery.isSuccess}
        onOpenChange={(o) => !o && setModal(null)}
        disputeNo={active?.disputeNo ?? ""}
        reason={detail?.reason ?? ""}
        onDecision={
          active?.status === "open" ? () => setModal("decision") : undefined
        }
        resolution={
          active?.status === "closed" && detail?.resolution
            ? {
                label: RESOLUTION_LABEL[detail.resolution],
                comment: detail.resolution_comment ?? "",
                manager: reviewerName(detail.resolved_by ?? null),
              }
            : undefined
        }
      />

      <ComplaintDecisionDialog
        open={modal === "decision"}
        onOpenChange={(o) => !o && setModal(null)}
        options={decisionOptions}
        templates={templatesQuery.data}
        onSubmit={resolve}
      />

      <ComplaintReviewDialog
        open={modal === "review" && detailQuery.isSuccess}
        onOpenChange={(o) => !o && setModal(null)}
        review={reviewData}
        onOpenProfile={setProfileTarget}
      />

      <ComplaintServiceDialog
        open={modal === "service" && detailQuery.isSuccess}
        onOpenChange={(o) => !o && setModal(null)}
        service={serviceData}
        onOpenProfile={setProfileTarget}
      />

      <ComplaintCaseDialog
        open={modal === "case" && detailQuery.isSuccess}
        onOpenChange={(o) => !o && setModal(null)}
        disputeNo={active?.disputeNo ?? ""}
        review={active?.kind === "review" ? reviewData : null}
        photoIds={detail?.complaint_media_ids}
        service={active?.kind === "service" ? serviceData : null}
        party={party}
        onOpenProfile={setProfileTarget}
        onViewChat={
          party && detail?.dialog_id != null && chatClientId != null
            ? () =>
                setChatTarget({
                  clientId: chatClientId,
                  dialogId: detail.dialog_id as number,
                })
            : undefined
        }
        reason={detail?.reason ?? active?.reasonPreview ?? ""}
        text={detail?.complaint_text ?? ""}
        onDecision={() => setModal("decision")}
      />

      {/* История чатов клиента из карточки жалобы, открытая на нужном диалоге. */}
      <ChatViewDialog
        key={chatTarget?.dialogId}
        open={chatTarget != null}
        onOpenChange={(o) => !o && setChatTarget(null)}
        clientId={chatTarget?.clientId ?? null}
        initialDialogId={chatTarget?.dialogId ?? null}
        restrictToDialog
      />

      <DateFilter value={range} onChange={setRange} />

      {/* KPI-карточки */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Всего жалоб"
          value={formatCount(stats?.total_complaints)}
          delta={totalDelta.text}
          deltaUp={totalDelta.up}
          icon={ClipboardList}
          tone="brand"
        />
        <StatCard
          title="Открытые жалобы"
          value={formatCount(stats?.open_complaints)}
          delta={openDelta.text}
          deltaUp={openDelta.up}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          title="Закрыто"
          value={formatCount(stats?.closed_complaints)}
          delta={closedDelta.text}
          deltaUp={closedDelta.up}
          icon={Ban}
          tone="danger"
        />
        <StatCard
          title="Ср. время решения"
          value={formatDays(stats?.average_resolution_days)}
          icon={Clock}
          tone="warning"
        />
      </div>

      <Card className="flex flex-col gap-5">
        {/* Поиск + табы */}
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по участнику жалобы"
            className="max-w-[547px]"
          />
          <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl sm:ml-auto bg-grey-4/60 p-1">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  "rounded-lg px-5 py-2 text-sm font-medium transition-colors",
                  status === value
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-base text-ink-muted">
            Загрузка жалоб…
          </p>
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-base text-danger">Не удалось загрузить жалобы.</p>
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
              <ComplaintsTable
                onOpenProfile={setProfileTarget}
                rows={rows}
                onOpenSubject={openSubject}
                onDetail={openComplaint}
                kindHeader={
                  <CheckboxFilterMenu
                    label="вид жалобы"
                    options={TYPE_OPTIONS}
                    selected={types}
                    onApply={setTypes}
                  />
                }
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
}
