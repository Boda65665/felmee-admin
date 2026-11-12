import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { Dialog } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  NotificationAudience,
  NotificationChannel,
  NotificationConditionOperator,
  NotificationDelayUnit,
  NotificationEvent,
  NotificationTriggerTiming,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ModalHeader, ModalShell } from "./modal-shell";

/* ------------------------------------------------------------------ опции */

const TIMING_OPTIONS: { value: NotificationTriggerTiming; label: string }[] = [
  { value: "AFTER", label: "После" },
  { value: "BEFORE", label: "Перед" },
  { value: "IMMEDIATELY", label: "Сразу" },
];

const OPERATOR_OPTIONS: { value: NotificationConditionOperator; label: string }[] = [
  { value: "OCCURRED", label: "Если" },
  { value: "NOT_OCCURRED", label: "Если НЕ" },
];

/** Событие как существительное — для селекта триггера («регистрация»). */
const EVENT_OPTIONS: { value: NotificationEvent; label: string }[] = [
  { value: "USER_REGISTERED", label: "регистрация" },
  { value: "PROFILE_COMPLETED", label: "заполнение профиля" },
  { value: "PHONE_CONFIRMED", label: "подтверждение телефона" },
  { value: "SERVICE_PURCHASED", label: "покупка услуги" },
  { value: "RECORD_CREATED", label: "создание записи" },
  { value: "RECORD_CONFIRMED", label: "подтверждение записи" },
  { value: "RECORD_RESCHEDULED", label: "перенос записи" },
  { value: "RECORD_CANCELED", label: "отмена записи" },
  { value: "RECORD_COMPLETED", label: "завершение записи" },
  { value: "RECORD_STARTING", label: "начало записи" },
  { value: "PAYMENT_SUCCEEDED", label: "успешная оплата" },
  { value: "PAYMENT_FAILED", label: "неудачная оплата" },
  { value: "NEW_MESSAGE_RECEIVED", label: "новое сообщение" },
  { value: "SUPPORT_REPLY_RECEIVED", label: "ответ поддержки" },
  { value: "REVIEW_CREATED", label: "создание отзыва" },
  { value: "REVIEW_REQUESTED", label: "запрос отзыва" },
  { value: "REPEAT_RECORD_CREATED", label: "повторная запись" },
];

/** Событие как предикат — для селекта условия («заполнен профиль»). */
const CONDITION_EVENT_OPTIONS: { value: NotificationEvent; label: string }[] = [
  { value: "USER_REGISTERED", label: "зарегистрирован" },
  { value: "PROFILE_COMPLETED", label: "заполнен профиль" },
  { value: "PHONE_CONFIRMED", label: "подтверждён телефон" },
  { value: "SERVICE_PURCHASED", label: "куплена услуга" },
  { value: "RECORD_CREATED", label: "создана запись" },
  { value: "RECORD_CONFIRMED", label: "подтверждена запись" },
  { value: "RECORD_RESCHEDULED", label: "перенесена запись" },
  { value: "RECORD_CANCELED", label: "отменена запись" },
  { value: "RECORD_COMPLETED", label: "завершена запись" },
  { value: "RECORD_STARTING", label: "начата запись" },
  { value: "PAYMENT_SUCCEEDED", label: "прошла оплата" },
  { value: "PAYMENT_FAILED", label: "оплата не прошла" },
  { value: "NEW_MESSAGE_RECEIVED", label: "получено сообщение" },
  { value: "SUPPORT_REPLY_RECEIVED", label: "получен ответ поддержки" },
  { value: "REVIEW_CREATED", label: "создан отзыв" },
  { value: "REVIEW_REQUESTED", label: "запрошен отзыв" },
  { value: "REPEAT_RECORD_CREATED", label: "создана повторная запись" },
];

const DELAY_UNIT_OPTIONS: { value: NotificationDelayUnit; label: string }[] = [
  { value: "MINUTES", label: "мин" },
  { value: "HOURS", label: "ч" },
  { value: "DAYS", label: "дней" },
];

const AUDIENCE_OPTIONS: { value: NotificationAudience; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "CLIENTS", label: "Клиенты" },
  { value: "MASTERS", label: "Мастера" },
  { value: "SALONS", label: "Салоны" },
];

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: "IN_APP", label: "Уведомление" },
  { value: "PUSH", label: "Пуш" },
  { value: "EMAIL", label: "e-mail" },
];

/** Вариант модалки: обычное уведомление (Общие) или рассылка (по расписанию). */
export type NotificationFormVariant = "notification" | "broadcast";

