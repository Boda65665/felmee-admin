import type { BusinessApplicationCard } from "@/lib/api/business-registry";

export type BalanceTransferStatus = NonNullable<BusinessApplicationCard["balance_transfer_status"]>;

export const BALANCE_TRANSFER_META: Record<BalanceTransferStatus, { label: string; description: string; className: string }> = {
  PENDING: { label: "Ожидание нового получателя", description: "Остаток пока относится к прежнему получателю. Перенос начнётся после подготовки и проверки нового получателя.", className: "text-status-blue" },
  READY: { label: "Перенос подготовлен", description: "Остаток подготовлен к переводу новому получателю.", className: "text-status-blue" },
  TRANSFERRING: { label: "Отправка перевода", description: "Банк получает запрос на перевод остатка. Дождитесь подтверждения.", className: "text-status-blue" },
  PROCESSING: { label: "Банк обрабатывает перевод", description: "Ожидаем подтверждения банковского перевода. Остаток Felmee пока относится к прежнему получателю.", className: "text-status-blue" },
  APPLYING: { label: "Обновление баланса Felmee", description: "Банк подтвердил перевод. Обновляется внутренний остаток Felmee.", className: "text-status-blue" },
  DONE: { label: "Перенос завершён", description: "Остаток Felmee перенесён новому получателю.", className: "text-success" },
  REVIEW_REQUIRED: { label: "Требуется ручная сверка", description: "Нужно вручную сверить результат банковского перевода и остаток Felmee. Повторный перевод из админки недоступен.", className: "text-warning" },
};

type ApplicationBankState = Pick<BusinessApplicationCard, "bank_status" | "balance_transfer_status">;

export function isBusinessApplicationConfirmed(card: ApplicationBankState | undefined): boolean {
  return card?.bank_status === "VERIFIED" && (!card.balance_transfer_status || card.balance_transfer_status === "DONE");
}

/** PENDING допускает исправление данных; после подготовки перевода изменения блокируются. */
export function isBeneficiaryMigrationLocked(status: BalanceTransferStatus | undefined): boolean {
  return Boolean(status && status !== "PENDING" && status !== "DONE");
}

export function shouldPollBusinessApplication(card: ApplicationBankState | undefined, queued = false): boolean {
  if (!card || card.balance_transfer_status === "REVIEW_REQUIRED") return false;
  if (card.bank_status === "UNDER_REVIEW" || queued && card.bank_status === "NOT_SENT") return true;
  if (card.balance_transfer_status === "PENDING") return card.bank_status === "VERIFIED";
  return Boolean(card.balance_transfer_status && card.balance_transfer_status !== "DONE");
}

export function businessBankErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    PASSPORT_EXPIRED: "Срок действия паспорта истёк. Укажите данные действующего паспорта и актуальные документы перед повторной отправкой.",
    IDENTITY_REJECTED: "Проверка паспортных данных или ИНН не пройдена. Проверьте данные и документы перед повторной отправкой.",
    BENEFICIARY_REJECTED: "Финальная проверка получателя банком не пройдена. Проверьте данные перед повторной отправкой.",
    EXISTING_BENEFICIARY_MISMATCH: "Данные существующего получателя в банке не совпадают с данными заявки. Проверьте данные партнёра.",
    IDENTITY_CHECK_ERROR: "Не удалось проверить документы из-за технической ошибки. Повторите отправку в банк позже.",
    OFFER_UPLOAD_ERROR: "Не удалось обработать оферту. Повторите отправку в банк позже.",
    DOCUMENTS_RETRY_LATER: "Банк просит повторить проверку позже. Запустите повторную отправку вручную.",
    INTEGRATION_ERROR: "Не удалось связаться с банком или обработать запрос. Повторите отправку вручную позже.",
    TRANSFER_MISMATCH: "Результат банковского перевода не совпадает с ожидаемым. Нужна ручная сверка перевода и остатков Felmee.",
    TRANSFER_CANCELED: "Банковский перевод отменён. Нужна ручная сверка перевода и остатков Felmee.",
    TRANSFER_REJECTED: "Банк отклонил перевод остатка. Нужна ручная сверка.",
    TRANSFER_STATUS_UNKNOWN: "Результат банковского перевода неизвестен. Нужна ручная сверка перед дальнейшими действиями.",
  };
  return Object.hasOwn(messages, code) ? messages[code] : "Банк не завершил проверку успешно. Уточните причину отказа у поддержки.";
}

export const BUSINESS_BANK_META: Record<BusinessApplicationCard["bank_status"], { label: string; className: string }> = {
  NOT_SENT: { label: "Не отправлено", className: "text-brand" },
  UNDER_REVIEW: { label: "На проверке банком", className: "text-status-blue" },
  VERIFIED: { label: "Проверен банком", className: "text-success" },
  NOT_VERIFIED: { label: "Не подтверждены банком", className: "text-warning" },
  TECHNICAL_ERROR: { label: "Ошибка проверки банком", className: "text-danger" },
};
