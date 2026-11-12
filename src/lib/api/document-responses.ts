import { z } from "zod";
import { ApiError } from "./client";

const documentType = z.enum(["PASSPORT_MAIN", "PASSPORT_REGISTRATION", "IE_POWER_OF_ATTORNEY", "LLC_DIRECTOR_APPOINTMENT", "LLC_MACHINE_READABLE_POWER_OF_ATTORNEY"]);
const requirementsSchema = z.object({
  business_type: z.enum(["SE", "IE", "LLC"]),
  identity_required: z.boolean(),
  required_documents: z.array(z.object({ document_type: documentType, title: z.string(), needs_upload: z.boolean() })),
});
const historySchema = z.object({
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive(),
  items: z.array(z.object({
    file_id: z.number().int().positive(), document_type: documentType, revision: z.number().int().positive(),
    filename: z.string(), content_type: z.string().nullable(), size_bytes: z.number().nullable(),
    status: z.enum(["PENDING", "APPROVED", "REUPLOAD_REQUIRED"]), is_current: z.boolean(),
    comment: z.string().nullable(), reviewed_at: z.string().nullable(), reviewed_by: z.number().nullable(),
  })),
});

/** The running server serializes new Java records in camelCase; OpenAPI uses snake_case. */
function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), normalizeKeys(item)]));
  return value;
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(normalizeKeys(value));
  if (!result.success) throw new ApiError("invalid_response", `Сервер вернул некорректные данные: ${label}. Попробуйте обновить карточку.`, 200);
  return result.data;
}

export const parseDocumentRequirements = (value: unknown) => parseResponse(requirementsSchema, value, "требования к документам");
export const parseDocumentHistory = (value: unknown) => parseResponse(historySchema, value, "история версий документа");
