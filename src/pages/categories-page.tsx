import { useEffect, useState } from "react";
import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Card,
  CategoryFormDialog,
  ConfirmDeleteCategoryDialog,
  DeleteCategoryDialog,
  type CategoryData,
  type CategoryFormValues,
  type Subcategory,
} from "@/components";
import { useToast } from "@/components/ui";
import {
  ApiError,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useFileUrl,
  useSubcategories,
  useUpdateCategory,
  type AdminCategoryListItem,
  type AdminCategorySubcategoryUpdate,
  type AdminUpdateCategoryRequest,
} from "@/lib/api";

/* ------------------------------------------------------------------ карточки */

/** Карточка категории: обложка, название, счётчики и действия. */
function CategoryCard({
  category,
  onEdit,
  onDelete,
  deleting,
}: {
  category: AdminCategoryListItem;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  // Обложка: временная ссылка по image_id (файловый пайплайн).
  const { data: cover } = useFileUrl(category.image_id ?? null);

  return (
    <div className="flex flex-col gap-3 border rounded-3xl">
      {/* Обложка (или плейсхолдер, если image_id нет / ссылка не готова). */}
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-grey-5 text-grey-1">
        {cover?.url ? (
          <img
            src={cover.url}
            alt=""
            className="size-full object-contain"
          />
        ) : (
          <ImageOff className="size-8" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold leading-tight text-ink">
            {category.name}
          </h3>

          <span className="text-sm leading-[1.3] text-ink-muted">
            ( {category.children_count} подкатегорий · {category.services_count}{" "}
            услуг )
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-grey-3 text-sm font-medium text-ink transition-colors hover:bg-grey-5"
          >
            <Pencil className="size-4" />
            Изменить
          </button>

          <button
            type="button"
            aria-label="Удалить"
            onClick={onDelete}
            disabled={deleting}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-bg text-danger transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- экран */

export default function CategoriesPage() {
  const { data, isLoading, isError, refetch, isFetching } = useCategories();
  const categories = data ?? [];

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const toast = useToast();

  /** Текст ошибки из ApiError, иначе — общий фолбэк. */
  const errText = (err: unknown) =>
    err instanceof ApiError ? err.message : "Попробуйте ещё раз.";

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [cantDeleteOpen, setCantDeleteOpen] = useState(false);
  // Категория, для которой открыта модалка подтверждения удаления.
  const [confirmTarget, setConfirmTarget] =
    useState<AdminCategoryListItem | null>(null);

  const editing = categories.find((c) => c.id === editingId) ?? null;

  // Существующие подкатегории редактируемой категории — их `id` нужен как
  // `category_id` при сохранении полного списка в PATCH.
  const subsQuery = useSubcategories(editingId);

  // Если подкатегории не загрузились — не открываем форму (иначе сохранение с
  // пустым списком стёрло бы их), закрываем режим редактирования + тост.
  useEffect(() => {
    if (!subsQuery.isError) return;
    toast.error("Не удалось загрузить подкатегории", errText(subsQuery.error));
    setEditingId(null);
  }, [subsQuery.isError, subsQuery.error, toast]);

  const editInitial: CategoryData | undefined = editing
    ? {
        name: editing.name,
        imageId: editing.image_id ?? null,
        subcategories: (subsQuery.data ?? []).map((s) => ({
          key: String(s.id),
          serverId: s.id,
          name: s.name,
        })),
      }
    : undefined;

  const createCategory = async (values: CategoryFormValues) => {
    const subcategories = values.subcategories
      .map((s) => s.name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    try {
      await createMutation.mutateAsync({
        name: values.name,
        ...(values.imageId != null ? { image_id: values.imageId } : {}),
        ...(subcategories.length ? { subcategories } : {}),
      });
      toast.success("Категория создана");
    } catch (err) {
      toast.error("Не удалось создать категорию", errText(err));
      throw err;
    }
  };

  // Полный желаемый список подкатегорий для PATCH: существующие — с
  // `category_id`, новые — без него; удалённые просто отсутствуют. Пустые
  // имена отбрасываем.
  const buildSubArray = (
    subs: Subcategory[],
  ): AdminCategorySubcategoryUpdate[] =>
    subs
      .map((s) => ({ serverId: s.serverId, name: s.name.trim() }))
      .filter((s) => s.name !== "")
      .map((s) =>
        s.serverId != null
          ? { category_id: s.serverId, name: s.name }
          : { name: s.name },
      );

  // Автосохранение подкатегорий: шлёт PATCH и возвращает список с серверными id
  // (из ответа), чтобы новые подкатегории получили `serverId` и при повторной
  // правке не задублировались.
  const persistSubcategories = async (
    subs: Subcategory[],
  ): Promise<Subcategory[]> => {
    if (!editing) return subs;
    try {
      const res = await updateMutation.mutateAsync({
        categoryId: editing.id,
        body: { subcategories: buildSubArray(subs) },
      });
      return (res?.category?.children ?? [])
        .filter((c) => c.id != null)
        .map((c) => ({ key: String(c.id), serverId: c.id, name: c.name ?? "" }));
    } catch (err) {
      // Форма откатит список и покажет инлайн-ошибку; дублируем тостом.
      // 409 — подкатегория занята услугами (как запрет у корневых категорий).
      if (err instanceof ApiError && err.status === 409) {
        toast.error(
          "Нельзя удалить подкатегорию",
          "Она используется в услугах.",
        );
      } else {
        toast.error("Не удалось сохранить подкатегории", errText(err));
      }
      throw err;
    }
  };

  const updateCategory = async (values: CategoryFormValues) => {
    if (!editing) return;
    const body: AdminUpdateCategoryRequest = {
      subcategories: buildSubArray(values.subcategories),
    };
    if (values.name !== editing.name) body.name = values.name;
    // Обложку шлём, только если её сменили (новый непустой image_id).
    if (values.imageId != null && values.imageId !== editing.image_id) {
      body.image_id = values.imageId;
    }
    try {
      await updateMutation.mutateAsync({ categoryId: editing.id, body });
      toast.success("Изменения сохранены");
    } catch (err) {
      toast.error("Не удалось сохранить изменения", errText(err));
      throw err;
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Категория удалена");
    } catch (err) {
      // 409 — в категории есть услуги: показываем инфо-модалку из макета.
      if (err instanceof ApiError && err.status === 409) {
        setCantDeleteOpen(true);
        return;
      }
      toast.error("Не удалось удалить категорию", errText(err));
      throw err;
    }
  };

  return (
    <>
      <CategoryFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onSubmit={createCategory}
      />

      <CategoryFormDialog
        open={editing !== null && subsQuery.isSuccess}
        onOpenChange={(open) => !open && setEditingId(null)}
        mode="edit"
        category={editInitial}
        onSubmit={updateCategory}
        onSubcategoriesChange={persistSubcategories}
        key={editingId}
      />

      <ConfirmDeleteCategoryDialog
        key={confirmTarget?.id}
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        name={confirmTarget?.name ?? ""}
        onConfirm={async () => {
          if (!confirmTarget) return;
          await deleteCategory(confirmTarget.id);
          // Успех или 409 (внутри открылась инфо-модалка) — закрываем подтверждение.
          setConfirmTarget(null);
        }}
      />

      <DeleteCategoryDialog
        open={cantDeleteOpen}
        onOpenChange={setCantDeleteOpen}
      />

      {isLoading ? (
        <p className="text-sm text-ink-muted">Загрузка категорий…</p>
      ) : isError ? (
        <div className="flex items-center gap-3 text-sm text-danger">
          <span>Не удалось загрузить категории.</span>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg border border-grey-4 px-3 py-1 text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
          >
            Повторить
          </button>
        </div>
      ) : (
        <Card className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-6">
          {/* Карточка добавления */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-ink/30 bg-danger-bg text-danger transition-opacity hover:opacity-80"
          >
            {/* <span className="flex size-12 items-center justify-center rounded-xl bg-white"> */}
            <Plus className="size-5" />
            {/* </span> */}

            <span className="text-sm font-normal">
              Добавить новую категорию
            </span>
          </button>

          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={() => setEditingId(category.id)}
              onDelete={() => setConfirmTarget(category)}
              deleting={
                deleteMutation.isPending &&
                deleteMutation.variables === category.id
              }
            />
          ))}
        </Card>
      )}
    </>
  );
}
