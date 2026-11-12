import { create } from "zustand";
import { adminErrorDetails, type AdminErrorDetails } from "./error-details";
import { useCooldownStore } from "./cooldown-store";

type ErrorPopupItem = AdminErrorDetails & { title: string; dismissers: (() => void)[] };
type ErrorPopupState = {
  items: ErrorPopupItem[];
  show: (error: unknown, title?: string, onDismiss?: () => void) => void;
  dismiss: () => void;
};

export const useErrorPopupStore = create<ErrorPopupState>((set, get) => ({
  items: [],
  show: (error, title = "Не удалось выполнить действие", onDismiss) => {
    const details = adminErrorDetails(error);
    if ((details.status === 429 || details.code === "too_many_request") && (useCooldownStore.getState().until ?? 0) > Date.now()) {
      onDismiss?.();
      return;
    }
    set(state => {
      const match = state.items.find(item => item.message === details.message && item.code === details.code);
      if (match) return { items: state.items.map(item => item === match && onDismiss && !item.dismissers.includes(onDismiss)
        ? { ...item, dismissers: [...item.dismissers, onDismiss] } : item) };
      return { items: [...state.items, { ...details, title, dismissers: onDismiss ? [onDismiss] : [] }] };
    });
  },
  dismiss: () => {
    const current = get().items[0];
    set(state => ({ items: state.items.slice(1) }));
    current?.dismissers.forEach(dismiss => dismiss());
  },
}));
