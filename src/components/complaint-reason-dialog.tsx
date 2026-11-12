import { X } from "lucide-react";
import type { ReactNode } from "react";

import { ComplaintReasonBody } from "@/components/review-complaint-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/** Итог решения по закрытой жалобе (для показа под причиной). */
export type ComplaintResolutionInfo = {
  /** Подпись решения (напр. «Удалить отзыв»). */
  label: string;
  comment: string;
  /** Кто вынес решение. */
  manager: string;
};

/** Секция «подпись сверху + серый бокс» (по макету закрытой жалобы). */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
        {label}
      </span>
      <div className="rounded-xl bg-grey-5 px-4 py-3 text-sm leading-[1.5] text-ink">
        {children}
      </div>
    </div>
  );
}

/**
 * Модалка разбора жалобы. Для открытой — причина/текст + кнопка «Вынести
 * решение» (`onDecision`). Для закрытой (`resolution`) — «Решение по жалобе №N»
 * с секциями Причина / Текст жалобы / Менеджер (решение + комментарий) по
 * макету 5181-13510. Открывается по «глазу» в списке.
 */
export function ComplaintReasonDialog({
  open,
  onOpenChange,
  disputeNo,
  reason,
  text,
  onDecision,
  resolution,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disputeNo: string;
  reason: string;
  text?: string;
  /** Если задан — показывается кнопка «Вынести решение». */
  onDecision?: () => void;
  /** Итог решения (для закрытых жалоб). */
  resolution?: ComplaintResolutionInfo;
}) {
  const closed = Boolean(resolution);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-[560px] flex-col gap-5 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-8 sm:py-7 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="text-xl font-semibold tracking-tight text-ink">
            {closed ? `Решение по жалобе №${disputeNo}` : `Спор №${disputeNo}`}
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        {closed && resolution ? (
          <>
            <Section label="Причина">{reason}</Section>

            <Section label="Текст жалобы">
              {text ? (
                <p className="whitespace-pre-line">{text}</p>
              ) : (
                <span className="text-ink-muted">Текст жалобы не предоставлен</span>
              )}
            </Section>

            <Section
              label={
                resolution.manager
                  ? `Менеджер: ${resolution.manager}`
                  : "Решение"
              }
            >
              <p>Решение: {resolution.label}</p>
              {resolution.comment && (
                <p className="mt-3">Комментарий: {resolution.comment}</p>
              )}
            </Section>
          </>
        ) : (
          <>
            <ComplaintReasonBody reason={reason} text={text} />

            {onDecision && (
              <button
                type="button"
                onClick={onDecision}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-medium text-white transition-opacity hover:opacity-90"
              >
                Вынести решение
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
