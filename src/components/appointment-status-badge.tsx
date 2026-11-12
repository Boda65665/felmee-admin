import { StatusPill, type StatusPillMeta } from "./status-pill";

export type AppointmentStatus = "pending" | "completed" | "cancelled";

/** Метаданные статуса записи: подпись, цвет пилюли и наличие иконки-инфо. */
const STATUS_META: Record<AppointmentStatus, StatusPillMeta> = {
  pending: { label: "Ожидание", cls: "bg-warning-bg text-warning", info: true },
  completed: { label: "Завершена", cls: "bg-success-bg text-success-fg" },
  cancelled: { label: "Отменена", cls: "bg-danger-bg text-danger", info: true },
};

/** Пилюля статуса записи (ожидание / завершена / отменена). */
export const AppointmentStatusBadge = ({
  status,
}: {
  status: AppointmentStatus;
}) => {
  return <StatusPill {...STATUS_META[status]} />;
};
