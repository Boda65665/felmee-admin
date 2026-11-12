import { ArrowRight, Eye, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AvatarImage } from "./avatar";
import type { ProfileTarget } from "./profile-name";

export type ComplaintStatus = "open" | "closed";
/** Тип объекта жалобы (соответствует `ComplaintSubjectType` в API). */
export type ComplaintKind = "user" | "master" | "salon" | "service" | "review";

export type Complaint = {
  complainantAvatar?: number | null;
  targetAvatar?: number | null;
  complainantProfile?: ProfileTarget;
  targetProfile?: ProfileTarget;
  id: number;
  disputeNo: string;
  status: ComplaintStatus;
  date: string;
  complainant: string;
  target: string;
  targetRole: string;
  kind: ComplaintKind;
  reasonPreview: string;
  manager?: string;
  decision?: string;
};

const KIND_LABEL: Record<ComplaintKind, string> = {
  user: "На пользователя",
  master: "На мастера",
  salon: "На салон",
  service: "На услугу",
  review: "На отзыв",
};

const COLS =
  "grid grid-cols-1 gap-4 md:grid-cols-[110px_minmax(0,1.6fr)_120px_minmax(0,1.7fr)] md:items-center";

/** Бейдж статуса: «Открыт» (зелёный) / «Закрыт» (красный) + дата под ним. */
const StatusCell = ({
  status,
  date,
}: {
  status: ComplaintStatus;
  date: string;
}) => {
  const open = status === "open";
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          open ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            open ? "bg-success" : "bg-danger",
          )}
        />
        {open ? "Открыт" : "Закрыт"}
      </span>
      <span className="text-xs text-ink-muted">{date}</span>
    </div>
  );
};

/** Участник: аватар-инициалы, имя-ссылка и подпись роли. */
const ParticipantCell = ({
  name,
  avatarId,
  showAvatar = true,
  note,
  onClick,
}: {
  name: string;
  avatarId?: number | null;
  showAvatar?: boolean;
  note: string;
  onClick: () => void;
}) => {
  return (
    <div data-slot="complaint-participant" className="grid min-h-8 min-w-0 grid-cols-[32px_minmax(0,1fr)] items-center gap-x-2">
      {showAvatar && <AvatarImage
        id={avatarId}
        name={name}
        className="size-8 rounded-lg bg-grey-4 text-[10px] text-ink-muted"
      />}
      <div className={cn("row-start-1 flex min-w-0 flex-col", showAvatar ? "col-start-2" : "col-span-2 col-start-1")}>
        <button
          type="button"
          title={name}
          onClick={onClick}
          className="max-w-full text-left text-sm font-semibold text-brand underline underline-offset-2 wrap-anywhere md:truncate"
        >
          {name}
        </button>
        <span className="truncate text-xs text-ink-muted">{note}</span>
      </div>
    </div>
  );
};

/**
 * Таблица жалоб — отдельный тип таблицы (не `DataTable`): строки-карточки с
 * рамкой, у закрытых снизу под-строка «Менеджер · Решение». Поиск/табы —
 * снаружи, сюда приходят уже отфильтрованные строки.
 */
export const ComplaintsTable = ({
  rows,
  onOpenSubject,
  onDetail,
  kindHeader,
  onOpenProfile,
}: {
  rows: Complaint[];
  /** Клик по имени / виду жалобы → карточка сущности (отзыв или услуга). */
  onOpenSubject: (complaint: Complaint) => void;
  /** Глаз (открытые и закрытые) → детальный разбор жалобы. */
  onDetail: (complaint: Complaint) => void;
  /** Заголовок колонки «вид жалобы» — слот для фильтра по типу. */
  kindHeader?: ReactNode;
  onOpenProfile?: (target: ProfileTarget) => void;
}) => {
  return (
    <div className="min-w-0 overflow-x-auto">
    <div className="flex min-w-0 flex-col gap-5 md:min-w-[800px]">
      {kindHeader && <div className="text-xs font-medium uppercase text-ink-muted md:hidden">{kindHeader}</div>}
      {/* Заголовки колонок */}
      <div
        className={cn(
          COLS,
          "hidden px-4 text-xs font-medium uppercase tracking-tight text-ink-muted md:grid",
        )}
      >
        <span>статус</span>
        <span>участники</span>
        {kindHeader ?? (
          <span className="flex items-center gap-1.5">
            вид жалобы
            <SlidersHorizontal className="size-3.5" />
          </span>
        )}
        <span>причина</span>
      </div>

      {/* Строки */}
      {rows.length === 0 ? (
        <p className="py-10 text-center text-base text-ink-muted">
          Ничего не найдено
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((c) => (
            <div key={c.id} className="rounded-2xl border border-grey-4 p-4">
              <div className={COLS}>
                <StatusCell status={c.status} date={c.date} />
                <div data-slot="complaint-participants" className="grid min-w-0 grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] sm:items-center">
                  <ParticipantCell
                    name={c.complainant}
                    avatarId={c.complainantAvatar}
                    note="Пожаловался(лась) · клиент"
                    onClick={() => c.complainantProfile && onOpenProfile ? onOpenProfile(c.complainantProfile) : onOpenSubject(c)}
                  />
                  <ArrowRight className="size-4 shrink-0 rotate-90 text-ink-muted sm:rotate-0" />
                  <ParticipantCell
                    name={c.target}
                    avatarId={c.targetAvatar}
                    showAvatar={c.kind !== "review" && c.kind !== "service"}
                    note={`На кого пожаловались · ${c.targetRole}`}
                    onClick={() => c.targetProfile && onOpenProfile ? onOpenProfile(c.targetProfile) : onOpenSubject(c)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSubject(c)}
                  title={KIND_LABEL[c.kind]}
                  className="w-fit max-w-full text-left text-sm text-ink md:truncate"
                >
                  <span className="mb-1 block text-xs text-ink-muted md:hidden">Вид жалобы</span>
                  {KIND_LABEL[c.kind]}
                </button>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-ink-muted wrap-anywhere md:truncate">
                    <span className="mb-1 block text-xs md:hidden">Причина</span>
                    {c.reasonPreview}
                  </span>
                  <button
                    type="button"
                    aria-label="Открыть жалобу"
                    onClick={() => onDetail(c)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-grey-3 text-ink transition-colors hover:bg-grey-5"
                  >
                    <Eye className="size-4" />
                  </button>
                </div>
              </div>

              {/* Решение (закрытые) */}
              {c.status === "closed" && (
                <div className="mt-3 border-t border-grey-4 pt-3 text-xs text-ink-muted wrap-anywhere">
                  Менеджер: {c.manager} · Решение: {c.decision}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
};
