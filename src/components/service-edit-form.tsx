import { useEffect, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Plus, Trash2, X } from "lucide-react";
import { z } from "zod";

import { AddressAutocompleteField } from "@/components/address-autocomplete-field";
import { IconButton } from "@/components/icon-button";
import { ModalActions, ModalButton } from "@/components/modal-shell";
import { ServicePhoto } from "@/components/service-details";
import { useToast } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateService, type AdminService, type AdminServicePatch, type ServiceCategory } from "@/lib/api/services";
import { useAdvantageSuggestions } from "@/lib/api/suggestions";
import { useErrorPopupStore } from "@/lib/error-popup-store";
import { locationNames, serviceCategoryLabel } from "@/lib/service-display";

const inputClass = "min-h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 py-2 text-base text-ink outline-none transition-colors focus:border-brand aria-invalid:border-danger";
const textareaClass = `${inputClass} field-sizing-content resize-none`;
const selectTriggerClass = "min-w-0 aria-invalid:border-danger disabled:opacity-60 [&>span:first-child]:truncate";
const integer = (min: number, max: number) => z.string().trim()
  .regex(/^\d+$/, "Введите целое число")
  .transform(Number)
  .pipe(z.int().min(min, `Минимум ${min}`).max(max, `Максимум ${max}`));
const text = (max: number) => z.string().trim().min(1, "Заполните поле").max(max, `Не более ${max} символов`);
const coordinate = (max: number) => z.string().trim().regex(/^-?\d+(?:[.,]\d+)?$/, "Введите координату")
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().min(-max).max(max));
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Укажите время");
const basePrice = integer(1, 100000);
const maxAdvantages = 5;
const maxSeoQueries = 10;
const maxSeoLength = 70;
const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const lines = (maxItems: number, maxLength: number) => z.string()
  .transform(splitLines)
  .pipe(z.array(text(maxLength)).max(maxItems, `Не более ${maxItems} строк`))
  .refine((items) => new Set(items).size === items.length, "Уберите повторяющиеся строки");

const patchSchema = z.object({
  name: text(120),
  description: text(4000),
  price: basePrice,
  duration: integer(1, 1440),
  category_id: integer(1, Number.MAX_SAFE_INTEGER),
  is_fix_price: z.boolean(),
  discount_percent: z.union([z.literal("").transform(() => null), integer(0, 100)]),
  price_intervals: z.array(z.object({ start_time: time, end_time: time, price: basePrice })).refine((intervals) => {
    const ordered = [...intervals].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return ordered.every((interval, index) => interval.start_time < interval.end_time &&
      (index === 0 || ordered[index - 1].end_time <= interval.start_time));
  }, "Проверьте время. Интервалы должны идти вперёд и не пересекаться."),
  advantages: lines(maxAdvantages, 50),
  seo_queries: lines(maxSeoQueries, maxSeoLength),
  place: z.object({
    address: text(1000),
    lat: coordinate(90),
    lon: coordinate(180),
  }),
  service_locations: z.array(z.object({
    service_location: z.enum(["IN_SALON", "AT_MASTER_PLACE", "CLIENT_PLACE"]),
    salon_name: z.string().trim(),
    address: text(1000),
    lat: coordinate(90),
    lon: coordinate(180),
    radius_km: z.string(),
  }).superRefine((location, context) => {
    if (location.service_location === "IN_SALON" && (!location.salon_name || location.salon_name.length > 255)) {
      context.addIssue({ code: "custom", path: ["salon_name"], message: "Укажите название салона, до 255 символов" });
    }
    if (location.service_location === "CLIENT_PLACE" && !["1", "5", "10", "20"].includes(location.radius_km)) {
      context.addIssue({ code: "custom", path: ["radius_km"], message: "Выберите радиус выезда" });
    }
  }).transform(({ lat, lon, radius_km, salon_name, ...location }) => ({
    ...location,
    geolocation: { lat, lon },
    ...(location.service_location === "IN_SALON" ? { salon_name } : {}),
    ...(location.service_location === "CLIENT_PLACE" ? { radius_km: Number(radius_km) as 1 | 5 | 10 | 20 } : {}),
  }))).min(1, "Добавьте хотя бы одно место оказания").max(3)
    .refine((locations) => new Set(locations.map(({ service_location }) => service_location)).size === locations.length,
      "Для каждого типа можно указать одно место"),
}).partial();

