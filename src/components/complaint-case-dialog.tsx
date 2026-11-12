import { X } from "lucide-react";

import { AvatarImage } from "@/components/avatar";
import { ReviewCard, type ReviewData } from "@/components/complaint-review-dialog";
import {
  ServiceCard,
  type ServiceData,
} from "@/components/complaint-service-dialog";
import { ComplaintReasonBody } from "@/components/review-complaint-dialog";
import { ProfilePhoto } from "@/components/profile-form";
import { ProfileName, type ProfileTarget } from "./profile-name";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/** Данные карточки «участник» (пользователь/мастер/салон). */
export type ComplaintParty = {
  profile?: ProfileTarget | null;
  name: string;
  /** Роль в подписи: «мастер» / «салон» / «пользователь». */
  role: string;
  /** id аватара участника (int64) — ссылка через `AvatarImage`. */
  avatarId?: number | null;
  /** Услуга·цена·дата показываются, только если есть (в жалобе их может не быть). */
  service?: string;
  price?: string;
  date?: string;
};

/** Карточка участника: аватар+имя+роль, услуга·цена, дата. */
function PartyCard({ party, onOpenProfile }: { party: ComplaintParty; onOpenProfile?: (target: ProfileTarget) => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-grey-5 p-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
        <AvatarImage
          id={party.avatarId}
          name={party.name}
          className="size-11 rounded-full"
        />
        <div className="flex min-w-0 flex-col break-words">
          <span className="text-base font-semibold text-ink"><ProfileName target={party.profile} onOpen={onOpenProfile}>{party.name}</ProfileName></span>
          <span className="text-sm text-ink-muted">{party.role}</span>
        </div>
      </div>
      {(party.service || party.price || party.date) && (
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          {(party.service || party.price) && (
            <span>
              {[party.service, party.price].filter(Boolean).join(" · ")}
            </span>
          )}
          {party.date && <span>{party.date}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Переход в приватный чат участников жалобы. Показывается под любой карточкой
 * объекта (участник/отзыв/услуга), когда у жалобы есть `dialog_id` (`onViewChat`).
 */
function ChatCTA({ onViewChat }: { onViewChat: () => void }) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-grey-5 p-4 sm:flex-row sm:items-center sm:p-5">
      <span className="text-sm text-ink-muted">
        Перейдите в чат для подробностей
      </span>
      <button
        type="button"
        onClick={onViewChat}
        className="min-h-11 shrink-0 rounded-xl border border-grey-3 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-grey-5"
      >
        Перейти в чат
      </button>
    </div>
  );
}

/**
 * Модалка «Жалоба №N» — общий каркас разбора открытой жалобы: слева карточка
 * объекта (участник или отзыв), справа причина, текст жалобы и опц. фото, снизу
 * «Вынести решение». Вариант выбирается пропами `party` / `review`.
 */
export function ComplaintCaseDialog({
  open,
  onOpenChange,
  disputeNo,
  party,
  review,
  service,
  photoIds,
  reason,
  text,
  onViewChat,
  onDecision,
  onOpenProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disputeNo: string;
  /** Карточка участника (пользователь/мастер/салон). */
  party?: ComplaintParty | null;
  /** Карточка отзыва (жалоба на отзыв). */
  review?: ReviewData | null;
  /** Карточка услуги (жалоба на услугу). */
  service?: ServiceData | null;
  /** id фото, приложенных к жалобе (блок «Фото»); пусто — блок не показывается. */
  photoIds?: number[];
  reason: string;
  text: string;
  /** «Перейти в чат» — если не задан, кнопка не показывается. */
  onViewChat?: () => void;
  onDecision: () => void;
  onOpenProfile?: (target: ProfileTarget) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[1017px] flex-col gap-6 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
            Жалоба №{disputeNo}
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>
        <div className="h-px w-full bg-grey-2" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {review ? (
              <div className="rounded-2xl bg-grey-5 p-5">
                <ReviewCard review={review} onOpenProfile={onOpenProfile} />
              </div>
            ) : service ? (
              <div className="rounded-2xl bg-grey-5 p-5">
                <ServiceCard service={service} onOpenProfile={onOpenProfile} />
              </div>
            ) : party ? (
              <PartyCard party={party} onOpenProfile={onOpenProfile} />
            ) : null}
            {onViewChat && <ChatCTA onViewChat={onViewChat} />}
            {party && !onViewChat && (
              <p className="rounded-2xl bg-grey-5 p-4 text-sm text-ink-muted sm:p-5">
                Диалога между этими пользователями нет.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <ComplaintReasonBody reason={reason} text={text} />
            {photoIds && photoIds.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
                  Фото
                </span>
                <div className="flex flex-wrap gap-3">
                  {photoIds.map((id, i) => (
                    <ProfilePhoto
                      key={`${id}-${i}`}
                      id={id}
                      className="size-[72px] rounded-xl"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-px w-full bg-grey-2" />
        <button
          type="button"
          onClick={onDecision}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          Вынести решение
        </button>
      </DialogContent>
    </Dialog>
  );
}
