import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ROUTES } from "@/lib/routes";
import { getPostLoginRoute } from "@/lib/auth";
import { ApiError, loginByPhone, sendPhoneOtp } from "@/lib/api";
import { useCooldownStore } from "@/lib/cooldown-store";
import { OtpInput, type OtpState } from "@/components/ui";

const CODE_LENGTH = 6;
/** Фолбэк, если бэк не прислал TTL (не должен в норме). */
const RESEND_SECONDS = 60;

const formatTimer = (seconds: number): string => {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

export default function CodeLoginPage() {
  const navigate = useNavigate();
  // Из экрана входа приходят чистый номер (`phone`), маска (`display`) и TTL
  // до следующей разрешённой отправки (`ttl`, из ответа send/otp).
  const navState = useLocation().state as
    | { phone?: string; display?: string; ttl?: number }
    | null;
  const phone = navState?.phone;

  const [code, setCode] = useState("");
  const [state, setState] = useState<OtpState>("default");
  const [errorText, setErrorText] = useState("Неверный код, попробуйте еще раз");
  // Старт таймера — реальный TTL с экрана входа (фолбэк, если не пришёл).
  const [seconds, setSeconds] = useState(navState?.ttl || RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // Прямой заход на экран без номера — возвращаем на ввод телефона.
  if (!phone) return <Navigate to={ROUTES.login} replace />;

  const handleChange = async (value: string) => {
    setCode(value);
    if (value.length < CODE_LENGTH) {
      setState("default");
      return;
    }

    try {
      await loginByPhone(phone!, value);
      setState("success");
      // На последний открытый экран (если был), иначе — на дефолтный.
      navigate(getPostLoginRoute(), { replace: true });
    } catch (err) {
      setState("error");
      if (err instanceof ApiError && err.code === "code_is_gone") {
        setErrorText("Код истёк — запросите новый");
      } else if (err instanceof ApiError && err.code === "forbidden") {
        // Код верный — бэк его принял, но у аккаунта нет роли ADMIN /
        // прав на админ-панель. Не путаем пользователя «неверным кодом».
        setErrorText("Нет доступа к админ-панели для этого номера");
      } else {
        setErrorText("Неверный код, попробуйте еще раз");
      }
    }
  };

  const handleResend = async () => {
    setCode("");
    setState("default");
    try {
      const ttl = await sendPhoneOtp(phone!);
      // Таймер — по реальному TTL из ответа (фолбэк, если не пришёл).
      setSeconds(ttl || RESEND_SECONDS);
    } catch {
      // Отправка не прошла (напр. 429 — ещё рано): если middleware завёл
      // кулдаун из `data.TTL`, зеркалим его остаток в таймер повторной отправки.
      const until = useCooldownStore.getState().until;
      const remaining = until ? Math.ceil((until - Date.now()) / 1000) : 0;
      if (remaining > 0) setSeconds(remaining);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <h1 className="text-[32px] font-medium leading-[1.1] text-ink">
          Войти в админ панель
        </h1>
        <p className="text-base leading-[1.3] text-ink-muted">
          Мы отправили вам СМС с кодом
          <br />
          на ваш номер телефона{" "}
          <span className="text-ink">{navState?.display ?? phone}</span>
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        <OtpInput
          length={CODE_LENGTH}
          value={code}
          onChange={handleChange}
          state={state}
          autoFocus
        />
        {state === "error" && (
          <p className="text-base leading-[1.25] text-danger">{errorText}</p>
        )}
      </div>

      <p className="text-center text-base leading-[1.3] text-ink">
        {seconds > 0 ? (
          <>
            <span className="font-semibold">Отправить код повторно</span>
            {` через ${formatTimer(seconds)}`}
          </>
        ) : (
          <>
            <span className="font-semibold">Код не пришел</span>{" "}
            <button
              type="button"
              onClick={handleResend}
              className="underline underline-offset-2"
            >
              Отправить повторно
            </button>
          </>
        )}
      </p>
    </div>
  );
}
