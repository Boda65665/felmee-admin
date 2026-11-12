import type { ReactNode } from "react";

export type ProfileTarget = { id: number; role: "CLIENT" | "MASTER" | "SALON" };

export function ProfileName({ target, onOpen, children }: {
  target?: ProfileTarget | null;
  onOpen?: (target: ProfileTarget) => void;
  children: ReactNode;
}) {
  return target && target.id > 0 && onOpen ? (
    <button type="button" onClick={() => onOpen(target)} className="max-w-full text-left font-medium text-brand underline underline-offset-2 break-words hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand">
      {children}
    </button>
  ) : <span>{children}</span>;
}
