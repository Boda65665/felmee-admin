import { useCallback, useRef, useState } from "react";

/** Модульное хранилище значений по ключам — переживает навигацию внутри SPA. */
const store = new Map<string, unknown>();

/**
 * Как `useState`, но значение сохраняется в модульном сторе по `key` и
 * переживает размонтирование компонента (переход между страницами роутера).
 * Используется для фильтров/поиска на страницах списков, чтобы они не терялись
 * при уходе со страницы и возврате. Сбрасывается только перезагрузкой вкладки.
 *
 * Хранилище — in-memory (не localStorage), поэтому в значениях можно держать
 * `Date` и прочие не-JSON объекты без сериализации.
 */
export const usePersistentState = <T,>(key: string, initial: T | (() => T)) => {
  const [state, setState] = useState<T>(() =>
    store.has(key)
      ? (store.get(key) as T)
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  );

  // Актуальное значение для функциональных обновлений без side-effect в updater.
  const ref = useRef(state);
  ref.current = state;

  const set = useCallback(
    (value: T | ((prev: T) => T)) => {
      const next =
        typeof value === "function"
          ? (value as (prev: T) => T)(ref.current)
          : value;
      store.set(key, next);
      setState(next);
    },
    [key],
  );

  return [state, set] as const;
};
