import { Calendar, Clock, User } from "lucide-react";
import type { ComponentType } from "react";

import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ModalActions,
  ModalButton,
  ModalDivider,
  ModalHeader,
  ModalShell,
} from "./modal-shell";
import { SectionCard } from "./profile-form";
import { AvatarImage } from "./avatar";

/** Состояние записи, определяющее статус-бейдж и поясняющий текст в шапке. */
export type AppointmentViewState = "active" | "waiting" | "completed" | "cancelled";

export type AppointmentService = {
  name: string;
  /** Длительность, отформатированная для показа (напр. «90 мин.»). */
  duration: string;
  /** Стоимость, отформатированная для показа (напр. «1 500 ₽»). */
  price: string;
};

export type AppointmentView = {
  orderId: string;
  state: AppointmentViewState;
  comment: string | null;
  /** Когда создан заказ (напр. «от 04 августа 2026, 10:35»). */
  createdAt: string;
  /** Дата услуги (напр. «Суббота, 8 августа 2026»). */
  date: string;
  /** Интервал времени услуги (напр. «14:00 - 15:30»). */
  timeRange: string;
  /** Длительность услуги (напр. «90 мин.»). */
  duration: string;
  master: {
    name: string;
    salon: string;
    address: string;
    phone: string;
    photoId: number | null;
  };
  client: { name: string; phone: string };
  services: AppointmentService[];
  /** Итоговая сумма заказа (напр. «3 200 ₽»). */
  total: string;
};

/** Подпись, цвет пилюли и поясняющие строки для каждого состояния записи. */
const STATE_META: Record<
  AppointmentViewState,
  { label: string; cls: string }
> = {
  active: {
    label: "запись актуальная",
    cls: "bg-success-bg text-success",
  },
  waiting: {
    label: "ожидает действия",
    cls: "bg-warning-bg text-warning",
  },
  completed: {
    label: "запись завершена",
    cls: "bg-success-bg text-success",
  },
  cancelled: {
    label: "запись отменена",
    cls: "bg-danger-bg text-danger",
  },
};

/** Квадрат с брендовой иконкой (сиреневый фон) — маркер даты/времени/клиента. */
function IconSquare({
  icon: Icon,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-[#e8dbff]",
        className,
      )}
    >
      <Icon className="size-6 text-brand" />
    </div>
  );
}

/**
 * Модалка «Информация по заказу» — открывается по «глазу» в строке записи.
 * Тело (дата/время, мастер, клиент, услуги, итог) одинаково для всех записей;
 * шапка меняется по `state`: актуальная (зелёный), ждём ответ (оранжевый),
 * отменена (красный) — с соответствующими поясняющими строками.
 */
export function AppointmentViewDialog({
  open,
  onOpenChange,
  appointment,
  canCancel = false,
  onRequestCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentView | null;
  /**
   * Можно ли отменить запись. Отмена имеет смысл только для записей в ожидании;
   * для завершённых и отменённых кнопку не показываем. Решает вызывающий по
   * реальному статусу записи.
   */
  canCancel?: boolean;
  /** Нажата «Отмена запись» — открыть модалку отмены с указанием причины. */
  onRequestCancel?: () => void;
}) {
  if (!appointment) return null;

  const { label, cls } = STATE_META[appointment.state];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="max-w-[756px]">
        {/* Шапка: заголовок, статус и поясняющие строки */}
        <div className="flex w-full flex-col gap-2">
          <ModalHeader
            title="Информация по заказу"
            accent={`#${appointment.orderId}`}
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-base font-medium leading-[1.3]",
                  cls,
                )}
              >
                {label}
              </span>
              <span className="text-base leading-[1.3] text-ink-muted">
                {appointment.createdAt}
              </span>
            </div>
            {appointment.comment && (
              <p className="text-base leading-[1.3] text-ink-muted">
                {appointment.comment}
              </p>
            )}
          </div>
        </div>

        <ModalDivider />

        {/* Дата и время услуги */}
        <SectionCard title="Дата и время услуги">
          <div className="flex flex-wrap gap-6">
            <div className="flex gap-2">
              <IconSquare icon={Calendar} className="size-[41px] rounded-lg" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm leading-[1.3] text-ink-muted">дата</span>
                <span className="text-base leading-[1.3] text-ink">
                  {appointment.date}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <IconSquare icon={Clock} className="size-[41px] rounded-lg" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm leading-[1.3] text-ink-muted">время</span>
                <span className="text-base leading-[1.3] text-ink">
                  {appointment.timeRange}{" "}
                  <span className="text-ink-muted">({appointment.duration})</span>
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Мастер */}
        <SectionCard title="Мастер">
          <div className="flex min-w-0 gap-3 sm:gap-5">
            <AvatarImage
              id={appointment.master.photoId}
              name={appointment.master.name}
              className="size-16 shrink-0 rounded-xl object-cover sm:size-[88px]"
            />
            <div className="flex min-w-0 flex-col justify-center gap-1 break-words">
              <span className="text-base leading-[1.3] text-ink">
                {appointment.master.name}
              </span>
              <span className="text-sm leading-[1.3] text-ink-muted">
                {appointment.master.salon}
                <br />
                {appointment.master.address}
              </span>
              <a
                href={`tel:${appointment.master.phone.replace(/[^\d+]/g, "")}`}
                className="w-fit text-sm leading-[1.3] text-brand"
              >
                {appointment.master.phone}
              </a>
            </div>
          </div>
        </SectionCard>

        {/* Клиент */}
        <SectionCard title="Клиент">
          <div className="flex gap-5">
            <IconSquare icon={User} className="size-12 rounded-xl" />
            <div className="flex min-w-0 flex-col justify-center gap-2 break-words">
              <span className="text-base leading-[1.3] text-ink">
                {appointment.client.name}
              </span>
              <a
                href={`tel:${appointment.client.phone.replace(/[^\d+]/g, "")}`}
                className="w-fit text-sm leading-[1.3] text-brand"
              >
                {appointment.client.phone}
              </a>
            </div>
          </div>
        </SectionCard>

        {/* Услуги */}
        <SectionCard title="Услуги">
          <div className="flex w-full flex-col gap-4 border-b border-dashed border-grey-2 pb-4">
            {appointment.services.map((service) => (
              <div key={service.name} className="flex flex-col gap-0.5">
                <span className="text-base leading-[1.3] text-ink">
                  {service.name}
                </span>
                <div className="flex items-center gap-2 text-sm leading-[1.3] text-ink-muted">
                  <span>{service.duration}</span>
                  <span className="size-1 rounded-full bg-current" />
                  <span>{service.price}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex w-full items-center justify-between text-base font-semibold text-ink">
            <span>Итого</span>
            <span>{appointment.total}</span>
          </div>
        </SectionCard>

        <ModalDivider />

        {/* Действия: кнопку отмены показываем только для записей в ожидании
            (для завершённых и отменённых отменять уже нечего) */}
        <ModalActions>
          {canCancel && (
            <ModalButton onClick={onRequestCancel}>Отмена запись</ModalButton>
          )}
          <ModalButton variant="primary" close>
            Закрыть
          </ModalButton>
        </ModalActions>
      </ModalShell>
    </Dialog>
  );
}
