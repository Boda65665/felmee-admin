import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { refreshTokens } from "@/lib/api/client";
import { useAuthStore } from "./auth-store";
import { isJwtExpired } from "./jwt";

/**
 * Приводит локальную сессию в согласованное состояние ДО рендера роутов:
 * - нет токенов вовсе → гость, ничего не делаем;
 * - jwt ещё жив → оставляем как есть;
 * - jwt истёк/отсутствует, но есть refresh-токен → обновляем пару;
 * - обновить не удалось (или нет RT) → чистим токены.
 * После этого `Boolean(jwt)` в сторе достоверен, и гарды роутов не «мигают».
 */
async function bootstrapSession(): Promise<void> {
  const { jwt, rt } = useAuthStore.getState();
  if (!jwt && !rt) return;
  if (jwt && !isJwtExpired(jwt)) return;
  if (!rt) {
    useAuthStore.getState().clearTokens();
    return;
  }
  const ok = await refreshTokens();
  if (!ok) useAuthStore.getState().clearTokens();
}

/** Полноэкранный сплэш на время инициализации сессии. */
function SessionSplash() {
  return (
    <div className="flex h-svh items-center justify-center bg-white">
      <Loader2 className="size-8 animate-spin text-brand" />
    </div>
  );
}

/**
 * Инициализация сессии на старте приложения. Пока идёт bootstrap — сплэш;
 * после него токены гарантированно валидны или очищены, поэтому
 * `ProtectedRoute`/`PublicOnlyRoute` судят о входе по актуальному наличию
 * токена без «мигания» и лишних 401.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    bootstrapSession().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return <SessionSplash />;
  return <>{children}</>;
}
