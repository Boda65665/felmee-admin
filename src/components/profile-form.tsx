import { Check, ImageOff, Plus, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFileUrl } from "@/lib/api";
import { useAvailableProviderCategories } from "@/lib/api/masters-salons";
import { cn } from "@/lib/utils";

/**
 * Примитивы форм-профилей (мастер/салон/пользователь): поля, секции, чипы,
 * фото-стрип и чекбоксы. Импортируются напрямую соответствующими модалками
 * (минуя баррель), т.к. это внутренняя кухня этих экранов. Тумблер графика
 * работы — общий `Switch` из `@/components/ui/switch` (Radix).
 */

/** Секция-карточка профиля: заголовок + содержимое на сером фоне. */
export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 w-full flex-col gap-5 rounded-2xl bg-grey-5 p-4 sm:p-6">
      <h3 className="text-base font-semibold leading-none text-ink">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Подпись + однострочный ввод. Совместим с `react-hook-form`: пробрасывает
 * `ref` и остальные пропсы `register(...)` на `<input>`, опц. показывает
 * ошибку валидации под полем.
 */
export const Field = forwardRef<
  HTMLInputElement,
  {
    label: string;
    error?: string;
    className?: string;
  } & InputHTMLAttributes<HTMLInputElement>
>(function Field({ label, error, className, ...rest }, ref) {
  // readOnly/disabled поля не редактируются — не подсвечиваем их при фокусе
  // (иначе по клику вылезает фиолетовая обводка, будто поле активно).
  const interactive = !rest.readOnly && !rest.disabled;
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-sm leading-[1.3] text-ink-muted">{label}</span>
      <input
        ref={ref}
        type="text"
        {...rest}
        className={cn(
          "h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-ink/40 disabled:cursor-not-allowed disabled:bg-grey-5 disabled:text-ink-muted",
          interactive
            ? "focus:border-brand"
            : "cursor-default select-text focus:border-grey-3",
        )}
      />
      {error && <span className="text-xs leading-[1.3] text-danger">{error}</span>}
    </label>
  );
});

/**
 * Подпись + многострочный ввод. Совместим с `react-hook-form`: пробрасывает
 * `ref`/`onChange`/`value` и прочие пропсы на `<textarea>`, опц. показывает
 * ошибку под полем. Read-only профили передают `value` + `readOnly`.
 */
export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  {
    label: string;
    error?: string;
    rows?: number;
    autoGrow?: boolean;
    hideLabel?: boolean;
  } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextAreaField({ label, error, rows = 2, autoGrow = true, hideLabel = false, ...rest }, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setRef = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!autoGrow || !node) return;
    const fit = () => {
      node.style.height = "auto";
      const style = getComputedStyle(node);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      node.style.height = `${node.scrollHeight + border}px`;
    };
    // RHF resets uncontrolled values after mounting; measure after that reset too.
    fit();
    const frame = requestAnimationFrame(fit);
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth !== width) { width = node.clientWidth; fit(); }
    });
    observer.observe(node);
    node.addEventListener("input", fit);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); node.removeEventListener("input", fit); };
  }, [autoGrow, rest.value, rest.defaultValue, rows]);
  // См. `Field`: у read-only/disabled полей гасим фокус-подсветку.
  const interactive = !rest.readOnly && !rest.disabled;
  return (
    <label className="flex min-w-0 w-full flex-col gap-1.5">
      <span className={cn("text-sm leading-[1.3] text-ink-muted", hideLabel && "sr-only")}>{label}</span>
      <textarea
        ref={setRef}
        rows={rows}
        {...rest}
        className={cn(
          "w-full resize-none rounded-xl border border-grey-3 bg-white p-3.5 text-base leading-[1.4] text-ink outline-none transition-colors placeholder:text-ink/40 disabled:cursor-not-allowed disabled:bg-grey-5 disabled:text-ink-muted",
          autoGrow && "overflow-y-hidden",
          interactive
            ? "focus:border-brand"
            : "cursor-default select-text focus:border-grey-3",
        )}
      />
      {error && <span className="text-xs leading-[1.3] text-danger">{error}</span>}
    </label>
  );
});

