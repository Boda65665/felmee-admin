import { format } from 'date-fns';
import { z } from 'zod';

/** Паспорт обязателен для ИП и самозанятого; для ООО не требуется. */
export const businessPartnerSchema = z.object({
  full_name: z.string().trim().optional(),
  inn: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Проверьте e-mail").or(z.literal("")).optional(),
  activity_type: z.string().trim().optional(),
  business_type: z.enum(["SE", "IE", "LLC"]),
  comment: z.string().trim().optional(),
  identity: z.object({
    registration_address: z.string({ error: "Укажите адрес регистрации" }).trim().min(1, "Укажите адрес"),
    passport_series: z.string({ error: "Укажите серию паспорта" }).regex(/^\d{4}$/, "4 цифры"),
    passport_number: z.string({ error: "Укажите номер паспорта" }).regex(/^\d{6}$/, "6 цифр"),
    birth_date: z.string({ error: "Укажите дату рождения" }).date("Укажите дату"),
    passport_issue_date: z.string({ error: "Укажите дату выдачи" }).date("Укажите дату"),
    department_code: z.string({ error: "Укажите код подразделения" }).regex(/^\d{3}-\d{3}$/, "Формат 000-000"),
    birth_place: z.string({ error: "Укажите место рождения" }).trim().min(1, "Укажите место рождения"),
  }).refine((v) => v.birth_date <= format(new Date(), "yyyy-MM-dd"), {
    path: ["birth_date"], message: "Дата не может быть в будущем",
  }).refine((v) => v.passport_issue_date >= v.birth_date && v.passport_issue_date <= format(new Date(), "yyyy-MM-dd"), {
    path: ["passport_issue_date"], message: "Проверьте дату выдачи",
  }).optional(),
}).superRefine((values, context) => {
  if (values.business_type !== "LLC" && !values.identity) {
    context.addIssue({ code: "custom", path: ["identity"], message: "Заполните все паспортные данные перед сохранением." });
  }
});
export type BusinessPartnerForm = z.infer<typeof businessPartnerSchema>;
