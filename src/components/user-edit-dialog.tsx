import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { AvatarImage } from "./avatar";
import { CityAutocompleteField } from "./city-autocomplete-field";
import { Field } from "./profile-form";

/** Схема формы клиента. Поля необязательны (дифф на бэке), e-mail — с форматом. */
const schema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  city: z.string().trim(),
  phone: z.string().trim(),
  email: z.union([z.string().trim().email("Неверный e-mail"), z.literal("")]),
});

/** Значения зарегистрированных полей формы (без адреса/гео). */
type UserEditFormValues = z.infer<typeof schema>;

/** Геопозиция выбранного адреса (обязательна для PATCH вместе с `address`). */
export interface Geolocation {
  lat: number;
  lon: number;
}

/** Данные, уходящие в `onSave`: поля формы + адрес с координатами. */
export interface UserEditValues extends UserEditFormValues {
  /** Текст адреса (пусто — если не задан/очищен). */
  address: string;
  /** Координаты выбранного из подсказок адреса; `null` — нет выбора из списка. */
  geolocation: Geolocation | null;
}

/** Предзаполнение формы клиентом. */
export type UserEditInitial = UserEditFormValues & { address: string };

const EMPTY: UserEditFormValues = {
  firstName: "",
  lastName: "",
  city: "",
  phone: "",
  email: "",
};

/**
 * Модалка «Изменение информации пользователя» — открывается кликом по имени
 * клиента в таблице. Поля предзаполняются пропом `initial`, валидация — zod
 * через react-hook-form; сохранение — через `onSave` (промис держит кнопку в
 * состоянии отправки, при reject показывается ошибка и модалка остаётся
 * открытой). Адрес выбирается из подсказок и сохраняется вместе с geolocation.
 */
export function UserEditDialog({
  open,
  onOpenChange,
  initial,
  avatarId,
  blocked = false,
  blockReason,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: UserEditInitial;
  /** int64-id аватара клиента; без него — кружок с инициалами. */
  avatarId?: number | null;
  /** Заблокирован ли клиент — показывает статус-бейдж рядом с аватаром. */
  blocked?: boolean;
  /** Причина блокировки (`block_reason`) — текст рядом с «Заблокирован.». */
  blockReason?: string | null;
  onSave?: (values: UserEditValues) => void | Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserEditFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });
  const [error, setError] = useState<string | null>(null);
  // Адрес и его координаты — вне RHF: координаты появляются только при выборе
  // подсказки, ручной ввод их сбрасывает (gelocation обязателен для PATCH).
  const [address, setAddress] = useState("");
  const [geo, setGeo] = useState<Geolocation | null>(null);

  useEffect(() => {
    if (!open) return;
    // Сбрасываем явными полями (не спредом `initial`), чтобы не тащить весь
    // объект в deps: он пересоздаётся на каждый рендер и сбрасывал бы ввод.
    reset({
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      city: initial?.city ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
    });
    setAddress(initial?.address ?? "");
    // Исходный адрес пришёл без координат — геопозиции пока нет.
    setGeo(null);
    setError(null);
  }, [
    open,
    initial?.firstName,
    initial?.lastName,
    initial?.city,
    initial?.phone,
    initial?.email,
    initial?.address,
    reset,
  ]);

  // Адрес изменили вручную, но не выбрали из списка — координат нет, сохранить
  // такой адрес нельзя. Показываем подсказку и блокируем отправку.
  const addressChanged = address.trim() !== (initial?.address ?? "").trim();
  const addressNeedsGeo = addressChanged && geo === null;

  const submit = handleSubmit(async (values) => {
    if (addressNeedsGeo) return;
    if (onSave) {
      setError(null);
      try {
        await onSave({ ...values, address, geolocation: geo });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить");
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
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[800px] flex-col gap-6 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex w-full items-start justify-between gap-4">
          <DialogTitle className="sr-only">
            Изменение информации пользователя
          </DialogTitle>
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <AvatarImage
              id={avatarId}
              name={initial ? `${initial.firstName} ${initial.lastName}` : ""}
              className="size-14 text-lg"
            />
            {blocked && (
              <span className="inline-flex items-center gap-2 rounded-full bg-danger-bg px-4 py-2 text-sm leading-none">
                <span className="size-1.5 shrink-0 rounded-full bg-danger" />
                <span className="text-ink">
                  <span className="font-bold text-danger">Заблокирован.</span>
                  {blockReason ? ` ${blockReason}` : ""}
                </span>
              </span>
            )}
          </div>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg shrink-0 text-ink-muted transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Имя"
              {...register("firstName")}
              error={errors.firstName?.message}
            />
            <Field
              label="Фамилия"
              {...register("lastName")}
              error={errors.lastName?.message}
            />
            <CityAutocompleteField
              label="Город"
              value={watch("city")}
              onChange={(text) =>
                setValue("city", text, { shouldValidate: true })
              }
              error={errors.city?.message}
            />
            <AddressAutocompleteField
              label="Адрес"
              value={address}
              onChange={(text) => {
                setAddress(text);
                setGeo(null);
              }}
              onSelect={(s) => {
                setAddress(s.address);
                setGeo({ lat: s.lat, lon: s.lon });
              }}
              error={
                addressNeedsGeo ? "Выберите адрес из списка подсказок" : undefined
              }
            />
            <Field
              label="Номер телефона"
              {...register("phone")}
              error={errors.phone?.message}
            />
            <Field
              label="e-mail"
              {...register("email")}
              error={errors.email?.message}
            />
          </div>

          {error && <p className="text-sm leading-[1.3] text-danger">{error}</p>}

          <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-end">
            <DialogClose className="flex h-12 items-center justify-center rounded-xl border border-ink/20 bg-white px-6 text-sm font-medium text-ink transition-colors hover:bg-grey-5">
              Отмена
            </DialogClose>
            <button
              type="submit"
              disabled={isSubmitting || addressNeedsGeo}
              className="flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Сохранение…" : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