/**
 * Чип категории; с `add` — пунктирная кнопка «+ Добавить».
 * `forwardRef` + проброс пропсов обязательны: чип используется как
 * `PopoverTrigger asChild` (Radix через Slot вешает ref и `aria/data-*`).
 */
export const CategoryChip = forwardRef<
  HTMLButtonElement,
  { children: ReactNode; add?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>
>(function CategoryChip({ children, add, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex items-center gap-1 rounded-full px-3.5 py-2 text-[11px] font-medium uppercase tracking-wide transition-colors",
        add
          ? "border border-dashed border-grey-2 text-ink hover:bg-grey-5"
          : "border border-grey-3 text-ink-muted",
        className,
      )}
      {...rest}
    >
      {add && <Plus className="size-3.5" />}
      {children}
    </button>
  );
});

/**
 * Редактируемый выбор категорий: чипы выбранных (клик по крестику убирает) +
 * «+ Добавить» с поповером доступных категорий профиля. Значение
 * контролируемое — `selectedIds` + `onChange`.
 */
export function CategoryPicker({
  selectedIds,
  onChange,
  providerId,
  role,
  assignedCategories,
}: {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  providerId: number | null;
  role: "MASTER" | "SALON";
  assignedCategories: { id: number; name: string }[];
}) {
  const { data: available = [], isLoading, isError, refetch } =
    useAvailableProviderCategories(providerId, role);
  const categories = [...new Map(
    [...assignedCategories, ...available].map((category) => [category.id, category]),
  ).values()];
  const [open, setOpen] = useState(false);

  const selected = categories.filter((c) => selectedIds.includes(c.id));
  const toggle = (id: number) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((c) => (
        <CategoryChip
          key={c.id}
          onClick={() => toggle(c.id)}
          className="cursor-pointer gap-1.5 pr-2.5 hover:bg-grey-5"
        >
          {c.name}
          <X className="size-3.5" />
        </CategoryChip>
      ))}
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <CategoryChip add>Добавить</CategoryChip>
        </PopoverTrigger>
        <PopoverContent className="flex max-h-[min(280px,var(--radix-popover-content-available-height))] w-[280px] flex-col gap-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-2 py-2 text-sm text-ink-muted">Загрузка…</p>
          ) : isError ? (
            <button type="button" onClick={() => void refetch()} className="px-2 py-2 text-sm text-ink-muted">
              Повторить загрузку категорий
            </button>
          ) : categories.length === 0 ? (
            <p className="px-2 py-2 text-sm text-ink-muted">Категорий нет</p>
          ) : (
            categories.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex min-h-10 w-full shrink-0 items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm leading-5 text-ink transition-colors",
                    checked ? "bg-grey-5 font-medium" : "hover:bg-grey-5/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
                      checked
                        ? "border-brand bg-brand text-white"
                        : "border-grey-4 bg-white",
                    )}
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 break-words">{c.name}</span>
                </button>
              );
            })
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Фото профиля по int64-id файла — тянет превью-ссылку `useFileUrl(id, "PREVIEW")`.
 * Пока ссылки нет (загрузка/PENDING/нет id) — серый плейсхолдер с иконкой.
 */
export function ProfilePhoto({
  id,
  className = "size-24",
}: {
  id: number | null | undefined;
  className?: string;
}) {
  const { data } = useFileUrl(id ?? null, "PREVIEW");
  if (!data?.url) {
    return (
      <div
        className={cn(
          "flex max-w-full shrink-0 items-center justify-center rounded-xl bg-grey-4 text-ink-muted",
          className,
        )}
      >
        <ImageOff className="size-5" />
      </div>
    );
  }
  return (
    <img
      src={data.url}
      alt=""
      className={cn("max-w-full shrink-0 rounded-xl object-cover", className)}
    />
  );
}

/** Ряд фото профиля по массиву id (примеры работ / интерьер). */
export function ProfilePhotoRow({
  ids,
  size = "size-24",
}: {
  ids: (number | null | undefined)[];
  size?: string;
}) {
  if (ids.length === 0) {
    return <span className="text-sm text-ink-muted">Нет фотографий</span>;
  }
  return (
    <div className="flex flex-wrap gap-3">
      {ids.map((id, i) => (
        <ProfilePhoto key={`${id}-${i}`} id={id} className={size} />
      ))}
    </div>
  );
}

