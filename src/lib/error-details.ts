import { documentReviewErrorMessage } from "./error-messages";
import { businessBankErrorMessage } from "./business-bank-status";

export type AdminErrorDetails = { message: string; code: string | null; status: number | null };

const masterValidationMessages: Record<string, string> = {
  "Salon masters inherit city and service locations from their salon": "Город и места оказания услуг мастера берутся из профиля салона. Измените их в карточке салона.",
  "Service locations are invalid": "Проверьте адреса и координаты мест оказания услуг. Для выезда к клиенту проверьте радиус.",
  "First name must not be blank, must not be longer than 100 characters and must contain only Russian letters": "Укажите имя русскими буквами, не более 100 символов.",
  "Last name must not be blank, must not be longer than 100 characters and must contain only Russian letters": "Укажите фамилию русскими буквами, не более 100 символов.",
  "City must not be blank and must not be longer than 30 characters": "Укажите город, не более 30 символов.",
};

/** Preserve API codes without depending on a particular transport or Error subclass. */
export function adminErrorDetails(error: unknown): AdminErrorDetails {
  const value = typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
  const code = typeof value?.code === "string" ? value.code : typeof value?.error_code === "string" ? value.error_code : null;
  const status = typeof value?.status === "number" ? value.status : null;
  const raw = typeof error === "string" ? error : typeof value?.message === "string" ? value.message : "";
  const generic = "Не удалось выполнить действие. Попробуйте ещё раз позже.";
  const codeMessages: Record<string, string> = {
    forbidden: "У вас нет доступа к этому действию. Обратитесь к администратору, который управляет правами доступа.",
    unauthorized: "Сеанс завершён. Войдите в админку снова.",
    not_found: "Запись не найдена или больше недоступна. Обновите список.",
    invalid_body: "Проверьте введённые данные и повторите действие.",
    internal_error: "На сервере произошла ошибка. Повторите попытку позже.",
    too_many_request: "Слишком много запросов. Подождите немного и повторите действие.",
  };
  const masterMessage = code === "invalid_body" && Object.hasOwn(masterValidationMessages, raw)
    ? masterValidationMessages[raw]
    : undefined;
  let message = masterMessage ?? (raw ? documentReviewErrorMessage(raw) : code ? businessBankErrorMessage(code)! : generic);
  if (message === generic && code && Object.hasOwn(codeMessages, code)) message = codeMessages[code];
  if (code && raw === code) message = businessBankErrorMessage(code)!;
  return { message, code, status };
}
