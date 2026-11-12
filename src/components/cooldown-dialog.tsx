import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCooldownStore } from "@/lib/cooldown-store";

/** Формат отсчёта: `M:SS` от минуты, иначе `N сек`. */
function formatLeft(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${seconds} сек`;
}

/**
 * Глобальная модалка «передышки»: показывается при `429 too_many_request` с
 * обратным отсчётом из `data.TTL`. Помогает понять, почему действия временно
 * не проходят. Закрывается автоматически по истечении времени (или вручную).
 */
export function CooldownDialog() {
  const until = useCooldownStore((s) => s.until);
  const code = useCooldownStore((s) => s.code);
  const clear = useCooldownStore((s) => s.clear);
  const [now, setNow] = useState(() => Date.now());

  // Тикаем раз в секунду, пока активен кулдаун.
  useEffect(() => {
    if (until == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [until]);

  const remaining =
    until != null ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  const open = until != null && remaining > 0;

  // Время вышло — сбрасываем кулдаун (закрываем модалку).
  useEffect(() => {
    if (until != null && remaining === 0) clear();
  }, [until, remaining, clear]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && clear()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-center text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Clock className="size-7" />
        </div>
        <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
          Небольшая передышка
        </DialogTitle>
        <DialogDescription className="text-base leading-[1.4] text-ink-muted">
          Слишком много действий подряд. Повторить можно через:
        </DialogDescription>
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-brand">
          {formatLeft(remaining)}
        </span>
        {code && <p className="break-all text-xs text-ink-muted">Код: {code}</p>}
      </DialogContent>
    </Dialog>
  );
}
