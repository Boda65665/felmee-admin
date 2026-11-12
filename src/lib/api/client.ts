import createClient, { type Middleware } from "openapi-fetch";

import { useAuthStore } from "@/lib/auth/auth-store";
import { useCooldownStore } from "@/lib/cooldown-store";
import type { paths } from "./schema";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/** Единый конверт ответа всех REST-эндпоинтов Felmee. */
export interface Envelope<T> {
  success: boolean;
  message: string;
  error_code: string | null;
  codeError: string | null;
  data: T;
}

/** Ошибка API с машинным кодом (`error_code`) и HTTP-статусом. */
export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(code: string | null, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Разворачивает результат openapi-fetch: при `success` возвращает `data`,
 * иначе бросает {@link ApiError} с кодом и сообщением из конверта.
 */
export function unwrap<T>(res: {
  data?: Envelope<T>;
  error?: Envelope<unknown>;
  response: Response;
}): T {
  if (res.data?.success) return res.data.data;
  const env = res.error ?? (res.data as Envelope<unknown> | undefined);
  throw new ApiError(
    env?.error_code ?? env?.codeError ?? null,
    env?.message ?? res.response.statusText,
    res.response.status,
  );
}

/** Таймаут на обновление токена, чтобы зависший запрос не морозил приложение. */
const REFRESH_TIMEOUT_MS = 10_000;

const doRefresh = async (): Promise<boolean> => {
  const rt = useAuthStore.getState().rt;
  if (!rt) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: { RT: `Bearer ${rt}` },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = (await res.json()) as Envelope<{ JWT: string; RT: string }>;
    if (!body.success || !body.data?.JWT) return false;
    useAuthStore.getState().setTokens({ JWT: body.data.JWT, RT: body.data.RT ?? rt });
    return true;
  } catch {
    // Сетевой сбой или abort по таймауту — считаем refresh неуспешным.
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** Single-flight обновление токенов, чтобы параллельные 401 не плодили запросы. */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Обновить пару токенов по refresh-токену (single-flight). Используется и
 * реактивно на `401`, и при старте приложения (bootstrap сессии).
 */
export const refreshTokens = (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// fetch consumes a request body; save its replay copy before sending it.
const retryRequests = new WeakMap<Request, Request>();

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const jwt = useAuthStore.getState().jwt;
    if (jwt) request.headers.set("Authorization", `Bearer ${jwt}`);
    if (!new URL(request.url).pathname.includes("/api/auth/")) {
      retryRequests.set(request, request.clone());
    }
    return request;
  },
  async onResponse({ request, response }) {
    // 429 «слишком много запросов» — берём кулдаун из `data.TTL` (секунды) и
    // показываем модалку с обратным отсчётом.
    if (response.status === 429) {
      try {
        const body = await response.clone().json();
        useCooldownStore.getState().start(Number(body?.data?.TTL), body?.error_code ?? body?.codeError ?? null);
      } catch {
        // тело не JSON — просто не показываем таймер
      }
      return response;
    }

    // Не рефрешим на самих auth-эндпоинтах (login/refresh/logout).
    if (response.status !== 401 || new URL(request.url).pathname.includes("/api/auth/")) {
      return response;
    }

    const ok = await refreshTokens();
    if (!ok) {
      // Восстановить сессию не удалось — чистим токены. Редирект на логин
      // делает ProtectedRoute: он подписан на стор и мягко (без перезагрузки
      // страницы) уведёт на /login, сохранив SPA-состояние.
      useAuthStore.getState().clearTokens();
      return response;
    }

    // Повтор исходного запроса с новым access-токеном.
    const retry = retryRequests.get(request);
    if (!retry) return response;
    retryRequests.delete(request);
    retry.headers.set("Authorization", `Bearer ${useAuthStore.getState().jwt}`);
    return fetch(retry);
  },
};

/** Типизированный REST-клиент Felmee (авто-заголовок + refresh на 401). */
export const api = createClient<paths>({ baseUrl: BASE_URL });
api.use(authMiddleware);
