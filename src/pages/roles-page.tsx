import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Avatar,
  AccessTable,
  EmployeeFormDialog,
  DeleteEmployeeDialog,
  type Access,
  type AccessRow,
  type EmployeeData,
} from "@/components";
import { useToast } from "@/components/ui";
import {
  ApiError,
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useEmployeePermissions,
  useSetEmployeePermission,
  type AdminEmployee,
  type AdminEmployeeListItem,
  type AdminEmployeePermission,
  type AdminPanelSection,
  type AdminPanelPermissionLevel,
} from "@/lib/api";

/* ------------------------------------------------------------------ данные */

type Employee = EmployeeData & {
  id: number;
};

/** Сотрудник из ответа API → модель карточки (телефон приходит в детали). */
const toEmployee = (item: AdminEmployeeListItem): Employee => ({
  id: item.user_id,
  firstName: item.first_name,
  lastName: item.last_name,
  phone: "",
});

/** Деталь сотрудника (с телефоном) → модель формы редактирования. */
const toEmployeeDetail = (item: AdminEmployee): Employee => ({
  ...toEmployee(item),
  phone: item.phone,
});

/** Уровень доступа из API → значение сегмент-контрола таблицы. */
const ACCESS_BY_LEVEL: Record<AdminPanelPermissionLevel, Access> = {
  FULL: "full",
  READ: "read",
  NONE: "none",
};

/** Значение сегмент-контрола → уровень доступа для API. */
const LEVEL_BY_ACCESS: Record<Access, AdminPanelPermissionLevel> = {
  full: "FULL",
  read: "READ",
  none: "NONE",
};

/** Право сотрудника из API → строка таблицы доступов. */
const toAccessRow = (perm: AdminEmployeePermission): AccessRow => ({
  section: perm.section,
  name: perm.name,
  access: ACCESS_BY_LEVEL[perm.access_level],
});

const fullName = (e: EmployeeData) => `${e.firstName} ${e.lastName}`;

/* -------------------------------------------------------------- карточка */

/** Выбираемая карточка сотрудника с действиями «изменить»/«удалить» при наведении. */
const EmployeeCard = ({
  active,
  employee,
  onEdit,
  onSelect,
  onDelete,
}: {
  active: boolean;
  employee: Employee;
  onEdit: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) => {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border bg-white py-3 pl-4 pr-24 text-left transition-colors",
          active
            ? "border-brand ring-1 ring-brand"
            : "border-grey-4 hover:border-grey-3",
        )}
      >
        <Avatar
          name={fullName(employee)}
          className="size-10 shrink-0 rounded-xl text-sm"
        />

        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold leading-tight text-ink">
            {fullName(employee)}
          </span>

        </div>
      </button>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        <button
          type="button"
          aria-label="Изменить"
          onClick={onEdit}
          className="flex size-9 items-center justify-center rounded-lg bg-white text-ink shadow-sm ring-1 ring-grey-4 transition-colors hover:bg-grey-5"
        >
          <Pencil className="size-3.5" />
        </button>

        <button
          type="button"
          aria-label="Удалить"
          onClick={onDelete}
          className="flex size-9 items-center justify-center rounded-lg bg-white text-danger shadow-sm ring-1 ring-grey-4 transition-colors hover:bg-danger-bg"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- экран */

