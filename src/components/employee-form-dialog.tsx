import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** Схема формы сотрудника: имя, фамилия и телефон — все обязательны. */
const schema = z.object({
  firstName: z.string().trim().min(1, "Введите имя").max(100).regex(/^[А-Яа-яЁё]+$/, "Используйте русские буквы"),
  lastName: z.string().trim().min(1, "Введите фамилию").max(100).regex(/^[А-Яа-яЁё]+$/, "Используйте русские буквы"),
  phone: z.string().trim().refine((value) => {
    const digits = value.replace(/\D/g, "").replace(/^8/, "7");
    return /^7\d{10}$/.test(digits);
  }, "Введите российский номер из 11 цифр"),
});

export type EmployeeData = z.infer<typeof schema>;

/** Поле формы: подпись сверху, инпут снизу, ошибка под инпутом. */
function Field({
  label,
  placeholder,
  error,
  register,
}: {
  label: string;
  placeholder: string;
  error?: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm leading-[1.3] text-ink-muted">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        {...register}
        className="h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
      />
      {error && <span className="text-xs leading-[1.3] text-danger">{error}</span>}
    </label>
  );
}

/**
 * Модалка формы сотрудника — в двух режимах: `create` («Добавление
 * сотрудника» / «Добавить») и `edit` («Редактирование сотрудника» /
 * «Сохранить изменения»). Поля: Имя, Фамилия, Контактный телефон
 * (валидация — zod через react-hook-form). В режиме `create` после «Добавить»
 * показывается экран успеха. Предзаполнение — пропом `employee`.
 */
export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employee,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Предзаполнение для режима `edit`. */
  employee?: EmployeeData;
  /**
   * Сохранение данных формы. Промис держит форму в состоянии отправки;
   * при reject показывается ошибка, экран успеха/закрытие не наступают.
   */
  onSubmit: (data: EmployeeData) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", phone: "" },
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Сброс формы под предзаполнение при открытии.
  useEffect(() => {
    if (!open) return;
    reset({
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      phone: employee?.phone ?? "",
    });
    setDone(false);
    setError(null);
  }, [open, employee?.firstName, employee?.lastName, employee?.phone, reset]);

  const submit = handleSubmit(async (data) => {
    setError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      return;
    }
    if (mode === "create") setDone(true);
    else onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-[560px] flex-col gap-6 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        {done ? (
          /* Экран успеха (только для create) */
          <div className="flex flex-col items-center gap-3 pt-8 text-center sm:pt-0">
            <DialogClose
              aria-label="Закрыть"
              className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-lg text-ink-muted transition-opacity hover:opacity-70 sm:right-4 sm:top-4"
            >
              <X className="size-4" />
            </DialogClose>
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-[#e8dbff]">
              <Check className="size-6 text-brand" />
            </span>
            <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              Сотрудник успешно добавлен
            </DialogTitle>
            <DialogDescription className="text-base leading-[1.4] text-ink-muted">
              Теперь он может войти в систему по номеру телефона.
              <br />
              Доступ уже активен.
            </DialogDescription>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            {/* Шапка */}
            <div className="flex w-full items-start justify-between gap-3">
              <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
                {mode === "create"
                  ? "Добавление сотрудника"
                  : "Редактирование сотрудника"}
              </DialogTitle>
              <DialogClose
                aria-label="Закрыть"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
              >
                <X className="size-4" />
              </DialogClose>
            </div>
            <div className="h-px w-full bg-grey-2" />

            {/* Поля */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <Field
                  label="Имя"
                  placeholder="Имя"
                  register={register("firstName")}
                  error={errors.firstName?.message}
                />
                <Field
                  label="Фамилия"
                  placeholder="Фамилия"
                  register={register("lastName")}
                  error={errors.lastName?.message}
                />
              </div>
              <Field
                label="Контактный телефон"
                placeholder="+7 (___) __-__-__"
                register={register("phone")}
                error={errors.phone?.message}
              />
            </div>

            <div className="h-px w-full bg-grey-2" />

            {error && <p className="text-sm leading-[1.3] text-danger">{error}</p>}

            {/* Действия */}
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <DialogClose className="flex h-12 flex-1 items-center justify-center rounded-xl border border-grey-2 text-base text-ink transition-colors hover:bg-grey-5">
                Отмена
              </DialogClose>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand text-base text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting
                  ? "Сохранение…"
                  : mode === "create"
                    ? "Добавить"
                    : "Сохранить изменения"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
