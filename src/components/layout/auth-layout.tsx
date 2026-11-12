import { Outlet } from "react-router-dom";

import welcomeIllustration from "@/assets/welcome-illustration.png";
import { BrandLogo } from "@/components/brand-logo";

/** Приветственный баннер справа (фиолетовая панель с иллюстрацией). */
function WelcomePanel() {
  return (
    <aside className="hidden shrink-0 p-10 lg:block lg:w-[44%]">
      <div className="relative flex h-full flex-col items-center overflow-hidden rounded-xl bg-brand px-12 pt-[122px]">
        <div className="flex w-full max-w-[735px] flex-col items-start gap-[30px] text-center">
          <h2 className="w-full text-[40px] font-medium leading-[1.1] text-white">
            Добро пожаловать
            <br />в «Felmee»
          </h2>
          <p className="w-full text-xl leading-[1.3] text-white/70">
            Управляйте салоном, мастерами и записями в одном месте. Расписание,
            финансы, аналитика и коммуникация с клиентами — всё под контролем в
            удобном интерфейсе.
          </p>
        </div>

        {/* Иллюстрация — обрезка левой сцены из общего PNG (как в макете) */}
        <div className="relative mt-10 aspect-[567/467] w-full max-w-[567px] overflow-hidden">
          <img
            src={welcomeIllustration}
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-0 top-[-58.24%] h-[219.27%] w-[270.9%] max-w-none"
          />
        </div>
      </div>
    </aside>
  );
}

/** Юридические ссылки в нижнем левом углу. */
function LegalLinks() {
  return (
    <div className="mt-10 flex w-full max-w-[400px] flex-wrap items-start gap-x-5 gap-y-3 lg:absolute lg:bottom-12 lg:left-12 lg:mt-0 lg:flex-col">
      <a
        href="#"
        className="border-b border-ink-muted pb-0.5 text-sm leading-[1.3] text-ink-muted"
      >
        Юридическая информация
      </a>
      <a
        href="#"
        className="border-b border-ink-muted pb-0.5 text-sm leading-[1.3] text-ink-muted"
      >
        Пользовательское соглашение
      </a>
    </div>
  );
}

/**
 * Оболочка экранов авторизации (layout-роут): слева — форма экрана (через
 * `<Outlet/>`) по центру колонки шириной 400px и юр. ссылки внизу, справа —
 * приветственный баннер. Баннер и иллюстрация не пересоздаются между экранами
 * логина и ввода кода, т.к. оболочка остаётся смонтированной.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh bg-background">
      <section className="relative flex min-w-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-16">
        <div className="w-full max-w-[400px]">
          <BrandLogo className="mb-8" />
          <Outlet />
        </div>

        <LegalLinks />
      </section>

      <WelcomePanel />
    </div>
  );
}