/** Собранные данные формы для POST/PATCH. */
export type NotificationFormValues = {
  timing: NotificationTriggerTiming;
  event: NotificationEvent;
  /** Задержка триггера (для тайминга AFTER/BEFORE); для IMMEDIATELY отсутствует. */
  delay?: { value: number; unit: NotificationDelayUnit };
  conditions: { operator: NotificationConditionOperator; event: NotificationEvent }[];
  audience: NotificationAudience;
  channels: NotificationChannel[];
  title: string;
  message: string;
  /** Дата рассылки `YYYY-MM-DD` (только для варианта broadcast). */
  scheduledDate?: string;
  /** Время рассылки `HH:mm` (только для варианта broadcast). */
  scheduledTime?: string;
};

/** Префилл формы (режим редактирования). Дата — как `Date`, время — `HH:mm`. */
export type NotificationFormInitial = {
  timing?: NotificationTriggerTiming;
  event?: NotificationEvent;
  delay?: { value: number; unit: NotificationDelayUnit };
  conditions?: { operator: NotificationConditionOperator; event: NotificationEvent }[];
  audience?: NotificationAudience;
  channels?: NotificationChannel[];
  title?: string;
  message?: string;
  scheduledDate?: Date;
  scheduledTime?: string;
};

/* ------------------------------------------------------------- pill-селект */

