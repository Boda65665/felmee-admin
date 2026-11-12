import { ErrorPopup } from "@/components/error-popup";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type DragEvent,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, useFileUrl, useUploadFile } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Сообщение при 409 на автосохранении подкатегорий — занята услугами. */
const SUBCATEGORY_IN_USE =
  "Нельзя удалить подкатегорию: она используется в услугах.";

/**
 * Подкатегория в форме. `key` — стабильный ключ для React (в т.ч. у новых,
 * ещё не сохранённых). `serverId` есть только у существующих на бэке — он
 * уходит в `category_id` при `PATCH`; его отсутствие означает «создать».
 */
export type Subcategory = { key: string; serverId?: number; name: string };

export type CategoryData = {
  name: string;
  /** id файла обложки (int64) или null, если не задана. */
  imageId: number | null;
  subcategories: Subcategory[];
};

/** Данные формы, уходящие в `onSubmit`. */
export type CategoryFormValues = {
  name: string;
  imageId: number | null;
  subcategories: Subcategory[];
};

/** Схема формы категории: валидируем название (обложка/подкатегории — вне zod). */
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите название")
    .max(100, "Не длиннее 100 символов"),
});

type NameForm = z.infer<typeof schema>;

/** Квадратная кнопка-иконка строки подкатегории (переименовать/сохранить/удалить). */
function IconBtn({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "border-danger/30 text-danger hover:bg-danger-bg"
          : "border-grey-3 text-ink hover:bg-grey-5",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * Модалка формы категории — в двух режимах: `create` («Добавление новой
 * категории» / «Добавить») и `edit` (заголовок — имя категории / «Сохранить
 * изменения»). Название валидируется zod через react-hook-form; обложка
 * (дропзона → превью) и список подкатегорий — локальный стейт. Сохранение —
 * async `onSubmit` (промис держит форму в отправке, при reject показывается
 * ошибка). Без пропа `onSubmit` кнопка просто закрывает модалку.
 */
export function CategoryFormDialog({
  open,
  mode,
  category,
  onSubmit,
  onOpenChange,
  onSubcategoriesChange,
}: {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  /** Предзаполнение для режима `edit`. */
  category?: CategoryData;
  onSubmit?: (values: CategoryFormValues) => Promise<void>;
  /**
   * Автосохранение подкатегорий (режим `edit`): вызывается при каждом
   * добавлении/переименовании/удалении, шлёт полный список на бэк и возвращает
   * реконсилированный список (с серверными `serverId` у новых). Без пропа
   * подкатегории копятся локально и уходят вместе с формой (режим `create`).
   */
  onSubcategoriesChange?: (subs: Subcategory[]) => Promise<Subcategory[]>;
}) {
  const {
    reset,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | Error | null>(null);
  const [imageId, setImageId] = useState<number | null>(null);
  // Локальное превью только что выбранного файла (blob) — до/во время загрузки.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | Error | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [subsSaving, setSubsSaving] = useState(false);

  const uploadMutation = useUploadFile();
  // Ссылка на существующую обложку (когда нет свежего локального превью).
  const coverQuery = useFileUrl(localPreview ? null : imageId);
  const coverUrl = localPreview ?? coverQuery.data?.url ?? null;

  const fileRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  // Сброс формы под предзаполнение — только на переходе закрыто→открыто, чтобы
  // ре-рендеры родителя (пересоздающего `category`) не затирали ввод.
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({ name: category?.name ?? "" });
      setImageId(category?.imageId ?? null);
      setLocalPreview(null);
      setUploading(false);
      setUploadError(null);
      setSubs(category ? category.subcategories.map((s) => ({ ...s })) : []);
      setEditingKey(null);
      setDraft("");
      setError(null);
      setSubsSaving(false);
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickFile() {
    fileRef.current?.click();
  }

  /** Показать локальное превью и загрузить файл (purpose CATEGORY) → image_id. */
  async function handleFile(file: File) {
    const blob = URL.createObjectURL(file);
    setLocalPreview(blob);
    setUploading(true);
    setUploadError(null);
    try {
      const id = await uploadMutation.mutateAsync({
        file,
        purpose: "CATEGORY",
      });
      setImageId(id);
    } catch (err) {
      URL.revokeObjectURL(blob);
      setLocalPreview(null);
      setUploadError(
        err instanceof Error ? err : "Не удалось загрузить обложку",
      );
    } finally {
      setUploading(false);
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  /**
   * Применяет новый список подкатегорий. В режиме `edit` (есть
   * `onSubcategoriesChange`) — оптимистично обновляет и сразу сохраняет на бэк,
   * подменяя список реконсилированным ответом (с серверными id); при ошибке
   * откатывает. В режиме `create` — просто локальный стейт.
   */
  function applySubs(next: Subcategory[]) {
    const prev = subs;
    setSubs(next);
    if (!onSubcategoriesChange) return;
    setSubsSaving(true);
    setError(null);
    onSubcategoriesChange(next)
      .then((reconciled) => setSubs(reconciled))
      .catch((err) => {
        setSubs(prev);
        // 409 — подкатегория занята услугами: понятный текст (как у корневых),
        // а не сырой конфликт-месседж бэка.
        if (err instanceof ApiError && err.status === 409) {
          setError(new ApiError(err.code, SUBCATEGORY_IN_USE, err.status));
        } else {
          setError(
            err instanceof Error
              ? err
              : "Не удалось сохранить подкатегории",
          );
        }
      })
      .finally(() => setSubsSaving(false));
  }

  function addSub() {
    const key = crypto.randomUUID();
    setSubs((prev) => [...prev, { key, name: "" }]);
    setEditingKey(key);
    setDraft("");
  }

  function startEdit(sub: Subcategory) {
    setEditingKey(sub.key);
    setDraft(sub.name);
  }

  function commitEdit() {
    const value = draft.trim();
    const next = value
      ? subs.map((s) => (s.key === editingKey ? { ...s, name: value } : s))
      : subs.filter((s) => s.key !== editingKey);
    setEditingKey(null);
    setDraft("");
    applySubs(next);
  }

  function removeSub(key: string) {
    if (editingKey === key) {
      setEditingKey(null);
      setDraft("");
    }
    applySubs(subs.filter((s) => s.key !== key));
  }

  const submit = handleSubmit(async ({ name }) => {
    if (onSubmit) {
      setError(null);
      try {
        await onSubmit({ name, imageId, subcategories: subs });
      } catch (err) {
        setError(err instanceof Error ? err : "Не удалось сохранить");
        return;
      }
    }
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[640px] flex-col gap-6 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        {/* Шапка */}
        <div className="flex w-full items-start justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
            {mode === "create"
              ? "Добавление новой категории"
              : (category?.name ?? "Категория")}
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>
        <div className="h-px w-full bg-grey-2" />

        <form onSubmit={submit} className="flex flex-col gap-6">
          {/* Обложка */}
          <div className="flex flex-col gap-3">
            <span className="text-base font-semibold text-ink">
              Добавьте обложку категории
            </span>
            {coverUrl ? (
              <div className="relative aspect-square w-full max-w-[240px]">
                <img
                  src={coverUrl}
                  alt=""
                  className="size-full rounded-2xl bg-grey-5 object-contain"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 text-sm font-medium text-white">
                    Загрузка…
                  </div>
                )}
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={uploading}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Изменить
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={pickFile}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-grey-3 bg-grey-5 px-6 py-8 transition-colors hover:bg-grey-4/40"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-[#e8dbff]">
                  <Upload className="size-6 text-brand" />
                </span>
                <span className="text-base font-medium text-ink">
                  Перетащите фото сюда
                </span>
                <span className="text-sm text-ink-muted">или</span>
                <span className="rounded-lg border border-grey-3 bg-white px-4 py-2 text-sm font-medium text-ink">
                  Выбрать файл
                </span>
                <span className="text-xs text-ink-muted">
                  PNG или JPG, до 5 МБ
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={onFile}
            />
            <ErrorPopup error={uploadError} title="Не удалось загрузить обложку" onDismiss={() => setUploadError(null)} />
          </div>

          {/* Название */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm leading-[1.3] text-ink-muted">
              Название категории
            </span>
            <input
              type="text"
              placeholder="Название"
              {...register("name")}
              className="h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
            />
            {errors.name && (
              <span className="text-xs leading-[1.3] text-danger">
                {errors.name.message}
              </span>
            )}
          </label>

          {/* Подкатегории */}
          <div className="flex flex-col gap-3">
            {subs.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">
                    Подкатегории
                  </h3>
                  {subsSaving && (
                    <span className="text-xs leading-none text-ink-muted">
                      Сохранение…
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  {subs.map((sub, i) => (
                    <div
                      key={sub.key}
                      className={cn(
                        "flex items-center gap-3 py-3",
                        i < subs.length - 1 && "border-b border-grey-4",
                      )}
                    >
                      {editingKey === sub.key ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) =>
                            event.key === "Enter" &&
                            (event.preventDefault(), commitEdit())
                          }
                          placeholder="Название подкатегории"
                          className="h-11 min-w-0 flex-1 rounded-xl border border-grey-3 bg-white px-3 text-base text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
                        />
                      ) : (
                        <span className="min-w-0 flex-1 break-words text-base text-ink">
                          {sub.name}
                        </span>
                      )}
                      {editingKey === sub.key ? (
                        <IconBtn
                          icon={Check}
                          label="Сохранить"
                          onClick={commitEdit}
                          disabled={subsSaving}
                        />
                      ) : (
                        <IconBtn
                          icon={Pencil}
                          label="Переименовать"
                          onClick={() => startEdit(sub)}
                          disabled={subsSaving}
                        />
                      )}
                      <IconBtn
                        icon={Trash2}
                        label="Удалить"
                        danger
                        onClick={() => removeSub(sub.key)}
                        disabled={subsSaving}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={addSub}
              disabled={subsSaving || editingKey !== null}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-grey-3 text-base font-medium text-ink transition-colors hover:bg-grey-5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" />
              Добавить подкатегории
            </button>
          </div>

          <div className="h-px w-full bg-grey-2" />

          <ErrorPopup error={error} onDismiss={() => setError(null)} />

          {/* Действия */}
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <DialogClose className="flex h-12 flex-1 items-center justify-center rounded-full border border-grey-2 text-base text-ink transition-colors hover:bg-grey-5">
              Отмена
            </DialogClose>
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-brand text-base text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting
                ? "Сохранение…"
                : mode === "create"
                  ? "Добавить"
                  : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
