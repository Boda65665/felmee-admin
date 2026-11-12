import { useEffect, useRef } from "react";
import { CircleAlert } from "lucide-react";
import { Dialog, DialogClose, DialogDescription, DialogTitle } from "./ui/dialog";
import { ModalShell } from "./modal-shell";
import { useErrorPopupStore } from "@/lib/error-popup-store";

/** Bridges existing local form errors into the shared queue without losing their API code. */
export function ErrorPopup({ error, onDismiss, title }: { error: unknown; onDismiss?: () => void; title?: string }) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; });
  useEffect(() => {
    if (error) useErrorPopupStore.getState().show(error, title, () => dismissRef.current?.());
  }, [error, title]);
  return null;
}

export function GlobalErrorPopup() {
  const error = useErrorPopupStore(state => state.items[0]);
  const dismiss = useErrorPopupStore(state => state.dismiss);
  return (
    <Dialog open={Boolean(error)} onOpenChange={open => { if (!open) dismiss(); }}>
      <ModalShell className="sm:max-w-[440px]">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-danger-bg text-danger"><CircleAlert className="size-6" /></div>
        <DialogTitle className="text-xl font-semibold text-ink">{error?.title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-ink-muted">{error?.message}</DialogDescription>
        {error?.code && <p className="break-all rounded-xl bg-grey-5 px-3 py-2 text-xs text-ink-muted">Код: <span className="font-mono text-ink">{error.code}</span></p>}
        {!error?.code && error?.status && <p className="text-xs text-ink-muted">Код HTTP: {error.status}</p>}
        <DialogClose className="flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:opacity-90">Понятно</DialogClose>
      </ModalShell>
    </Dialog>
  );
}
