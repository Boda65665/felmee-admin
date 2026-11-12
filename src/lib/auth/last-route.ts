import { ROUTES } from "@/lib/routes";

/** Ключ в localStorage под последний открытый экран админки. */
const KEY = "felmee.lastRoute";

/** Пути авторизации — на них не возвращаем после входа. */
const AUTH_PATHS: string[] = [ROUTES.login, ROUTES.code];

/** Известные защищённые пути — для валидации сохранённого маршрута. */
const PROTECTED_PATHS = Object.values(ROUTES).filter(
  (p) => !AUTH_PATHS.includes(p),
);

/** Ведёт ли путь (без query) на защищённый экран админки. */
function isProtectedPath(path: string): boolean {
  const pathname = path.split("?")[0];
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Сохранить последний открытый экран (только защищённые пути). */
export function saveLastRoute(path: string): void {
  if (!isProtectedPath(path)) return;
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // приватный режим / переполнение хранилища — не критично
  }
}

/**
 * Забыть последний открытый экран. Вызывается при полном сбросе сессии:
 * `lastRoute` относится к прежнему пользователю, для нового он не имеет смысла.
 */
export function clearLastRoute(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Куда вести после входа: последний открытый экран либо дашборд. */
export function getPostLoginRoute(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && isProtectedPath(saved)) return saved;
  } catch {
    // ignore
  }
  // «Обзор бизнеса» временно скрыт — по умолчанию ведём на «Пользователи».
  return ROUTES.users;
}
