import { cn } from "@/lib/utils";

/** Бейдж с процентом изменения: зелёный (рост) или красный (падение). */
export const DeltaBadge = ({ children, up }: { children: string; up: boolean }) => {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1.5 text-sm font-bold leading-none tracking-tight",
        up ? "bg-success-bg text-success-fg" : "bg-danger/5 text-danger",
      )}
    >
      {children}
    </span>
  );
};
