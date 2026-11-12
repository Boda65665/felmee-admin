import type { DocumentRequirements, RegistrationDocumentType } from "./api/business-registry";

export const DOCUMENT_TYPE_LABELS: Record<RegistrationDocumentType | "ADDITIONAL", string> = {
  PASSPORT_MAIN: "Паспорт — основной разворот",
  PASSPORT_REGISTRATION: "Паспорт — регистрация",
  IE_POWER_OF_ATTORNEY: "Доверенность от ИП",
  LLC_DIRECTOR_APPOINTMENT: "Приказ о назначении генерального директора",
  LLC_MACHINE_READABLE_POWER_OF_ATTORNEY: "Машиночитаемая доверенность",
  ADDITIONAL: "Дополнительный документ",
};

export type DocumentDraft = { fileId: number; filename: string };
export type DocumentDrafts = Partial<Record<RegistrationDocumentType, DocumentDraft>>;

/** Only missing required types go into PATCH partner; attached files are never reused. */
export function typeChangeFiles(requirements: DocumentRequirements, drafts: DocumentDrafts): Partial<Record<RegistrationDocumentType, number>> {
  const files: Partial<Record<RegistrationDocumentType, number>> = {};
  for (const item of requirements.required_documents.filter(item => item.needs_upload)) {
    const draft = drafts[item.document_type];
    if (!draft || !Number.isSafeInteger(draft.fileId) || draft.fileId <= 0) throw new Error(`Загрузите документ «${item.title}» перед сохранением.`);
    if (Object.values(files).includes(draft.fileId)) throw new Error("Для каждого типа нужен отдельный новый файл.");
    files[item.document_type] = draft.fileId;
  }
  return files;
}
