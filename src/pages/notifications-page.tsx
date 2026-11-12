import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteNotifications } from "@/lib/api/infinite-lists";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Card,
  ConfirmDeleteNotificationDialog,
  DataTable,
  IconButton,
  NotificationFormDialog,
  SearchInput,
  SegmentTabs,
  type NotificationFormInitial,
  type NotificationFormValues,
} from "@/components";
import { useToast } from "@/components/ui";
import {
  useCreateNotification,
  useDeleteNotification,

  useUpdateNotification,
  type AdminNotification,
  type CreateAdminNotificationBody,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationConditionOperator,
  type NotificationDelayUnit,
  type NotificationEvent,
  type NotificationTriggerTiming,
} from "@/lib/api";

/* ------------------------------------------------------------------ словари */

const PAGE_SIZE = 10;

/** Вкладки: Общие (постоянные) / Рассылки (разовые по расписанию). */
type Tab = "CONTINUOUS" | "SCHEDULED_ONCE";
const TABS: { value: Tab; label: string }[] = [
  { value: "CONTINUOUS", label: "Общие" },
  { value: "SCHEDULED_ONCE", label: "Рассылки" },
];

/** Аудитория → «Группа». */
const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  ALL: "Все",
  CLIENTS: "Клиенты",
  MASTERS: "Мастера",
  SALONS: "Салоны",
};

/** Канал → «Тип». */
const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  IN_APP: "Уведомление",
  PUSH: "Пуш",
  EMAIL: "Email",
};

/** Тайминг триггера (ключевое слово, показываем в верхнем регистре). */
const TIMING_WORD: Record<NotificationTriggerTiming, string> = {
  IMMEDIATELY: "При",
  AFTER: "После",
  BEFORE: "Перед",
};

/** Событие в родительном падеже — для строки триггера («после регистрации»). */
const EVENT_GENITIVE: Record<NotificationEvent, string> = {
  USER_REGISTERED: "регистрации",
  PROFILE_COMPLETED: "заполнения профиля",
  PHONE_CONFIRMED: "подтверждения телефона",
  SERVICE_PURCHASED: "покупки услуги",
  RECORD_CREATED: "создания записи",
  RECORD_CONFIRMED: "подтверждения записи",
  RECORD_RESCHEDULED: "переноса записи",
  RECORD_CANCELED: "отмены записи",
  RECORD_COMPLETED: "завершения записи",
  RECORD_STARTING: "начала записи",
  PAYMENT_SUCCEEDED: "успешной оплаты",
  PAYMENT_FAILED: "неудачной оплаты",
  NEW_MESSAGE_RECEIVED: "нового сообщения",
  SUPPORT_REPLY_RECEIVED: "ответа поддержки",
  REVIEW_CREATED: "создания отзыва",
  REVIEW_REQUESTED: "запроса отзыва",
  REPEAT_RECORD_CREATED: "повторной записи",
};

/** Событие как предикат условия («если [НЕ] заполнен профиль»). */
const EVENT_PREDICATE: Record<NotificationEvent, string> = {
  USER_REGISTERED: "зарегистрирован",
  PROFILE_COMPLETED: "заполнен профиль",
  PHONE_CONFIRMED: "подтверждён телефон",
  SERVICE_PURCHASED: "куплена услуга",
  RECORD_CREATED: "создана запись",
  RECORD_CONFIRMED: "подтверждена запись",
  RECORD_RESCHEDULED: "перенесена запись",
  RECORD_CANCELED: "отменена запись",
  RECORD_COMPLETED: "завершена запись",
  RECORD_STARTING: "начата запись",
  PAYMENT_SUCCEEDED: "прошла оплата",
  PAYMENT_FAILED: "оплата не прошла",
  NEW_MESSAGE_RECEIVED: "получено сообщение",
  SUPPORT_REPLY_RECEIVED: "получен ответ поддержки",
  REVIEW_CREATED: "создан отзыв",
  REVIEW_REQUESTED: "запрошен отзыв",
  REPEAT_RECORD_CREATED: "создана повторная запись",
};

/** Единица задержки. */
const DELAY_UNIT_WORD: Record<NotificationDelayUnit, string> = {
  MINUTES: "мин",
  HOURS: "ч",
  DAYS: "дней",
};

