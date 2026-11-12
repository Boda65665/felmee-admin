import { useAuthStore, type TokenPair } from "@/lib/auth/auth-store";
import { api, unwrap } from "./client";

/** Тип аккаунта для входа в админ-панель (enum `AuthTypeAccount`). */
const ADMIN_TYPE_ACCOUNT = "ADMIN" as const;

/**
 * Отправить OTP-код на телефон. Сервер сам нормализует номер.
 * Возвращает `TTL` (секунды до следующей разрешённой отправки) из ответа —
 * по нему заводится таймер повторной отправки. На 429 бросает (кулдаун-модалку
 * из `data.TTL` показывает middleware клиента).
 */
export const sendPhoneOtp = async (
  recipient: string,
): Promise<number> => {
  const res = await api.POST("/api/auth/phone/send/otp", {
    body: { recipient },
  });
  const data = unwrap(res);
  return Number(data?.retry?.TTL) || 0;
};

/** Войти по номеру телефона и OTP; сохраняет пару токенов в хранилище. */
export const loginByPhone = async (
  phone: string,
  otp: string,
): Promise<TokenPair> => {
  const res = await api.POST("/api/auth/phone/login", {
    body: { phone, otp, type_account: ADMIN_TYPE_ACCOUNT },
  });
  const tokens = unwrap<TokenPair>(res as never);
  useAuthStore.getState().setTokens(tokens);
  return tokens;
};

/**
 * Завершить сессию на сервере и очистить локальные токены. Эндпоинт требует
 * оба токена: JWT (заголовок `Authorization` добавляет middleware) и RT
 * (заголовок `RT: Bearer <refresh_token>`) — чтобы погасить и refresh-токен.
 */
export const logout = async (): Promise<void> => {
  const rt = useAuthStore.getState().rt;
  try {
    await api.POST("/api/auth/logout", {
      headers: rt ? { RT: `Bearer ${rt}` } : undefined,
    });
  } finally {
    useAuthStore.getState().clearTokens();
  }
};
