/**
 * Правая колонка разбора жалобы: причина и (опц.) полный текст жалобы.
 * Общий блок для `ComplaintCaseDialog` и открытого `ComplaintReasonDialog`.
 */
export function ComplaintReasonBody({
  reason,
  text,
}: {
  reason: string;
  /** Полный текст жалобы; если не задан — блок не показывается. */
  text?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
          Причина
        </span>
        <div className="rounded-xl bg-grey-5 px-4 py-3 text-sm text-ink">
          {reason}
        </div>
      </div>
      {text && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
            Текст жалобы
          </span>
          <div className="rounded-xl bg-grey-5 px-4 py-3 text-sm leading-relaxed text-ink-muted">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
