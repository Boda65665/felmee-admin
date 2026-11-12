import { Check, X } from "lucide-react";

/**
 * Кнопки модерации заявки: «Одобрить» (зелёная) и «Отклонить с пояснением»
 * (красный контур, открывает модалку причины). Цвета — из макета, в палитре
 * темы их нет. Рендерится фрагментом внутри flex-контейнера. Пока идёт запрос
 * (`pending`) — обе кнопки заблокированы, на «Одобрить» — текст ожидания.
 */
export function ModerationActions({
  onApprove,
  onReject,
  pending = false,
}: {
  onApprove: () => void;
  onReject: () => void;
  pending?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onApprove}
        disabled={pending}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2f9e5b] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Check className="size-4" />
        {pending ? "Одобрение…" : "Одобрить"}
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={pending}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#e15c46] bg-white px-5 text-sm font-semibold text-[#e15c46] transition-colors hover:bg-[#e15c46]/5 disabled:opacity-60"
      >
        <X className="size-4" />
        Отклонить с пояснением
      </button>
    </>
  );
}
