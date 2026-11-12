import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export type OtpState = "default" | "error" | "success";

interface OtpInputProps {
  /** Количество ячеек. */
  length?: number;
  /** Введённый код (компактная строка цифр). */
  value: string;
  onChange: (value: string) => void;
  /** Состояние рамок: обычное, ошибка (красная) или успех (зелёная). */
  state?: OtpState;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Поле ввода одноразового кода из `length` ячеек. Автопереход между ячейками,
 * Backspace, стрелки и вставка кода целиком. Одна цифра — одна ячейка.
 */
export function OtpInput({
  length = 5,
  value,
  onChange,
  state = "default",
  autoFocus,
  className,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  function focusAt(i: number) {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  }

  function setChar(i: number, ch: string) {
    const next = [...chars];
    next[i] = ch;
    onChange(next.join("").slice(0, length));
  }

  function handleChange(i: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    setChar(i, digits[digits.length - 1]);
    if (i < length - 1) focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[i]) {
        setChar(i, "");
      } else if (i > 0) {
        setChar(i - 1, "");
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!digits) return;
    onChange(digits);
    focusAt(Math.min(digits.length, length - 1));
  }

  const borderByState: Record<OtpState, string> = {
    default: "border-grey-2 focus:border-ink",
    error: "border-danger",
    success: "border-success",
  };

  return (
    <div
      className={cn("flex w-full items-center justify-between", className)}
      role="group"
    >
      {chars.map((ch, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key -- позиция ячейки статична
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={ch}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            "h-[67px] w-[61px] rounded-[10px] border text-center text-[32px] font-medium text-ink caret-brand outline-none transition-colors",
            borderByState[state],
          )}
        />
      ))}
    </div>
  );
}
