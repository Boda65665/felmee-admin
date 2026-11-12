import { StatusPill, type StatusPillMeta } from "./status-pill";

export type AccountStatus = "active" | "inactive" | "blocked";

/** Метаданные статуса аккаунта: подпись, цвет пилюли и наличие иконки-инфо. */
const STATUS: Record<AccountStatus, StatusPillMeta> = {
  active: { label: "Активен", cls: "bg-success-bg text-success-fg" },
  inactive: { label: "Неактивен", cls: "bg-warning-bg text-warning", info: true },
  blocked: { label: "Заблокирован", cls: "bg-danger-bg text-danger", info: true },
};

/** Пилюля статуса аккаунта (активен / неактивен / заблокирован) с цветной точкой. */
export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <StatusPill {...STATUS[status]} />;
}
