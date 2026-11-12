import { ErrorPopup } from "@/components/error-popup";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { ApiError, sendPhoneOtp } from "@/lib/api";

/** Шаблон маски: 10 подчёркиваний — национальные цифры номера. */
const PHONE_TEMPLATE = "+7 (___) ___-__-__";

/** Извлекает до 10 национальных цифр из произвольного ввода. */
function extractDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("8")) d = d.slice(1);
  if (d.startsWith("7")) d = d.slice(1);
  return d.slice(0, 10);
}

/**
 * Раскладывает цифры по шаблону и возвращает уже заполненную часть (тёмную)
 * и оставшийся «хвост» шаблона (серый) — как в макете.
 */
function buildMask(digits: string): { filled: string; rest: string } {
  if (digits.length === 0) return { filled: "", rest: PHONE_TEMPLATE };

  let filled = "";
  let di = 0;
  let i = 0;
  // Останавливаемся сразу после последней цифры: завершающие разделители
  // шаблона уходят в серый «хвост» (rest), а не в значение инпута. Иначе value
  // кончается на разделитель, и Backspace не может стереть цифру назад.
  for (; i < PHONE_TEMPLATE.length && di < digits.length; i++) {
    const ch = PHONE_TEMPLATE[i];
    filled += ch === "_" ? digits[di++] : ch;
  }
  return { filled, rest: PHONE_TEMPLATE.slice(i) };
}

export default function LoginPage() {
  const [error, setError] = useState<string | Error | null>(null);
  const [digits, setDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { filled, rest } = useMemo(() => buildMask(digits), [digits]);
  const isValid = digits.length === 10;

  // Значение инпута — отформатированная строка (`+7 (912) …`), длиннее того,
  // что реально набрал пользователь. React после ввода восстанавливает каретку
  // на прежнее смещение — она попадает в префикс `+7 (`, и следующая цифра
  // вставляется в середину. Держим каретку в конце: ввод всегда дописывается.
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [filled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    // Чистый номер в формате E.164 для бэкенда; сервер всё равно нормализует.
    const phone = `+7${digits}`;
    setSubmitting(true);
    setError(null);
    try {
      const ttl = await sendPhoneOtp(phone);
      navigate(ROUTES.code, { state: { phone, display: filled, ttl } });
    } catch (err) {
      setError(
        err instanceof ApiError ? err : "Не удалось отправить код. Попробуйте ещё раз",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="flex w-full flex-col items-center gap-6"
      onSubmit={handleSubmit}
    >
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <h1 className="text-[32px] font-medium leading-[1.1] text-ink">
          Войти в админ панель
        </h1>

        <p className="max-w-[322px] text-base leading-[1.3] text-ink-muted">
          Пожалуйста введите ваш номер телефона, мы пришлём код для
          подтверждения
        </p>
      </div>

      <label className="relative flex h-12 w-full items-center rounded-xl border border-grey-1 px-4 transition-colors focus-within:border-[1.5px] focus-within:border-brand">
        {/* Видимый слой маски: заполненное — тёмным, остаток шаблона — серым */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center px-4 text-sm leading-[1.3]"
        >
          {digits.length === 0 ? (
            <span className="text-grey-1">{PHONE_TEMPLATE}</span>
          ) : (
            <>
              <span className="text-ink">{filled}</span>
              <span className="text-grey-1">{rest}</span>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={filled}
          onChange={(e) => setDigits(extractDigits(e.target.value))}
          className="relative w-full bg-transparent text-sm leading-[1.3] text-transparent caret-ink outline-none"
        />
      </label>

      <div className="flex w-full flex-col items-center gap-2">
        <ErrorPopup error={error} onDismiss={() => setError(null)} />

        <button
          type="submit"
          disabled={!isValid || submitting}
          className={cn(
            "flex h-12 w-full items-center justify-center rounded-[10px] px-3 py-2.5 text-base leading-[1.3] text-white transition-colors",
            isValid && !submitting
              ? "bg-brand hover:opacity-90"
              : "cursor-not-allowed bg-grey-3",
          )}
        >
          {submitting ? "Отправляем…" : "Получить код"}
        </button>

        <p className="max-w-[281px] text-center text-xs leading-[1.4] text-ink-muted">
          Нажимая «Получить код», вы даете свое согласие на обработку{" "}
          <a href="#" className="text-ink underline">
            персональных данных
          </a>
        </p>
      </div>
    </form>
  );
}