/** Акцентная (фиолетовая) часть строки триггера. */
const Accent = ({ children }: { children: string }) => (
  <span className="font-medium uppercase text-brand">{children}</span>
);

/**
 * Человекочитаемая строка триггера: тайминг + событие + условия + задержка.
 * Напр. «ПОСЛЕ регистрации, если НЕ заполнен профиль».
 */
function renderTrigger(n: AdminNotification) {
  const { timing, event, delay } = n.trigger;
  return (
    <span className="text-base leading-snug text-ink">
      <Accent>{TIMING_WORD[timing]}</Accent> {EVENT_GENITIVE[event]}
      {n.conditions.map((c) => (
        <span key={c.id}>
          , если{" "}
          {(c.operator as NotificationConditionOperator) === "NOT_OCCURRED" && (
            <Accent>НЕ</Accent>
          )}{" "}
          {EVENT_PREDICATE[c.event]}
        </span>
      ))}
      {delay && (
        <>
          {" "}
          <Accent>{TIMING_WORD[timing]}</Accent> {delay.value}{" "}
          {DELAY_UNIT_WORD[delay.unit]}
        </>
      )}
    </span>
  );
}

/** Каналы через запятую (может быть несколько). */
const channelsLabel = (channels: NotificationChannel[]) =>
  channels.map((c) => CHANNEL_LABEL[c]).join(", ");

/** Дата/время рассылки: «21.10.2026 в 16:00». */
const formatSchedule = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd.MM.yyyy 'в' HH:mm") : "—";

/* --------------------------------------------------------------------- экран */

