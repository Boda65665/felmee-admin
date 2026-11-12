import { X } from "lucide-react";
import { useRef, useState } from "react";

import type { ComplaintResolutionTemplate } from "@/lib/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Вариант решения: значение (enum API) + подпись. */
export type DecisionOption = { value: string; label: string };

/** Текстовые поля решения, уходящие в `resolve`. */
export type DecisionMessages = {
  /** Текст заявителю — отправляется в его чат от имени поддержки. */
  reporterMessage: string;
  /** Текст участнику, на которого пожаловались — в его чат от имени поддержки. */
  subjectMessage: string;
  /** Внутренний комментарий администратора — пользователям не отправляется. */
  comment: string;
};

/** Textarea со счётчиком до 500 символов (лимит из API). */
function MessageField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
        {label}
      </span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.slice(0, 500))}
        rows={4}
        className="w-full resize-none rounded-xl border border-grey-3 bg-white p-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
      />
      <span className="self-end text-xs text-ink-muted">{value.length} / 500</span>
    </label>
  );
}

/**
 * Модалка «Вынести решение» — выбор решения (select из доступных вариантов) и
 * три текстовых поля: сообщение заявителю, сообщение участнику (оба уходят в их
 * чаты от имени поддержки) и внутренний комментарий администратора. `onSubmit`
 * получает решение и все три текста; промис держит кнопку в состоянии отправки,
 * при reject показывается ошибка и модалка остаётся открытой.
 */
export function ComplaintDecisionDialog({
  open,
  onOpenChange,
  options,
  templates,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: DecisionOption[];
  /** Шаблоны текстов по решениям — подставляются при выборе решения. */
  templates?: ComplaintResolutionTemplate[];
  onSubmit?: (
    resolution: string,
    messages: DecisionMessages,
  ) => void | Promise<void>;
}) {
  const [value, setValue] = useState<string>("");
  const [reporterMessage, setReporterMessage] = useState("");
  const [subjectMessage, setSubjectMessage] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  // Сброс при открытии — до отрисовки, чтобы не мигало прошлым вводом.
  if (open && !wasOpen.current) {
    setValue("");
    setReporterMessage("");
    setSubjectMessage("");
    setComment("");
    setSaving(false);
    setError(null);
  }
  wasOpen.current = open;

  // Выбор решения: подставляем шаблонные тексты (если есть) — админ их правит.
  function selectResolution(next: string) {
    setValue(next);
    const template = templates?.find((t) => t.resolution === next);
    if (template) {
      setReporterMessage(template.reporter_message);
      setSubjectMessage(template.subject_message);
      setComment(template.comment);
    }
  }

  const canSubmit =
    value !== "" &&
    reporterMessage.trim() !== "" &&
    subjectMessage.trim() !== "" &&
    comment.trim() !== "" &&
    !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit?.(value, {
        reporterMessage: reporterMessage.trim(),
        subjectMessage: subjectMessage.trim(),
        comment: comment.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось вынести решение");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[90vh] w-full max-w-[460px] flex-col gap-5 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-8 sm:py-7 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="text-xl font-semibold tracking-tight text-ink">
            Вынести решение
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
            Решение
          </span>
          <Select value={value} onValueChange={selectResolution}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите решение" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <MessageField
          label="Ответ тому кто пожаловался"
          placeholder="Опишите принятое решение"
          value={reporterMessage}
          onChange={setReporterMessage}
        />

        <MessageField
          label="Ответ тому на кого пожаловался"
          placeholder="Опишите принятое решение"
          value={subjectMessage}
          onChange={setSubjectMessage}
        />

        <MessageField
          label="Комментарий"
          placeholder="Добавьте свой комментарий для внутренней системы"
          value={comment}
          onChange={setComment}
        />

        {error && <p className="text-sm leading-[1.3] text-danger">{error}</p>}

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <DialogClose className="flex h-12 flex-1 items-center justify-center rounded-xl border border-grey-2 text-base font-medium text-ink transition-colors hover:bg-grey-5">
            Отмена
          </DialogClose>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex h-12 flex-[1.4] items-center justify-center rounded-xl bg-brand text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Отправка…" : "Отправить"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