/** Компактный селект-пилюля (для триггера/условий). */
function PillSelect<T extends string>({
  value,
  onChange,
  options,
  variant = "grey",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  variant?: "grey" | "brand";
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        className={cn(
          "h-9 w-auto rounded-lg border-0 px-3 text-sm font-medium",
          variant === "brand"
            ? "bg-brand text-white [&_svg]:text-white/80"
            : "bg-grey-5 text-ink",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-[10rem]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Подпись секции формы. */
function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------- модалка */

/**
 * Модалка «Создать уведомление» (макеты 4163-23449 / 4163-23641): триггер
 * (тайминг + событие), произвольные условия («Если [НЕ] …»), группа, тип
 * (мультивыбор каналов), «Заголовок» (только при канале «Уведомление»/IN_APP)
 * и текст. Сохранение выполняет обязательный обработчик `onSubmit`.
 */
export function NotificationFormDialog({
  open,
  onOpenChange,
  variant = "notification",
  mode = "create",
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `notification` — с триггером/условиями; `broadcast` — с датой/временем. */
  variant?: NotificationFormVariant;
  /** `create` — «Создать»; `edit` — «Сохранить» с префиллом `initial`. */
  mode?: "create" | "edit";
  /** Начальные значения для редактирования (сброс формы — через `key`). */
  initial?: NotificationFormInitial;
  onSubmit: (values: NotificationFormValues) => void | Promise<void>;
}) {
  const isBroadcast = variant === "broadcast";
  const isEdit = mode === "edit";
  const [timing, setTiming] = useState<NotificationTriggerTiming>(
    initial?.timing ?? "AFTER",
  );
  const [event, setEvent] = useState<NotificationEvent>(
    initial?.event ?? "USER_REGISTERED",
  );
  const [delayValue, setDelayValue] = useState(
    initial?.delay ? String(initial.delay.value) : "1",
  );
  const [delayUnit, setDelayUnit] = useState<NotificationDelayUnit>(
    initial?.delay?.unit ?? "DAYS",
  );
  const [conditions, setConditions] = useState<
    { operator: NotificationConditionOperator; event: NotificationEvent }[]
  >(initial?.conditions ?? [{ operator: "NOT_OCCURRED", event: "PROFILE_COMPLETED" }]);
  const [audience, setAudience] = useState<NotificationAudience>(
    initial?.audience ?? "ALL",
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(
    initial?.channels ?? ["IN_APP"],
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    initial?.scheduledDate,
  );
  const [scheduledTime, setScheduledTime] = useState(initial?.scheduledTime ?? "");
  const [dateOpen, setDateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasInApp = channels.includes("IN_APP");
  const validateSubmission = () => {
    if (!isBroadcast && timing !== "IMMEDIATELY" &&
      (!Number.isInteger(Number(delayValue)) || Number(delayValue) < 1)) {
      return "Укажите задержку целым числом от 1.";
    }
    if (isBroadcast) {
      const scheduledAt = scheduledDate && scheduledTime
        ? new Date(`${format(scheduledDate, "yyyy-MM-dd")}T${scheduledTime}`).getTime()
        : NaN;
      if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
        return "Выберите дату и время рассылки в будущем.";
      }
    }
    return null;
  };
  const canSubmit =
    message.trim() !== "" &&
    channels.length > 0 &&
    (!isBroadcast || (scheduledDate != null && scheduledTime !== ""));

  const toggleChannel = (ch: NotificationChannel) =>
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );

  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      { operator: "OCCURRED", event: "SERVICE_PURCHASED" },
    ]);

  const updateCondition = (
    index: number,
    patch: Partial<{ operator: NotificationConditionOperator; event: NotificationEvent }>,
  ) =>
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );

  const removeCondition = (index: number) =>
    setConditions((prev) => prev.filter((_, i) => i !== index));

  const [submitting, setSubmitting] = useState(false);

  const buildValues = (): NotificationFormValues => ({
    timing,
    event,
    ...(timing !== "IMMEDIATELY" && Number(delayValue) > 0
      ? { delay: { value: Number(delayValue), unit: delayUnit } }
      : {}),
    conditions,
    audience,
    channels,
    title: title.trim(),
    message: message.trim(),
    ...(isBroadcast
      ? {
          scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : "",
          scheduledTime,
        }
      : {}),
  });

  const submit = async () => {
    if (!canSubmit || submitting) return;
    const error = validateSubmission();
    setFormError(error);
    if (error) return;
    setSubmitting(true);
    try {
      await onSubmit(buildValues());
      onOpenChange(false);
    } catch {
      // Ошибку покажет вызывающий (тост); модалку оставляем открытой.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="max-w-[528px]">
        <ModalHeader
          title={`${isEdit ? "Редактировать" : "Создать"} ${
            isBroadcast ? "рассылку" : "уведомление"
          }`}
        />

        {/* Триггер — только для обычного уведомления (у рассылки триггера нет) */}
        {!isBroadcast && (
        <div className="flex flex-col gap-2">
          <FieldLabel>Триггер</FieldLabel>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-grey-3 p-2.5">
            <PillSelect value={timing} onChange={setTiming} options={TIMING_OPTIONS} />
            <PillSelect
              value={event}
              onChange={setEvent}
              options={EVENT_OPTIONS}
              variant="brand"
            />
            {timing !== "IMMEDIATELY" && (
              <>
                <span className="text-sm text-ink-muted">через</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className="h-9 w-16 rounded-lg border border-grey-3 bg-white px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
                />
                <PillSelect
                  value={delayUnit}
                  onChange={setDelayUnit}
                  options={DELAY_UNIT_OPTIONS}
                />
              </>
            )}
          </div>

          {conditions.map((c, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-grey-3 p-2.5"
            >
              <PillSelect
                value={c.operator}
                onChange={(v) => updateCondition(i, { operator: v })}
                options={OPERATOR_OPTIONS}
              />
              <PillSelect
                value={c.event}
                onChange={(v) => updateCondition(i, { event: v })}
                options={CONDITION_EVENT_OPTIONS}
              />
              <button
                type="button"
                aria-label="Удалить условие"
                onClick={() => removeCondition(i)}
                className="ml-auto flex size-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-grey-5 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addCondition}
            className="w-fit cursor-pointer text-sm font-medium text-brand transition-opacity hover:opacity-70"
          >
            + добавить условие
          </button>
        </div>
        )}

        {/* Группа пользователей */}
        <div className="flex flex-col gap-2">
          <FieldLabel>Группа пользователей</FieldLabel>
          <div className="w-fit">
            <PillSelect
              value={audience}
              onChange={setAudience}
              options={AUDIENCE_OPTIONS}
            />
          </div>
        </div>

        {/* Тип (каналы) */}
        <div className="flex flex-col gap-2">
          <FieldLabel>Тип</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((ch) => {
              const active = channels.includes(ch.value);
              return (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => toggleChannel(ch.value)}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand text-white"
                      : "bg-grey-5 text-ink hover:bg-grey-4",
                  )}
                >
                  {ch.label}
                  {active && <X className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Заголовок — только для канала «Уведомление» (IN_APP) */}
        {hasInApp && (
          <div className="flex flex-col gap-2">
            <FieldLabel>Заголовок уведомления</FieldLabel>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-grey-3 bg-white p-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
            />
          </div>
        )}

        {/* Текст */}
        <div className="flex flex-col gap-2">
          <FieldLabel>Текст уведомления</FieldLabel>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-grey-3 bg-white p-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
          />
        </div>

        {/* Дата и время — только для рассылки (execution.scheduled_at) */}
        {isBroadcast && (
          <div className="flex flex-col gap-2">
            <FieldLabel>Дата и время</FieldLabel>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger className="flex h-12 min-w-0 items-center justify-between gap-2 rounded-xl border border-grey-3 bg-white px-3.5 text-left text-base outline-none transition-colors focus:border-brand sm:flex-1">
                  <span className={scheduledDate ? "text-ink" : "text-ink/40"}>
                    {scheduledDate
                      ? format(scheduledDate, "dd.MM.yyyy")
                      : "дд.мм.гггг"}
                  </span>
                  <CalendarDays className="size-4 shrink-0 text-ink-muted" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    locale={ru}
                    selected={scheduledDate}
                    onSelect={(d) => {
                      setScheduledDate(d);
                      setDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={scheduledTime}
                onChange={setScheduledTime}
                className="min-w-0 sm:flex-1"
              />
            </div>
          </div>
        )}

        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting
            ? isEdit
              ? "Сохраняем…"
              : "Создаём…"
            : isEdit
              ? "Сохранить"
              : "Создать"}
        </button>
      </ModalShell>
    </Dialog>
  );
}
