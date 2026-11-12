import { create } from "zustand";

interface CooldownState {
  /** Таймстамп (мс) окончания кулдауна, либо null — кулдауна нет. */
  until: number | null;
  code: string | null;
  /** Запустить кулдаун на `seconds` секунд (продлевает, если новый дедлайн дальше). */
  start: (seconds: number, code?: string | null) => void;
  /** Сбросить кулдаун (закрыть модалку). */
  clear: () => void;
}

/**
 * Глобальный кулдаун при `429 too_many_request`. Клиент API кладёт сюда `TTL`
 * из ответа, а `CooldownDialog` показывает обратный отсчёт. Читается вне React
 * (`getState`), поэтому доступен из middleware клиента.
 */
export const useCooldownStore = create<CooldownState>((set, get) => ({
  until: null,
  code: null,
  start: (seconds, code = null) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const next = Date.now() + seconds * 1000;
    const current = get().until;
    if (current && current >= next) return; // уже есть более дальний дедлайн
    set({ until: next, code });
  },
  clear: () => set({ until: null, code: null }),
}));
