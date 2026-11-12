import { ErrorPopup } from "@/components/error-popup";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Dialog } from "@/components/ui/dialog";
import type { AdminSalonProfile, AdminSalonUpdateRequest } from "@/lib/api";
import { findSavedPlace, usePlaceSuggestions, type PlaceSuggestion } from "@/lib/api/suggestions";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { CityAutocompleteField } from "./city-autocomplete-field";
import {
  ModalActions,
  ModalButton,
  ModalDivider,
  ModalHeader,
  ModalShell,
} from "./modal-shell";
import {
  CategoryChip,
  CategoryPicker,
  Field,
  ProfilePhoto,
  ProfilePhotoRow,
  SectionCard,
  TextAreaField,
} from "./profile-form";

/** Схема редактируемых скалярных полей салона. */
const schema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(100),
  city: z.string().trim().min(1, "Укажите город").max(30),
  contactPhone: z.string().trim().max(32),
  description: z.string().trim().max(1000),
  interiorDescription: z.string().trim().max(1000),
});
type FormValues = z.infer<typeof schema>;

type Geo = { lat: number; lon: number };

/**
 * Модалка «Профиль салона» (макет 4754-11009) — открывается кликом по названию
 * салона в таблице. Просмотр данных из `GET /api/admin/salons/{id}` и, по кнопке
 * «Изменить», редактирование в той же модалке: основная информация (название,
 * город, адрес+гео, телефон), категории, описание, описание интерьера. Фото/
 * обложка через PATCH не меняются — остаются на просмотр. Дифф уходит через
 * `onSave`. Адрес сохраняется только вместе с координатами из подсказок (PATCH
 * требует `geolocation`).
 */