const NotificationsPage = () => {
  const [tab, setTab] = useState<Tab>("CONTINUOUS");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  // Уведомление под редактирование / удаление (клик по строке).
  const [editing, setEditing] = useState<AdminNotification | null>(null);
  const [deleting, setDeleting] = useState<AdminNotification | null>(null);

  const isScheduled = tab === "SCHEDULED_ONCE";

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);


  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteNotifications({
    mode: tab,
    query: debouncedQuery || undefined,

    limit: PAGE_SIZE,
  });

  const createMutation = useCreateNotification();
  const updateMutation = useUpdateNotification();
  const deleteMutation = useDeleteNotification();
  const toast = useToast();

  /** Значения формы → тело create/update (общая часть; `broadcast` — рассылка). */
  const buildBody = (
    v: NotificationFormValues,
    broadcast: boolean,
    original?: AdminNotification,
  ): CreateAdminNotificationBody => {
    const scheduledAt =
      v.scheduledDate && v.scheduledTime
        ? new Date(`${v.scheduledDate}T${v.scheduledTime}`).toISOString()
        : undefined;
    return {
      execution: broadcast
        ? { mode: "SCHEDULED_ONCE", scheduled_at: scheduledAt }
        : { mode: "CONTINUOUS" },
      trigger: broadcast
        ? original?.trigger ?? { event: v.event, timing: "IMMEDIATELY" }
        : { event: v.event, timing: v.timing, ...(v.delay ? { delay: v.delay } : {}) },
      conditions: broadcast
        ? original?.conditions ?? []
        : v.conditions.map((c) => ({ event: c.event, operator: c.operator })),
      audience: v.audience,
      channels: v.channels,
      // API требует title (1–255); если не задан — берём начало текста.
      title: v.title || v.message.slice(0, 255),
      message: v.message,
    };
  };

  /** Уведомление из API → префилл формы редактирования. */
  const toFormInitial = (n: AdminNotification): NotificationFormInitial => {
    const at = n.execution.scheduled_at
      ? parseISO(n.execution.scheduled_at)
      : undefined;
    return {
      timing: n.trigger.timing,
      event: n.trigger.event,
      delay: n.trigger.delay
        ? { value: n.trigger.delay.value, unit: n.trigger.delay.unit }
        : undefined,
      conditions: n.conditions.map((c) => ({
        operator: c.operator,
        event: c.event,
      })),
      audience: n.audience,
      channels: n.channels,
      title: n.title,
      message: n.message,
      scheduledDate: at,
      scheduledTime: at ? format(at, "HH:mm") : undefined,
    };
  };

  const handleCreate = async (values: NotificationFormValues) => {
    try {
      await createMutation.mutateAsync(buildBody(values, isScheduled));
      toast.success(isScheduled ? "Рассылка создана" : "Уведомление создано");
    } catch (err) {
      toast.error(
        "Не удалось создать",
        err instanceof Error ? err : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  const handleUpdate = async (values: NotificationFormValues) => {
    if (!editing) return;
    const broadcast = editing.execution.mode === "SCHEDULED_ONCE";
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        body: buildBody(values, broadcast, editing),
      });
      toast.success("Изменения сохранены");
    } catch (err) {
      toast.error(
        "Не удалось сохранить",
        err instanceof Error ? err : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(
        deleting.execution.mode === "SCHEDULED_ONCE"
          ? "Рассылка удалена"
          : "Уведомление удалено",
      );
      setDeleting(null);
    } catch (err) {
      toast.error(
        "Не удалось удалить",
        err instanceof Error ? err : "Попробуйте ещё раз.",
      );
      throw err;
    }
  };

  const rows = data?.items ?? [];

  const columns = useMemo<ColumnDef<AdminNotification>[]>(() => {
    const base: ColumnDef<AdminNotification>[] = [
      {
        accessorKey: "trigger",
        meta: { mobileLabel: "Триггер", wrap: true },
        header: () => <span>триггер</span>,
        cell: ({ row }) => renderTrigger(row.original),
      },
      {
        accessorKey: "audience",
        meta: { mobileLabel: "Группа" },
        header: () => <span>группа</span>,
        cell: ({ row }) => <span>{AUDIENCE_LABEL[row.original.audience]}</span>,
      },
      {
        accessorKey: "channels",
        meta: { mobileLabel: "Тип" },
        header: () => <span>тип</span>,
        cell: ({ row }) => <span>{channelsLabel(row.original.channels)}</span>,
      },
    ];

    if (isScheduled) {
      base.push({
        id: "scheduled_at",
        meta: { mobileLabel: "Дата и время" },
        header: () => <span>дата и время</span>,
        cell: ({ row }) => (
          <span>{formatSchedule(row.original.execution.scheduled_at)}</span>
        ),
      });
    }

    base.push(
      {
        accessorKey: "message",
        meta: { mobileLabel: "Текст" },
        header: () => <span>текст</span>,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-ink-muted">
            {row.original.message}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">действия</span>,
        meta: { mobileLabel: "Действия", cellClassName: "flex justify-end gap-2" },
        cell: ({ row }) => (
          <>
            <IconButton
              icon={Pencil}
              label="Изменить"
              onClick={() => setEditing(row.original)}
            />
            <IconButton
              icon={Trash2}
              label="Удалить"
              onClick={() => setDeleting(row.original)}
              className="text-danger hover:bg-danger/5"
            />
          </>
        ),
      },
    );

    return base;
  }, [isScheduled]);

  const grid = isScheduled
    ? "grid grid-cols-[2.2fr_0.9fr_0.9fr_1.2fr_1.6fr_auto] items-center gap-4"
    : "grid grid-cols-[2.5fr_1fr_1fr_2fr_auto] items-center gap-4";


  return (
    <>
      <NotificationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        variant={isScheduled ? "broadcast" : "notification"}
        onSubmit={handleCreate}
      />

      {/* Редактирование: та же форма с префиллом кликнутой записи (key — сброс). */}
      <NotificationFormDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        variant={
          editing?.execution.mode === "SCHEDULED_ONCE"
            ? "broadcast"
            : "notification"
        }
        initial={editing ? toFormInitial(editing) : undefined}
        onSubmit={handleUpdate}
      />

      <ConfirmDeleteNotificationDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        isBroadcast={deleting?.execution.mode === "SCHEDULED_ONCE"}
        onConfirm={handleDelete}
      />

      <Card>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по уведомлениям"
            className="w-full sm:max-w-[420px]"
          />
          <SegmentTabs value={tab} onChange={setTab} options={TABS} />
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="self-start sm:ml-auto shrink-0 cursor-pointer text-sm font-medium text-brand transition-opacity hover:opacity-70"
          >
            + Добавить
          </button>
        </div>

        <div className="mt-9">
          {isLoading ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Загрузка уведомлений…
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
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-base text-ink-muted">
              Уведомлений нет.
            </p>
          ) : (
            <>
              <div
                className={
                  isFetching ? "opacity-60 transition-opacity" : undefined
                }
              >
                <DataTable data={rows} columns={columns} gridClassName={grid} />
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

export default NotificationsPage;
