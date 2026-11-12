import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clearLastRoute } from "./last-route";

/** Ключ пары токенов в localStorage (persist). */
const STORAGE_KEY = "felmee.auth";

export interface TokenPair {
  JWT: string;
  RT: string;
}

interface AuthState {
  jwt: string | null;
  rt: string | null;
  setTokens: (tokens: TokenPair) => void;
  clearTokens: () => void;
}

/**
 * Стор авторизации: пара токенов + действия. Персистится в localStorage
 * (транспорт Bearer). Читается вне React через `useAuthStore.getState()`
 * — так клиент API берёт токены для заголовков и refresh.
 *
 * Переезд на HttpOnly-cookie позже: убрать persist и отдачу токенов в заголовки.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      jwt: null,
      rt: null,
      setTokens: ({ JWT, RT }) => set({ jwt: JWT, rt: RT }),
      /**
       * Полный сброс сессии: обнуляем токены в сторе (для реактивного
       * редиректа на логин) и вычищаем из localStorage и пару токенов, и
       * последний маршрут — мёртвая сессия не переиспользуется, а `lastRoute`
       * привязан к прежнему пользователю.
       */
      clearTokens: () => {
        set({ jwt: null, rt: null });
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // приватный режим / недоступный сторидж — не критично
        }
        clearLastRoute();
      },
    }),
    { name: STORAGE_KEY },
  ),
);

/** Селектор: есть ли действующий access-токен. */
export const selectIsAuthenticated = (s: AuthState): boolean => Boolean(s.jwt);