type FormValues = Required<z.input<typeof patchSchema>>;
const fieldValue = (value: string | number | null | undefined) => value == null ? "" : String(value);

function toFormValues(service: AdminService): FormValues {
  return {
    name: fieldValue(service.name),
    description: fieldValue(service.description),
    price: fieldValue(service.price),
    duration: fieldValue(service.duration),
    category_id: fieldValue(service.category_id),
    discount_percent: fieldValue(service.discount_percent),
    is_fix_price: service.is_fix_price !== false,
    price_intervals: (service.price_intervals ?? []).map(({ start_time, end_time, price }) => ({
      start_time: start_time.slice(0, 5),
      end_time: end_time.slice(0, 5),
      price: fieldValue(price),
    })),
    advantages: (service.advantages ?? []).join("\n"),
    seo_queries: (service.seo_queries ?? []).join("\n"),
    place: {
      address: fieldValue(service.address),
      lat: fieldValue(service.geo?.lat),
      lon: fieldValue(service.geo?.lon),
    },
    service_locations: (service.service_locations ?? []).map((location) => ({
      service_location: location.service_location,
      salon_name: fieldValue(location.salon_name),
      address: fieldValue(location.address),
      lat: fieldValue(location.geo?.lat),
      lon: fieldValue(location.geo?.lon),
      radius_km: fieldValue(location.radius_km),
    })),
  };
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

const addClass = "flex min-h-10 w-fit items-center gap-2 rounded-lg border border-grey-4 px-3 text-sm hover:bg-grey-5 disabled:opacity-50";

export function ServiceEditForm({
  service,
  categories,
  onSaved,
}: {
  service: AdminService;
  categories: ServiceCategory[];
  onSaved: () => void;
}) {
  const form = useForm<FormValues>({ defaultValues: toFormValues(service) });
  const { control, register, formState: { isDirty, isSubmitting, dirtyFields, errors } } = form;
  const advantageLines = useWatch({ control, name: "advantages" }).split("\n");
  const [activeLine, setActiveLine] = useState(0);
  const [advantagesFocused, setAdvantagesFocused] = useState(false);
  const advantageDraft = advantageLines[activeLine]?.trim() ?? "";
  const otherAdvantages = splitLines(advantageLines.filter((_, index) => index !== activeLine).join("\n"));
  const [advantageQuery, setAdvantageQuery] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setAdvantageQuery(advantageDraft), 250);
    return () => window.clearTimeout(timeout);
  }, [advantageDraft]);
  const canSuggest = advantagesFocused && !isSubmitting && otherAdvantages.length < maxAdvantages && advantageQuery === advantageDraft;
  const suggestions = useAdvantageSuggestions(advantageQuery, canSuggest);
  const suggestedAdvantages = canSuggest
    ? (suggestions.data ?? []).filter((item) => item !== advantageDraft && !otherAdvantages.includes(item))
    : [];
  const seoQueries = splitLines(useWatch({ control, name: "seo_queries" }));
  const [seoDraft, setSeoDraft] = useState("");
  const seoValue = seoDraft.trim();
  const canAddSeo = seoValue !== "" && seoQueries.length < maxSeoQueries && !seoQueries.includes(seoValue);
  const isFixed = useWatch({ control, name: "is_fix_price" });
  const intervals = useFieldArray({ control, name: "price_intervals" });
  const locations = useFieldArray({ control, name: "service_locations" });
  const locationValues = useWatch({ control, name: "service_locations" });
  const placeAddress = useWatch({ control, name: "place.address" });
  const hasIntervals = intervals.fields.length > 0;
  const leaveFixedPrice = service.is_fix_price !== false && !isFixed && (service.price_intervals?.length ?? 0) > 0;

  const update = useUpdateService();
  const toast = useToast();
  const reportError = useErrorPopupStore((store) => store.show);
  const leafCategories = categories.filter(({ id, parent_id }) =>
    parent_id != null && !categories.some((candidate) => candidate.parent_id === id),
  );

  function updateSeo(next: string[]) {
    form.setValue("seo_queries", next.join("\n"), { shouldDirty: true });
    form.clearErrors("seo_queries");
  }

  function addSeo() {
    if (!canAddSeo) return;
    updateSeo([...seoQueries, seoValue]);
    setSeoDraft("");
  }

  function trackAdvantageLine(textarea: HTMLTextAreaElement) {
    setAdvantagesFocused(true);
    setActiveLine(textarea.value.slice(0, textarea.selectionStart).split("\n").length - 1);
  }

  function pickAdvantage(value: string) {
    const next = [...advantageLines];
    next[activeLine] = value;
    form.setValue("advantages", next.join("\n"), { shouldDirty: true });
    form.clearErrors("advantages");
    setAdvantagesFocused(false);
  }

  const submit = form.handleSubmit(async (values) => {
    const changed = Object.fromEntries(Object.keys(dirtyFields).map((key) => [key, values[key as keyof FormValues]]));
    if (!values.is_fix_price) delete changed.price_intervals;
    if (values.service_locations.length) delete changed.place;
    const result = patchSchema.safeParse(changed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") as FieldPath<FormValues>;
        form.setError(path, { message: issue.message });
      }
      form.setError("root", { message: "Проверьте значения в отмеченных полях." });
      return;
    }

    const { place, ...fields } = result.data;
    const body: AdminServicePatch = fields;
    if (place) {
      body.address = place.address;
      body.geolocation = { lat: place.lat, lon: place.lon };
    }
    if (!Object.keys(body).length) {
      form.setError("root", { message: "Нет изменений для сохранения." });
      return;
    }
    try {
      const response = await update.mutateAsync({ id: service.id, body });
      toast.success(response.changed ? "Изменения сохранены" : "Услуга не изменилась");
      onSaved();
    } catch (error) {
      reportError(error, "Не удалось сохранить услугу");
    }
  });

  return (
    <form noValidate onSubmit={(event) => {
      form.clearErrors();
      void submit(event);
    }} className="flex flex-col gap-5">
      <fieldset disabled={isSubmitting} className="flex min-w-0 flex-col gap-4">
        <Field label="Название" error={errors.name?.message}>
          <input className={inputClass} aria-invalid={!!errors.name} maxLength={120} {...register("name")} />
        </Field>
        <Field label="Категория" error={errors.category_id?.message}>
          <Controller control={control} name="category_id" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting || !leafCategories.length}>
              <SelectTrigger ref={field.ref} onBlur={field.onBlur} aria-label="Категория"
                aria-invalid={!!errors.category_id} className={selectTriggerClass}>
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                {service.category_id != null && !leafCategories.some(({ id }) => id === service.category_id) && (
                  <SelectItem value={String(service.category_id)}>{service.category_name || `Категория #${service.category_id}`}</SelectItem>
                )}
                {leafCategories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>{serviceCategoryLabel(category, categories)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />
        </Field>
        <Field label="Описание" error={errors.description?.message}>
          <textarea className={`${textareaClass} min-h-28`} rows={4} maxLength={4000}
            aria-invalid={!!errors.description} {...register("description")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Цена, ₽" error={errors.price?.message}>
            <input className={inputClass} inputMode="numeric" aria-invalid={!!errors.price} {...register("price")} />
          </Field>
          <Field label="Время, мин." error={errors.duration?.message}>
            <input className={inputClass} inputMode="numeric" aria-invalid={!!errors.duration} {...register("duration")} />
          </Field>
          <Field label="Скидка, %" error={errors.discount_percent?.message}>
            <input className={inputClass} inputMode="numeric" aria-invalid={!!errors.discount_percent}
              placeholder="Без скидки" {...register("discount_percent")} />
          </Field>
        </div>
        <label className="flex w-fit items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand" {...register("is_fix_price")} />
          Фиксированная цена
        </label>
        {leaveFixedPrice && <p className="text-sm text-warning">При переходе на цену «от» интервалы будут удалены.</p>}
        {isFixed && (
          <div className="flex flex-col gap-2">
            {hasIntervals && <p className="text-sm font-medium">Цена по времени</p>}
            {intervals.fields.map((interval, index) => (
              <div key={interval.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Field label="Начало" error={errors.price_intervals?.[index]?.start_time?.message}>
                  <input className={inputClass} type="time" {...register(`price_intervals.${index}.start_time`)} />
                </Field>
                <Field label="Окончание" error={errors.price_intervals?.[index]?.end_time?.message}>
                  <input className={inputClass} type="time" {...register(`price_intervals.${index}.end_time`)} />
                </Field>
                <Field label="Цена, ₽" error={errors.price_intervals?.[index]?.price?.message}>
                  <input className={inputClass} inputMode="numeric" {...register(`price_intervals.${index}.price`)} />
                </Field>
                <IconButton icon={Trash2} label={`Удалить интервал ${index + 1}`} onClick={() => intervals.remove(index)} />
              </div>
            ))}
            {errors.price_intervals?.message && <p className="text-sm text-danger">{errors.price_intervals.message}</p>}
            <button type="button" className={addClass} onClick={() => intervals.append({ start_time: "", end_time: "", price: "" })}>
              <Plus className="size-4" /> Добавить цену по времени
            </button>
          </div>
        )}
        <div onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setAdvantagesFocused(false);
        }}>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="font-medium">Преимущества <span className="font-normal text-ink-muted">(макс. {maxAdvantages} пунктов)</span></span>
            <textarea className={textareaClass + " min-h-40"} rows={5} placeholder="По одному преимуществу на строку"
              aria-invalid={!!errors.advantages} {...register("advantages")}
              onFocus={(event) => trackAdvantageLine(event.currentTarget)}
              onSelect={(event) => trackAdvantageLine(event.currentTarget)} />
          </label>
          {errors.advantages?.message && <p className="mt-1 text-xs text-danger">{errors.advantages.message}</p>}
          {suggestedAdvantages.length > 0 && (
            <div role="group" aria-label="Подсказки преимуществ" className="mt-2 flex flex-wrap gap-2">
              {suggestedAdvantages.map((item) => (
                <button key={item} type="button" onClick={() => pickAdvantage(item)}
                  className="rounded-full bg-grey-5 px-3 py-2 text-left text-sm text-ink hover:bg-brand/10 hover:text-brand">
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        <section aria-label="Поисковые запросы" className="flex flex-col gap-3 rounded-2xl border border-grey-4 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Поисковые запросы</h3>
            <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs text-ink">Необязательное поле</span>
          </div>
          <p className="text-sm text-ink">
            Добавьте слова и фразы, по которым клиенты смогут найти вашу услугу в поиске.
            Укажите название услуги, её популярные варианты и профессиональные формулировки.
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-grey-3 p-2 focus-within:border-brand">
            <input type="text" aria-label="Новый поисковый запрос" aria-invalid={!!errors.seo_queries}
              className="h-10 min-w-32 flex-1 px-2 text-sm outline-none placeholder:text-ink-muted"
              placeholder="Пример: ламинирование бровей" value={seoDraft} maxLength={maxSeoLength}
              disabled={seoQueries.length >= maxSeoQueries}
              onChange={(event) => setSeoDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                addSeo();
              }} />
            <button type="button" disabled={!canAddSeo} onClick={addSeo}
              className="min-h-10 rounded-full bg-black px-4 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              Добавить
            </button>
          </div>
          {seoQueries.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {seoQueries.map((query, index) => (
                <li key={index} className="flex min-w-0 max-w-full items-center gap-1 rounded-full bg-grey-5 pl-3 pr-1 text-sm">
                  <span className="min-w-0 break-words">{query}</span>
                  <button type="button" aria-label={"Удалить запрос «" + query + "»"}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-danger"
                    onClick={() => updateSeo(seoQueries.filter((_, itemIndex) => itemIndex !== index))}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p aria-live="polite" className="text-sm text-ink-muted">{seoQueries.length} из {maxSeoQueries} запросов</p>
          {errors.seo_queries?.message && <p className="text-xs text-danger">{errors.seo_queries.message}</p>}
        </section>
        <section aria-label="Фотографии услуги" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Фотографии</h3>
          {service.images?.length ? (
            <ul className="flex flex-wrap gap-2">
              {service.images.map((id, index) => (
                <li key={id + ":" + index}><ServicePhoto id={id} /></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Фотографии не добавлены</p>
          )}
        </section>
        {service.provider_type === "MASTER" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Места оказания услуги</p>
            {locations.fields.map((location, index) => {
              const selectedType = locationValues[index]?.service_location;
              const error = errors.service_locations?.[index];
              return (
                <div key={location.id} className="grid grid-cols-2 gap-3 rounded-xl border border-grey-4 p-3">
                  <div className="col-span-2 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label="Тип места" error={error?.service_location?.message}>
                        <Controller control={control} name={`service_locations.${index}.service_location`} render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                            <SelectTrigger ref={field.ref} onBlur={field.onBlur} aria-label="Тип места"
                              aria-invalid={!!error?.service_location} className={selectTriggerClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(locationNames).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )} />
                      </Field>
                    </div>
                    <IconButton icon={Trash2} label={`Удалить место ${index + 1}`} disabled={locations.fields.length === 1}
                      onClick={() => locations.remove(index)} />
                  </div>
                  {selectedType === "IN_SALON" && (
                    <div className="col-span-2">
                      <Field label="Название салона" error={error?.salon_name?.message}>
                        <input className={inputClass} maxLength={255} {...register(`service_locations.${index}.salon_name`)} />
                      </Field>
                    </div>
                  )}
                  <div className="col-span-2">
                    <AddressAutocompleteField label="Адрес" value={locationValues[index]?.address ?? ""} disabled={isSubmitting}
                      error={error?.address?.message}
                      onChange={(value) => {
                        form.setValue(`service_locations.${index}.address`, value, { shouldDirty: true });
                        form.setValue(`service_locations.${index}.lat`, "", { shouldDirty: true });
                        form.setValue(`service_locations.${index}.lon`, "", { shouldDirty: true });
                      }}
                      onSelect={({ address, lat, lon }) => {
                        form.setValue(`service_locations.${index}.address`, address, { shouldDirty: true });
                        form.setValue(`service_locations.${index}.lat`, String(lat), { shouldDirty: true });
                        form.setValue(`service_locations.${index}.lon`, String(lon), { shouldDirty: true });
                      }} />
                  </div>
                  <Field label="Широта" error={error?.lat?.message}>
                    <input className={inputClass} inputMode="decimal" {...register(`service_locations.${index}.lat`)} />
                  </Field>
                  <Field label="Долгота" error={error?.lon?.message}>
                    <input className={inputClass} inputMode="decimal" {...register(`service_locations.${index}.lon`)} />
                  </Field>
                  {selectedType === "CLIENT_PLACE" && (
                    <Field label="Радиус, км" error={error?.radius_km?.message}>
                      <Controller control={control} name={`service_locations.${index}.radius_km`} render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                          <SelectTrigger ref={field.ref} onBlur={field.onBlur} aria-label="Радиус, км"
                            aria-invalid={!!error?.radius_km} className={selectTriggerClass}>
                            <SelectValue placeholder="Выберите радиус" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 5, 10, 20].map((radius) => <SelectItem key={radius} value={String(radius)}>{radius}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </Field>
                  )}
                </div>
              );
            })}
            {errors.service_locations?.message && <p className="text-sm text-danger">{errors.service_locations.message}</p>}
            <button type="button" className={addClass} disabled={locations.fields.length >= 3} onClick={() => {
              const types = Object.keys(locationNames) as (keyof typeof locationNames)[];
              const type = types.find((value) => !locationValues.some((location) => location.service_location === value));
              if (type) locations.append({ service_location: type, address: "", lat: "", lon: "", radius_km: "", salon_name: "" });
            }}>
              <Plus className="size-4" /> Добавить место
            </button>
            {service.address && !locations.fields.length && (
              <>
                <AddressAutocompleteField label="Адрес услуги" value={placeAddress} disabled={isSubmitting}
                  error={errors.place?.address?.message}
                  onChange={(value) => {
                    form.setValue("place.address", value, { shouldDirty: true });
                    form.setValue("place.lat", "", { shouldDirty: true });
                    form.setValue("place.lon", "", { shouldDirty: true });
                  }}
                  onSelect={({ address, lat, lon }) => {
                    form.setValue("place.address", address, { shouldDirty: true });
                    form.setValue("place.lat", String(lat), { shouldDirty: true });
                    form.setValue("place.lon", String(lon), { shouldDirty: true });
                  }} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Широта" error={errors.place?.lat?.message}>
                    <input className={inputClass} inputMode="decimal" {...register("place.lat")} />
                  </Field>
                  <Field label="Долгота" error={errors.place?.lon?.message}>
                    <input className={inputClass} inputMode="decimal" {...register("place.lon")} />
                  </Field>
                </div>
              </>
            )}
          </div>
        )}
      </fieldset>
      {errors.root?.message && <p role="alert" className="text-sm text-danger">{errors.root.message}</p>}
      <ModalActions>
        <ModalButton close disabled={isSubmitting}>Отмена</ModalButton>
        <button type="submit" disabled={!isDirty || isSubmitting}
          className="min-h-12 flex-1 rounded-full bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50">
          {isSubmitting ? "Сохранение…" : "Сохранить"}
        </button>
      </ModalActions>
    </form>
  );
}
