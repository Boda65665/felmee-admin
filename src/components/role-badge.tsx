import { cn } from "@/lib/utils";

export type AccountRole = "master" | "salon";

/** Цвет пилюли роли: салон — зелёный, мастер — красный. */
const ROLE: Record<AccountRole, { label: string; cls: string }> = {
  salon: { label: "Салон", cls: "bg-success-bg text-success-fg" },
  master: { label: "Мастер", cls: "bg-danger-bg text-danger" },
};

/** Пилюля роли аккаунта (салон / мастер). */
export function RoleBadge({ role }: { role: AccountRole }) {
  const { label, cls } = ROLE[role];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-bold leading-none tracking-tight",
        cls,
      )}
    >
      {label}
    </span>
  );
}
