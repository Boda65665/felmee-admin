import { CalendarDays, CreditCard, User, X } from "lucide-react";
import { format } from "date-fns";

import {
  type AdminReferralInvitee,
  type AdminReferralSystemLevel,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "./avatar";
import { ModalShell } from "./modal-shell";
import { StatusPill } from "./status-pill";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";
import { useInfiniteReferralPartnerCard } from "@/lib/api/infinite-lists";

const numberFmt = new Intl.NumberFormat("ru-RU");

/** Юр. статус партнёра → подпись (null — клиент без бизнеса). */
const businessTypeLabel = (type: string | null | undefined) => {
  switch (type) {
    case "SE":
      return "Самозанятый";
    case "IE":
      return "ИП";
    case "LLC":
      return "ООО";
    default:
      return "Клиент";
  }
};

/** Тип приглашённого → подпись. */
const REFERRED_TYPE_LABEL: Record<
  AdminReferralInvitee["referred_type"],
  string
> = {
  CLIENT: "клиент",
  MASTER: "мастер",
  SALON: "салон",
};

/** Статус приглашённого → подпись + классы пилюли. */
const INVITEE_STATUS: Record<
  AdminReferralInvitee["status"],
  { label: string; cls: string }
> = {
  WAITING_FOR_SERVICE: {
    label: "Ждём первой услуги",
    cls: "bg-warning-bg text-warning",
  },
  NOT_LINKED: { label: "Не привязан", cls: "bg-danger-bg text-danger" },
  ACTIVE: { label: "Активен", cls: "bg-success-bg text-success-fg" },
  EARNINGS_COMPLETED: {
    label: "Начисления завершены",
    cls: "bg-grey-5 text-ink-muted",
  },
};

/** Дата активации `dd.MM.yyyy` (null → «—»). */
const formatActivatedAt = (value: string | null | undefined) =>
  value ? format(new Date(value), "dd.MM.yyyy") : "—";

/** Тон пилюли уровня по level_code. */
const LEVEL_TONE_CLS: Record<string, string> = {
  START: "bg-success/10 text-success",
  DEVELOPMENT: "bg-[#3b82f6]/10 text-[#3b82f6]",
  PROFESSIONAL: "bg-[#7c3aed]/10 text-[#7c3aed]",
  STRATEGIC: "bg-warning/10 text-warning",
};

/** Чип уровня «Название • N%». */
function LevelChip({ level }: { level: AdminReferralSystemLevel }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-medium tracking-tight",
        LEVEL_TONE_CLS[level.level_code] ?? "bg-brand/10 text-brand",
      )}
    >
      {level.title} • {level.reward_percent}%
    </span>
  );
}

/** Ячейка «реферал»: имя + подпись. */
function RefCell({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="flex min-w-0 flex-col break-words">
      <span className="text-base leading-tight text-ink">{name}</span>
      <span className="text-sm leading-tight text-ink-muted">{meta}</span>
    </div>
  );
}

/** Одна метрика сводной полоски: иконка + значение + подпись. */
function SummaryStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof User;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand" />
      <div className="flex flex-col">
        <span className="text-lg font-semibold leading-tight text-ink">
          {value}
        </span>
        <span className="text-sm leading-tight text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

/**
 * Модалка «Информация о партнёре» (макеты 5709-38208 / 5709-38633): шапка с
 * аватаром/именем/уровнями/статусом, сводная полоска (рефералы / начислено /
 * дата активации) и список приглашённых — живые из карточки партнёра
 * (`GET /partners/{id}`). Данные карточки тянутся по `partnerId`.
 */
export function PartnerInfoDialog({
  open,
  onOpenChange,
  partnerId,
  from,
  to,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: number | null;
  from?: string;
  to?: string;
}) {
  const limit = 20;
  const { data: card, isLoading, isError, isFetching, hasNextPage, fetchNextPage, refetch } = useInfiniteReferralPartnerCard(open ? partnerId : null, {
    from,
    to,
    limit,
  });

  if (partnerId == null) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="max-w-[760px]">
        {isLoading ? (
          <p className="py-16 text-center text-base text-ink-muted">
            Загрузка карточки партнёра…
          </p>
        ) : !card ? (
          <p className="py-16 text-center text-base text-danger">
            Не удалось загрузить карточку партнёра.
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="ml-3 underline">Повторить</button>
          </p>
        ) : (
          <>
            {/* Шапка: аватар, имя/мета, чипы уровней и статуса, крестик */}
            <div className="flex w-full items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4">
                <Avatar
                  name={card.name}
                  className="size-[68px] rounded-2xl text-xl"
                />
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
                      {card.name}
                    </DialogTitle>
                    <span className="text-sm text-ink-muted">
                      {businessTypeLabel(card.business_type)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelChip level={card.levels.client} />
                    <LevelChip level={card.levels.business} />
                    <StatusPill
                      label={card.status === "ACTIVE" ? "Активен" : "Неактивен"}
                      cls={
                        card.status === "ACTIVE"
                          ? "bg-success-bg text-success-fg"
                          : "bg-warning-bg text-warning"
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogClose
                aria-label="Закрыть"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
              >
                <X className="size-4" />
              </DialogClose>
            </div>

            {/* Сводная полоска */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl bg-grey-5 p-4 sm:gap-x-12 sm:px-6 sm:py-5">
              <SummaryStat
                icon={User}
                value={String(card.referrals.total)}
                label="Рефералов"
              />
              <SummaryStat
                icon={CreditCard}
                value={`${numberFmt.format(card.total_accrued_rub)} ₽`}
                label="Начислено всего"
              />
              <SummaryStat
                icon={CalendarDays}
                value={formatActivatedAt(card.activated_at)}
                label="дата активации"
              />
            </div>

            {/* Приглашённые (живые из карточки партнёра) */}
            <div className="flex flex-col">
              <div className="hidden grid-cols-[1.6fr_1.5fr_1fr_1fr] gap-3 px-2 pb-3 text-xs font-medium uppercase tracking-tight text-ink-muted md:grid">
                <span>Реферал</span>
                <span>Статус</span>
                <span>Всего начислено</span>
                <span>Дата активации</span>
              </div>
              {card.referrals.items.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">
                  Приглашённых пока нет
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {card.referrals.items.map((row) => (
                    <div
                      key={row.referral_id}
                      className="grid min-w-0 grid-cols-1 items-start gap-3 rounded-2xl border border-grey-4 px-4 py-3 text-base text-ink md:grid-cols-[1.6fr_1.5fr_1fr_1fr] md:items-center"
                    >
                      <RefCell
                        name={row.display_name}
                        meta={REFERRED_TYPE_LABEL[row.referred_type]}
                      />
                      <StatusPill
                        label={INVITEE_STATUS[row.status].label}
                        cls={INVITEE_STATUS[row.status].cls}
                      />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs text-ink-muted md:hidden">Всего начислено</span>
                        <span className="break-words">{numberFmt.format(row.total_accrued_rub)} ₽</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs text-ink-muted md:hidden">Дата активации</span>
                        <span>{formatActivatedAt(row.activated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <InfiniteScrollSentinel
                hasNextPage={hasNextPage}
                isFetching={isFetching}
                isError={isError}
                onLoadMore={() => isError && !hasNextPage ? refetch() : fetchNextPage()}
              />
            </div>
          </>
        )}
      </ModalShell>
    </Dialog>
  );
}
