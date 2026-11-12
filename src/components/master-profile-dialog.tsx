import { zodResolver } from "@hookform/resolvers/zod";
import { Home, Info, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import type {
  AdminMasterProfile,
  AdminMasterUpdateRequest,
} from "@/lib/api";
import { AvatarImage } from "./avatar";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { CityAutocompleteField } from "./city-autocomplete-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
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
  ProfilePhotoRow,
  SectionCard,
  TextAreaField,
} from "./profile-form";

/** Варианты места оказания услуг из API. */
type ServiceLocation = "IN_SALON" | "AT_MASTER_PLACE" | "CLIENT_PLACE";

const PLACE_OPTIONS: { value: ServiceLocation; label: string }[] = [
  { value: "IN_SALON", label: "В салоне" },
  { value: "AT_MASTER_PLACE", label: "У мастера" },
  { value: "CLIENT_PLACE", label: "У клиента" },
];

type MasterLocation =
  AdminMasterUpdateRequest["service_locations"] extends (infer T)[] | undefined
    ? T
    : never;

/** Схема редактируемых скалярных полей мастера (числа — строками, парсим при сабмите). */
const schema = z.object({
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().min(1, "Укажите фамилию").max(100),
  city: z.string().trim().min(1, "Укажите город").max(30),
  experienceYears: z.string().trim(),
  description: z.string().trim().max(1000),
  minBookingLeadTime: z.string().trim(),
  breakAfterService: z.string().trim(),
});
type FormValues = z.infer<typeof schema>;

/** Разобрать целое в диапазоне; вернёт null при пустом/невалидном. */
const parseInt0 = (value: string, min: number, max: number): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
};

/**
 * Модалка «Профиль мастера» (макет 4754-10935) — открывается кликом по имени
 * мастера в таблице. Просмотр данных из `GET /api/admin/masters/{id}` и, по
 * кнопке «Изменить», редактирование в той же модалке: основная информация, о
 * мастере, категории, место оказания услуг, настройки записи. Фото
 * через PATCH не меняются — остаются на просмотр. Дифф уходит через `onSave`.
 */
