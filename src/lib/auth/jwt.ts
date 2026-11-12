/** Утилиты по JWT — только чтение payload для UX (подпись не проверяем). */

/** Читает `exp` (unix-секунды) из payload JWT; `null`, если не удалось. */
function readExp(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Истёк ли access-токен (с запасом `skewSeconds` на рассинхрон часов).
 * Если `exp` прочитать не удалось — считаем токен валидным: реальную протухшесть
 * подстрахует реактивный refresh на первом `401`.
 */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const exp = readExp(token);
  if (exp == null) return false;
  return Date.now() >= (exp - skewSeconds) * 1000;
}