export function SalonProfileDialog({
  open,
  onOpenChange,
  profile,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Профиль салона из `useProviderProfile`; пока грузится — undefined. */
  profile?: AdminSalonProfile;
  /** Сохранение диффа. Без него редактирование недоступно (нет кнопки). */
  onSave?: (body: AdminSalonUpdateRequest) => Promise<void>;
}) {
  // Правка доступна, когда передан `onSave` (страница мастеров/салонов). Без
  // него (напр. профиль со страницы «Записи») — только просмотр.
  const editing = Boolean(onSave);
  const [error, setError] = useState<string | Error | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Вне RHF: адрес+координаты (как у клиента) и категории.
  const [address, setAddress] = useState("");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [selectedPlace, setPlace] = useState<PlaceSuggestion | null>(null);
  const [locationEdited, setLocationEdited] = useState(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const city = watch("city") ?? "";
  const savedCityUnchanged = city === (profile?.city ?? "");
  const savedPlaces = usePlaceSuggestions(profile?.city ?? "", open && editing && savedCityUnchanged);
  const place = selectedPlace ?? (savedCityUnchanged ? findSavedPlace(savedPlaces.data ?? [], city) : null);

  // Перезаполнение формы при открытии/смене профиля.
  useEffect(() => {
    if (!open) return;
    reset({
      name: profile?.name ?? "",
      city: profile?.city ?? "",
      contactPhone: profile?.contact_phone ?? "",
      description: profile?.description ?? "",
      interiorDescription: profile?.interior_description ?? "",
    });
    setAddress(profile?.address ?? "");
    setGeo(null);
    setPlace(null);
    setLocationEdited(false);
    setCategoryIds(profile?.categories?.map((c) => c.id) ?? []);
    setError(null);
  }, [open, profile, reset]);

  const addressNeedsGeo = locationEdited && (!place || !geo || !address.trim());

  const submit = handleSubmit(async (values) => {
    if (!onSave || !profile) return;
    if (addressNeedsGeo) return;

    const body: AdminSalonUpdateRequest = {};
    if (values.name !== (profile.name ?? "")) body.name = values.name;
    if (values.city !== (profile.city ?? "")) body.city = values.city;
    if (values.contactPhone && values.contactPhone !== (profile.contact_phone ?? ""))
      body.contact_phone = values.contactPhone;
    if (values.description && values.description !== (profile.description ?? ""))
      body.description = values.description;
    if (
      values.interiorDescription &&
      values.interiorDescription !== (profile.interior_description ?? "")
    )
      body.interior_description = values.interiorDescription;

    // Адрес + координаты только вместе (PATCH требует geolocation).
    if (locationEdited && place && address && geo) {
      body.city = values.city;
      body.address = address;
      body.geolocation = geo;
    }

    // Категории — если набор изменился.
    const currentCats = (profile.categories?.map((c) => c.id) ?? [])
      .slice()
      .sort();
    const nextCats = categoryIds.slice().sort();
    if (JSON.stringify(currentCats) !== JSON.stringify(nextCats))
      body.category_ids = categoryIds;

    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }

    setError(null);
    try {
      await onSave(body);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err : "Не удалось сохранить");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="max-w-[800px]">
        <ModalHeader title="Профиль салона" />
        <ModalDivider />

        {/* Основная информация */}
        <SectionCard title="Основная информация">
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-[1.3] text-ink-muted">Обложка</span>
            <ProfilePhoto id={profile?.cover_photo_id} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {editing ? (
              <>
                <Field
                  label="Название"
                  {...register("name")}
                  error={errors.name?.message}
                />
                <CityAutocompleteField
                  label="Город"
                  value={city}
                  onChange={(text) => {
                    setValue("city", text, { shouldValidate: true, shouldDirty: true });
                    setPlace(null);
                    setAddress("");
                    setGeo(null);
                    setLocationEdited(true);
                  }}
                  onSelect={(selected) => {
                    setValue("city", selected.name, { shouldValidate: true, shouldDirty: true });
                    setPlace(selected);
                    setAddress("");
                    setGeo(null);
                    setLocationEdited(true);
                  }}
                  error={errors.city?.message ?? (locationEdited && !place ? "Выберите город из списка подсказок" : undefined)}
                />
                <AddressAutocompleteField
                  key={place?.fias_id ?? "no-city"}
                  label="Адрес"
                  value={address}
                  place={place}
                  disabled={!place}
                  placeholder={place ? "Начните вводить адрес" : savedPlaces.isFetching ? "Определяем сохранённый город…" : "Выберите город из подсказок"}
                  onChange={(text) => {
                    setAddress(text);
                    setGeo(null);
                    setLocationEdited(true);
                  }}
                  onSelect={(s) => {
                    setAddress(s.address);
                    setGeo({ lat: s.lat, lon: s.lon });
                  }}
                  helperText={
                    !place && savedPlaces.isFetching
                      ? "Определяем сохранённый город…"
                      : !place && savedCityUnchanged
                      ? "Выберите сохранённый город из подсказок, чтобы уточнить адрес"
                      : place && addressNeedsGeo
                      ? "Выберите адрес из списка подсказок"
                      : undefined
                  }
                />
                <Field
                  label="Контактный телефон"
                  {...register("contactPhone")}
                  error={errors.contactPhone?.message}
                />
              </>
            ) : (
              <>
                <Field label="Название" value={profile?.name ?? ""} readOnly />
                <Field label="Город" value={profile?.city ?? ""} readOnly />
                <Field label="Адрес" value={profile?.address ?? ""} readOnly />
                <Field
                  label="Контактный телефон"
                  value={profile?.contact_phone ?? ""}
                  readOnly
                />
              </>
            )}
          </div>
        </SectionCard>

        {/* Категории */}
        <SectionCard title="Категории">
          {editing ? (
            <CategoryPicker
              selectedIds={categoryIds}
              onChange={setCategoryIds}
              providerId={profile?.salon_id ?? null}
              role="SALON"
              assignedCategories={profile?.categories ?? []}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {profile?.categories?.length ? (
                profile.categories.map((category) => (
                  <CategoryChip key={category.id}>{category.name}</CategoryChip>
                ))
              ) : (
                <span className="text-sm text-ink-muted">
                  Категории не указаны
                </span>
              )}
            </div>
          )}
        </SectionCard>

        {/* О салоне */}
        <SectionCard title="О салоне">
          {editing ? (
            <TextAreaField
              label="Описание"
              rows={2}
              {...register("description")}
              error={errors.description?.message}
            />
          ) : (
            <TextAreaField
              label="Описание"
              rows={2}
              readOnly
              value={profile?.description ?? ""}
            />
          )}
        </SectionCard>

        {/* Интерьер */}
        <SectionCard title="Интерьер">
          {editing ? (
            <TextAreaField
              label="Описание интерьера"
              rows={3}
              autoGrow
              {...register("interiorDescription")}
              error={errors.interiorDescription?.message}
            />
          ) : (
            <TextAreaField
              label="Описание интерьера"
              rows={3}
              autoGrow
              readOnly
              value={profile?.interior_description ?? ""}
            />
          )}
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-[1.3] text-ink-muted">
              Фотографии интерьера
            </span>
            <ProfilePhotoRow ids={profile?.interior_images ?? []} />
          </div>
        </SectionCard>

        <ErrorPopup error={error} onDismiss={() => setError(null)} />

        {/* Действия */}
        <ModalActions>
          {editing ? (
            <>
              <ModalButton variant="secondary" close>
                Отмена
              </ModalButton>
              <ModalButton
                variant="primary"
                onClick={submit}
                disabled={isSubmitting || addressNeedsGeo}
              >
                {isSubmitting ? "Сохранение…" : "Сохранить изменения"}
              </ModalButton>
            </>
          ) : (
            <ModalButton variant="secondary" close>
              Закрыть
            </ModalButton>
          )}
        </ModalActions>
      </ModalShell>
    </Dialog>
  );
}