export function MasterProfileDialog({
  open,
  onOpenChange,
  profile,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Профиль мастера из `useProviderProfile`; пока грузится — undefined. */
  profile?: AdminMasterProfile;
  /** Сохранение диффа. Без него редактирование недоступно (нет кнопки). */
  onSave?: (body: AdminMasterUpdateRequest) => Promise<void>;
}) {
  // Правка доступна, когда передан `onSave` (страница мастеров/салонов). Без
  // него (напр. профиль со страницы «Записи») — только просмотр.
  const editing = Boolean(onSave);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Вне RHF: категории и места оказания услуг.
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [places, setPlaces] = useState<ServiceLocation[]>([]);
  const [inSalonName, setInSalonName] = useState("");
  const [inSalonAddress, setInSalonAddress] = useState("");
  const [atMasterAddress, setAtMasterAddress] = useState("");
  const [inSalonGeo, setInSalonGeo] = useState<MasterLocation["geolocation"]>(null);
  const [atMasterGeo, setAtMasterGeo] = useState<MasterLocation["geolocation"]>(null);
  const [clientRadius, setClientRadius] = useState<MasterLocation["radius_km"]>(null);

  const fillFromProfile = () => {
    reset({
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      city: profile?.city ?? "",
      experienceYears:
        profile?.experience_years != null
          ? String(profile.experience_years)
          : "",
      description: profile?.description ?? "",
      minBookingLeadTime:
        profile?.min_booking_lead_time_minutes != null
          ? String(profile.min_booking_lead_time_minutes)
          : "",
      breakAfterService:
        profile?.break_after_service_min != null
          ? String(profile.break_after_service_min)
          : "",
    });
    setCategoryIds(profile?.categories?.map((c) => c.id) ?? []);
    const locs = profile?.service_locations ?? [];
    setPlaces(locs.map((l) => l.service_location as ServiceLocation));
    const inSalon = locs.find((l) => l.service_location === "IN_SALON");
    const atMaster = locs.find((l) => l.service_location === "AT_MASTER_PLACE");
    setInSalonName(inSalon?.salon_name ?? "");
    setInSalonAddress(inSalon?.address ?? "");
    setAtMasterAddress(atMaster?.address ?? "");
    setInSalonGeo(inSalon?.geolocation ?? null);
    setAtMasterGeo(atMaster?.geolocation ?? null);
    setClientRadius(locs.find(l => l.service_location === "CLIENT_PLACE")?.radius_km ?? null);
  };

  // Перезаполнение при открытии/смене профиля.
  useEffect(() => {
    if (!open) return;
    fillFromProfile();
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile]);

  const togglePlace = (value: ServiceLocation) =>
    setPlaces((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );

  const has = (value: ServiceLocation) => places.includes(value);
  const radiusRequired = has("CLIENT_PLACE") && clientRadius == null;

  const submit = handleSubmit(async (values) => {
    if (!onSave || !profile) return;
    if (radiusRequired) {
      setError("Укажите максимальный радиус выезда к клиенту");
      return;
    }

    const body: AdminMasterUpdateRequest = {};
    if (values.firstName !== (profile.first_name ?? ""))
      body.first_name = values.firstName;
    if (values.lastName !== (profile.last_name ?? ""))
      body.last_name = values.lastName;
    if (values.city !== (profile.city ?? "")) body.city = values.city;
    if (values.description && values.description !== (profile.description ?? ""))
      body.description = values.description;

    // Числовые поля — валидируем диапазон, шлём только изменившиеся валидные.
    const exp = parseInt0(values.experienceYears, 0, 60);
    if (values.experienceYears.trim() !== "" && exp === null) {
      setError("Опыт работы — целое число от 0 до 60");
      return;
    }
    if (exp !== null && exp !== (profile.experience_years ?? null))
      body.experience_years = exp;

    const lead = parseInt0(values.minBookingLeadTime, 0, 360);
    if (values.minBookingLeadTime.trim() !== "" && lead === null) {
      setError("Мин. время до записи — целое число от 0 до 360 (мин)");
      return;
    }
    if (lead !== null && lead !== (profile.min_booking_lead_time_minutes ?? null))
      body.min_booking_lead_time_minutes = lead;

    const brk = parseInt0(values.breakAfterService, 0, 300);
    if (values.breakAfterService.trim() !== "" && brk === null) {
      setError("Перерыв после услуги — целое число от 0 до 300 (мин)");
      return;
    }
    if (brk !== null && brk !== (profile.break_after_service_min ?? null))
      body.break_after_service_min = brk;

    // Категории — если набор изменился.
    const currentCats = (profile.categories?.map((c) => c.id) ?? [])
      .slice()
      .sort();
    const nextCats = categoryIds.slice().sort();
    if (JSON.stringify(currentCats) !== JSON.stringify(nextCats))
      body.category_ids = categoryIds;

    // Addresses and coordinates travel together; CLIENT_PLACE has no fixed address.
    const origLocs = profile.service_locations ?? [];
    const nextLocs: MasterLocation[] = places.map((p) => {
      const loc: MasterLocation = { service_location: p };
      if (p === "IN_SALON") {
        loc.salon_name = inSalonName.trim();
        loc.address = inSalonAddress.trim();
        loc.geolocation = inSalonGeo;
      } else if (p === "AT_MASTER_PLACE") {
        loc.address = atMasterAddress.trim();
        loc.geolocation = atMasterGeo;
      } else if (clientRadius != null) {
        loc.radius_km = clientRadius;
      }
      return loc;
    });

    const normLoc = (l: {
      service_location?: string;
      salon_name?: string | null;
      address?: string | null;
      radius_km?: number | null;
      geolocation?: MasterLocation["geolocation"];
    }) =>
      JSON.stringify({
        s: l.service_location,
        n: l.service_location === "IN_SALON" ? l.salon_name ?? null : null,
        a: l.service_location !== "CLIENT_PLACE" ? l.address ?? null : null,
        g: l.service_location !== "CLIENT_PLACE" && l.geolocation ? { lat: l.geolocation.lat, lon: l.geolocation.lon } : null,
        r: l.service_location === "CLIENT_PLACE" ? l.radius_km ?? null : null,
      });
    const currentLocsNorm = origLocs.map(normLoc).sort().join("|");
    const nextLocsNorm = nextLocs.map(normLoc).sort().join("|");

    if (currentLocsNorm !== nextLocsNorm) {
      // Валидируем обязательные поля только при изменении — чтобы правка
      // прочих полей не блокировалась неполнотой уже существующих мест.
      if (nextLocs.length === 0) {
        setError("Укажите хотя бы одно место оказания услуг");
        return;
      }
      for (const loc of nextLocs) {
        const label = PLACE_OPTIONS.find(
          (o) => o.value === loc.service_location,
        )?.label;
        if (loc.service_location !== "CLIENT_PLACE" && !loc.address) {
          setError(`Укажите адрес для места «${label}»`);
          return;
        }
        if (loc.service_location === "IN_SALON" && !loc.salon_name) {
          setError("Укажите название салона для места «В салоне»");
          return;
        }
        if (loc.service_location !== "CLIENT_PLACE" && !loc.geolocation) {
          setError(`Выберите адрес из подсказок для места «${label}»`);
          return;
        }
      }
      body.service_locations = nextLocs;
    }

    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }

    setError(null);
    try {
      await onSave(body);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  });

  // Для режима просмотра — исходные данные профиля.
  const viewLocations = profile?.service_locations ?? [];
  const viewHas = (value: ServiceLocation) =>
    viewLocations.some((l) => l.service_location === value);
  const viewAtMaster = viewLocations.find(
    (l) => l.service_location === "AT_MASTER_PLACE",
  );
  const viewInSalon = viewLocations.find(
    (l) => l.service_location === "IN_SALON",
  );
  const addressNeedsGeo =
    (has("AT_MASTER_PLACE") && !atMasterGeo && atMasterAddress.trim() !== (viewAtMaster?.address ?? "").trim()) ||
    (has("IN_SALON") && !inSalonGeo && inSalonAddress.trim() !== (viewInSalon?.address ?? "").trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="max-w-[800px]">
        <ModalHeader title="Профиль мастера" />
        <ModalDivider />

        {/* Основная информация */}
        <SectionCard title="Основная информация">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
            <AvatarImage
              id={profile?.avatar}
              name={
                profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
                  : ""
              }
              className="size-[68px] rounded-xl text-xl"
            />
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              {editing ? (
                <>
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
                    value={watch("city") ?? ""}
                    onChange={(text) => setValue("city", text, { shouldValidate: true, shouldDirty: true })}
                    error={errors.city?.message}
                  />
                  <Field
                    label="Опыт работы, лет"
                    inputMode="numeric"
                    {...register("experienceYears")}
                  />
                </>
              ) : (
                <>
                  <Field label="Имя" value={profile?.first_name ?? ""} readOnly />
                  <Field
                    label="Фамилия"
                    value={profile?.last_name ?? ""}
                    readOnly
                  />
                  <Field label="Город" value={profile?.city ?? ""} readOnly />
                  <Field
                    label="Опыт работы"
                    value={
                      profile?.experience_years != null
                        ? String(profile.experience_years)
                        : ""
                    }
                    readOnly
                  />
                </>
              )}
            </div>
          </div>
        </SectionCard>

        {/* О мастере */}
        <SectionCard title="О мастере">
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
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-[1.3] text-ink-muted">
              Примеры работ
            </span>
            <ProfilePhotoRow ids={profile?.example_work_images ?? []} />
          </div>
        </SectionCard>

        {/* Категории */}
        <SectionCard title="Категории">
          {editing ? (
            <CategoryPicker
              selectedIds={categoryIds}
              onChange={setCategoryIds}
              providerId={profile?.user_id ?? null}
              role="MASTER"
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

        {/* Место оказания услуг */}
        <SectionCard title="Место оказания услуг">
          <div className="flex flex-col gap-4">
            <span className="text-sm leading-[1.3] text-ink-muted">
              Варианты места оказания услуг
            </span>
            <div className="flex flex-wrap gap-6">
              {PLACE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cnLabel(editing)}
                >
                  <Checkbox
                    checked={editing ? has(option.value) : viewHas(option.value)}
                    disabled={!editing}
                    onCheckedChange={() => editing && togglePlace(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {(editing ? has("AT_MASTER_PLACE") : viewHas("AT_MASTER_PLACE")) && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-grey-3 bg-white p-4">
              <span className="flex items-center gap-1.5 text-sm leading-[1.3] text-ink-muted">
                <User className="size-4 shrink-0" />У мастера — адрес для выезда
                клиента на дом к мастеру
              </span>
              {editing ? (
                <AddressAutocompleteField
                  label="Адрес (у мастера)"
                  value={atMasterAddress}
                  onChange={(text) => { setAtMasterAddress(text); setAtMasterGeo(null); }}
                  onSelect={(suggestion) => { setAtMasterAddress(suggestion.address); setAtMasterGeo({ lat: suggestion.lat, lon: suggestion.lon }); }}
                  error={!atMasterGeo && atMasterAddress.trim() !== (viewAtMaster?.address ?? "").trim() ? "Выберите адрес из списка подсказок" : undefined}
                />
              ) : (
                <Field
                  label="Адрес (у мастера)"
                  value={viewAtMaster?.address ?? ""}
                  readOnly
                />
              )}
            </div>
          )}

          {(editing ? has("IN_SALON") : viewHas("IN_SALON")) && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-grey-3 bg-white p-4">
              <span className="flex items-center gap-1.5 text-sm leading-[1.3] text-ink-muted">
                <Home className="size-4 shrink-0" />В салоне — салон, где принимает
                мастер
              </span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {editing ? (
                  <>
                    <Field
                      label="Название салона"
                      value={inSalonName}
                      onChange={(e) => setInSalonName(e.target.value)}
                    />
                    <AddressAutocompleteField
                      label="Адрес салона"
                      value={inSalonAddress}
                      onChange={(text) => { setInSalonAddress(text); setInSalonGeo(null); }}
                      onSelect={(suggestion) => { setInSalonAddress(suggestion.address); setInSalonGeo({ lat: suggestion.lat, lon: suggestion.lon }); }}
                      error={!inSalonGeo && inSalonAddress.trim() !== (viewInSalon?.address ?? "").trim() ? "Выберите адрес из списка подсказок" : undefined}
                    />
                  </>
                ) : (
                  <>
                    <Field
                      label="Название салона"
                      value={viewInSalon?.salon_name ?? ""}
                      readOnly
                    />
                    <Field
                      label="Адрес салона"
                      value={viewInSalon?.address ?? ""}
                      readOnly
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {(editing ? has("CLIENT_PLACE") : viewHas("CLIENT_PLACE")) && (
            <div className="flex flex-col gap-3 rounded-xl border border-grey-3 bg-white p-4">
              {editing ? (
                <div className="flex flex-col gap-1.5">
                  <span id="client-radius-label" className="text-sm leading-[1.3] text-ink-muted">Максимальный радиус выезда</span>
                  <Select value={clientRadius == null ? "" : String(clientRadius)} onValueChange={(value) => setClientRadius(Number(value) as 1 | 5 | 10 | 20)}>
                    <SelectTrigger aria-labelledby="client-radius-label" aria-required="true" aria-invalid={radiusRequired}><SelectValue placeholder="Выберите радиус" /></SelectTrigger>
                    <SelectContent>
                      {[1, 5, 10, 20].map(radius => <SelectItem key={radius} value={String(radius)}>{radius} км</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {radiusRequired && <span className="text-xs text-danger">Укажите максимальный радиус выезда</span>}
                </div>
              ) : (
                <Field label="Максимальный радиус выезда" value={viewLocations.find(l => l.service_location === "CLIENT_PLACE")?.radius_km != null ? `${viewLocations.find(l => l.service_location === "CLIENT_PLACE")?.radius_km} км` : "Не задан"} readOnly />
              )}
            <p className="flex items-center gap-1.5 text-sm leading-[1.4] text-ink-muted">
              <Info className="size-4 shrink-0" />У клиента — адрес указывает
              клиент при оформлении записи, отдельное поле не требуется
            </p>
            </div>
          )}
        </SectionCard>

        {/* Настройки записи */}
        <SectionCard title="Настройки записи">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {editing ? (
              <>
                <Field
                  label="Мин. время до записи, мин"
                  inputMode="numeric"
                  {...register("minBookingLeadTime")}
                />
                <Field
                  label="Перерыв после услуги, мин"
                  inputMode="numeric"
                  {...register("breakAfterService")}
                />
              </>
            ) : (
              <>
                <Field
                  label="Минимальное время до записи"
                  value={
                    profile?.min_booking_lead_time_minutes != null
                      ? String(profile.min_booking_lead_time_minutes)
                      : ""
                  }
                  readOnly
                />
                <Field
                  label="Перерыв после услуги"
                  value={
                    profile?.break_after_service_min != null
                      ? String(profile.break_after_service_min)
                      : ""
                  }
                  readOnly
                />
              </>
            )}
          </div>
        </SectionCard>

        {error && <p className="text-sm leading-[1.3] text-danger">{error}</p>}

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
                disabled={isSubmitting || addressNeedsGeo || radiusRequired}
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

/** Класс подписи-чекбокса: курсор-указатель только в режиме правки. */
function cnLabel(editing: boolean): string {
  return `flex items-center gap-2.5 text-base text-ink${
    editing ? " cursor-pointer" : ""
  }`;
}