const RolesPage = () => {
  const toast = useToast();

  /** Текст ошибки из ApiError, иначе — общий фолбэк. */
  const errText = (err: unknown) =>
    err instanceof ApiError ? err.message : "Попробуйте ещё раз.";

  const { data, isLoading, isError, refetch, isFetching } = useEmployees();

  const employees = useMemo(() => (data ?? []).map(toEmployee), [data]);

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const setPermissionMutation = useSetEmployeePermission();

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  // Телефон есть только в детали — грузим её для предзаполнения формы правки.
  const editQuery = useEmployee(editingId);
  const editing = editQuery.data ? toEmployeeDetail(editQuery.data) : null;

  const selected =
    employees.find((e) => e.id === selectedId) ?? employees[0] ?? null;

  const permsQuery = useEmployeePermissions(selected?.id ?? null);

  const rows = useMemo(
    () => (permsQuery.data ?? []).map(toAccessRow),
    [permsQuery.data],
  );

  // Ошибку в create/update/delete пробрасываем, чтобы диалог показал её
  // инлайном и не закрылся; тост дублирует фидбек глобально.
  const createEmployeeFromForm = async (form: EmployeeData) => {
    try {
      const created = await createMutation.mutateAsync({
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
      });
      // Сразу выделяем нового сотрудника — на нём удобно тестировать доступы.
      setSelectedId(created.user_id);
      toast.success("Сотрудник добавлен");
    } catch (err) {
      toast.error("Не удалось добавить сотрудника", errText(err));
      throw err;
    }
  };

  const updateEmployeeFromForm = async (form: EmployeeData) => {
    if (editingId == null) return;
    try {
      await updateMutation.mutateAsync({
        userId: editingId,
        body: {
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
        },
      });
      toast.success("Изменения сохранены");
    } catch (err) {
      toast.error("Не удалось сохранить изменения", errText(err));
      throw err;
    }
  };

  const setRowAccess = (section: string, value: Access) => {
    if (!selected) return;
    // Мутация оптимистичная (откат в onError хука). Успех виден по сегмент-
    // контролу сразу — тост только на ошибку, чтобы не шуметь на каждый клик.
    setPermissionMutation.mutate(
      {
        userId: selected.id,
        section: section as AdminPanelSection,
        accessLevel: LEVEL_BY_ACCESS[value],
      },
      {
        onError: (err) =>
          toast.error("Не удалось изменить доступ", errText(err)),
      },
    );
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    try {
      await deleteMutation.mutateAsync(id);
      // Снимаем выбор, если удалили выбранного — упадём на первого из списка.
      if (selectedId === id) setSelectedId(null);
      setDeleting(null);
      toast.success("Сотрудник удалён");
    } catch (err) {
      toast.error("Не удалось удалить сотрудника", errText(err));
      throw err;
    }
  };

  return (
    <>
      <EmployeeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onSubmit={createEmployeeFromForm}
      />

      <EmployeeFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        mode="edit"
        employee={editing ?? undefined}
        onSubmit={updateEmployeeFromForm}
        key={editingId}
      />

      <DeleteEmployeeDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        name={deleting ? fullName(deleting) : ""}
        onConfirm={confirmDelete}
      />

      {/* Кнопка добавления */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Добавить сотрудника
        </button>
      </div>

      {/* Карточки сотрудников */}
      {isLoading ? (
        <p className="text-sm text-ink-muted">Загрузка сотрудников…</p>
      ) : isError ? (
        <div className="flex items-center gap-3 text-sm text-danger">
          <span>Не удалось загрузить сотрудников.</span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg border border-grey-4 px-3 py-1 text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
          >
            Повторить
          </button>
        </div>
      ) : employees.length === 0 ? (
        <p className="text-sm text-ink-muted">Сотрудников пока нет.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              active={employee.id === selected?.id}
              onSelect={() => setSelectedId(employee.id)}
              onEdit={() => setEditingId(employee.id)}
              onDelete={() => setDeleting(employee)}
            />
          ))}
        </div>
      )}

      {/* Таблица доступов выбранного сотрудника */}
      {selected &&
        (permsQuery.isLoading ? (
          <p className="text-sm text-ink-muted">Загрузка прав…</p>
        ) : permsQuery.isError ? (
          <div className="flex items-center gap-3 text-sm text-danger">
            <span>Не удалось загрузить права сотрудника.</span>
            <button
              type="button"
              onClick={() => permsQuery.refetch()}
              disabled={permsQuery.isFetching}
              className="rounded-lg border border-grey-4 px-3 py-1 text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
            >
              Повторить
            </button>
          </div>
        ) : (
          <AccessTable
            employeeName={fullName(selected)}
            rows={rows}
            onChange={setRowAccess}
          />
        ))}
    </>
  );
};

export default RolesPage;
