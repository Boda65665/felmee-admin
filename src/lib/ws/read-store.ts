import { create } from "zustand";

interface ReadState {
  /** dialogId → последний прочитанный клиентом id сообщения. */
  pointers: Record<number, number>;
  setLastRead: (dialogId: number, lastReadId: number) => void;
}

/**
 * Указатели прочтения исходящих сообщений поддержки. Обновляются live по
 * WS-событию `chat.read_message` (`{ dialog_id, last_read_message_id }`):
 * все сообщения с `id ≤ last_read_message_id` считаются прочитанными клиентом.
 * Снапшота в REST нет — до первого события указатель равен 0 (неизвестно).
 */
export const useSupportReadStore = create<ReadState>((set) => ({
  pointers: {},
  setLastRead: (dialogId, lastReadId) =>
    set((state) => {
      const current = state.pointers[dialogId] ?? 0;
      // Указатель только растёт — старые события не откатывают прогресс.
      if (lastReadId <= current) return state;
      return { pointers: { ...state.pointers, [dialogId]: lastReadId } };
    }),
}));

/** Последний прочитанный клиентом id сообщения в диалоге (0 — неизвестно). */
export const useLastReadId = (dialogId: number) =>
  useSupportReadStore((state) => state.pointers[dialogId] ?? 0);
