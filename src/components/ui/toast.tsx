import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Тип тоста: успех (зелёный), ошибка (красный), инфо (брендовый). */
export type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Помечен на выход — проигрываем анимацию исчезновения перед удалением. */
  leaving?: boolean;
};

type ToastInput = {
  variant?: ToastVariant;
  title: string;
  description?: string;
  /** Автозакрытие, мс (по умолчанию 4000). */
  duration?: number;
};

type ToastApi = {
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Доступ к тостам. Требует обёртки `<ToastProvider>` выше по дереву. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast должен вызываться внутри <ToastProvider>");
  return ctx;
}

const EXIT_MS = 180;
const DEFAULT_DURATION = 4000;

/**
 * Провайдер тостов: держит очередь и рендерит вьюпорт по центру сверху экрана.
 * Оборачивает приложение один раз (в `main.tsx`); фидбэк вызывается через
 * `useToast()` — `success` / `error` / `info` или общий `toast`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((list) =>
        list.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
      setTimeout(() => remove(id), EXIT_MS);
    },
    [remove],
  );

  const push = useCallback(
    (input: ToastInput) => {
      const id = (idRef.current += 1);
      setToasts((list) => [
        ...list,
        {
          id,
          variant: input.variant ?? "info",
          title: input.title,
          description: input.description,
        },
      ]);
      setTimeout(() => dismiss(id), input.duration ?? DEFAULT_DURATION);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (title, description) => push({ variant: "success", title, description }),
      error: (title, description) => push({ variant: "error", title, description }),
      info: (title, description) => push({ variant: "info", title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Иконка и цвет кружка по типу тоста. */
const VARIANT_META: Record<
  ToastVariant,
  { icon: typeof Check; iconWrap: string }
> = {
  success: { icon: Check, iconWrap: "bg-success-bg text-success-fg" },
  error: { icon: X, iconWrap: "bg-danger-bg text-danger" },
  info: { icon: Info, iconWrap: "bg-[#e8dbff] text-brand" },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const { icon: Icon, iconWrap } = VARIANT_META[toast.variant];
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-[440px] items-start gap-3 rounded-2xl border border-grey-4 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
        "duration-200",
        toast.leaving
          ? "animate-out fade-out slide-out-to-top-2"
          : "animate-in fade-in slide-in-from-top-2",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          iconWrap,
        )}
      >
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <p className="text-sm font-semibold leading-[1.3] text-ink">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-sm leading-[1.35] text-ink-muted">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть"
        className="shrink-0 text-ink/40 transition-opacity hover:opacity-70"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
