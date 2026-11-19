import { cn } from "@/lib/utils";

export type AccountRole = "master" | "salon";

type BadgeRole = AccountRole | "salon-master";

const ROLE: Record<BadgeRole, { label: string; cls: string }> = {
  salon: { label: "Салон", cls: "bg-success-bg text-success-fg" },
  master: { label: "Мастер", cls: "bg-danger-bg text-danger" },
  "salon-master": { label: "Мастер салона", cls: "bg-brand/10 text-brand" },
};

/** Пилюля роли аккаунта. */
export function RoleBadge({ role }: { role: BadgeRole }) {
  const { label, cls } = ROLE[role];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-bold leading-none tracking-tight",
        cls,
        role === "salon-master" && "max-w-full px-2.5 text-center leading-tight",
      )}
    >
      {label}
    </span>
  );
}
