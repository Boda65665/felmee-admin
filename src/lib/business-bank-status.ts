import type { BusinessApplicationCard } from "@/lib/api/business-registry";

export const BUSINESS_BANK_META: Record<BusinessApplicationCard["bank_status"], { label: string; className: string }> = {
  NOT_SENT: { label: "Не отправлено", className: "text-brand" },
  UNDER_REVIEW: { label: "На проверке банком", className: "text-status-blue" },
  VERIFIED: { label: "Проверен банком", className: "text-success" },
  NOT_VERIFIED: { label: "Не подтверждены банком", className: "text-warning" },
  TECHNICAL_ERROR: { label: "Ошибка проверки банком", className: "text-danger" },
};
