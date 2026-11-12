import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Bell,
  Flag,
  Lock,
  Star,
  Store,
  Menu,
  Users,
  Loader2,
  LogOut,
  Share2,
  FileText,
  History,
  Calendar,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth, saveLastRoute, usePermissions } from "@/lib/auth";
import { ROUTES, type RoutePath } from "@/lib/routes";
import { useCurrentUser } from "@/lib/api/current-user";
import { AvatarImage } from "@/components/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  Dialog,
  DialogTitle,
  DialogClose,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

type NavItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Маршрут пункта меню. */
  to?: RoutePath;
};
type NavSection = { title: string; items: NavItem[] };

/** Маршруты, на которых подсвечен пункт «Обзор бизнеса» (дашборд и его детали). */
const BUSINESS_ROUTES: string[] = [
  ROUTES.dashboard,
  ROUTES.gmv,
  ROUTES.revenue,
  ROUTES.averageCheck,
  ROUTES.conversion,
];

/** Разделы бокового меню админки. */
const NAV: NavSection[] = [
  {
    title: "Основное",
    items: [
      { icon: LayoutDashboard, label: "Обзор бизнеса", to: ROUTES.dashboard },
    ],
  },
  {
    title: "Управление",
    items: [
      { icon: Users, label: "Пользователи", to: ROUTES.users },
      { icon: Store, label: "Мастера и салоны", to: ROUTES.masters },
      { icon: Calendar, label: "Записи", to: ROUTES.appointments },
      { icon: Lock, label: "Категории", to: ROUTES.categories },
      { icon: FileText, label: "Документы", to: ROUTES.documents },
    ],
  },
  {
    title: "Программы",
    items: [
      { icon: Share2, label: "Реферальная программа", to: ROUTES.referral },
      { icon: Star, label: "Программа лояльности", to: ROUTES.loyalty },
    ],
  },
  {
    title: "Поддержка",
    items: [
      { icon: MessageSquare, label: "Обращения", to: ROUTES.chats },
      { icon: Flag, label: "Жалобы", to: ROUTES.complaints },
      { icon: Bell, label: "Уведомления", to: ROUTES.notifications },
    ],
  },
  {
    title: "Доступ",
    items: [
      { icon: KeyRound, label: "Роли", to: ROUTES.roles },
      { icon: History, label: "История действий", to: ROUTES.history },
    ],
  },
];

/** Подсвечен ли пункт меню для текущего маршрута. */
function isNavActive(to: RoutePath | undefined, pathname: string): boolean {
  if (!to) return false;
  if (to === ROUTES.dashboard) return BUSINESS_ROUTES.includes(pathname);
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Боковое меню: логотип, разделы навигации и карточка пользователя. */
function Sidebar({
  sections,
  onLogout,
  onNavigate,
  onClose,
}: {
  /** Уже отфильтрованные по правам разделы меню. */
  sections: NavSection[];
  onLogout: () => void;
  /** Вызывается после перехода по пункту — закрывает выезжающий drawer. */
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const profile = useCurrentUser(isAuthenticated);
  const profileName = [profile.data?.first_name, profile.data?.last_name]
    .filter(Boolean)
    .join(" ");
  const displayName = profileName || profile.data?.phone ||
    (profile.data?.id != null ? `Аккаунт #${profile.data.id}` : null) ||
    (profile.isLoading ? "Загрузка…" : "Профиль недоступен");
  return (
    <aside className="flex h-dvh w-[280px] max-w-full shrink-0 flex-col border-r border-grey-4 bg-white">
      <div className="flex items-center gap-2 px-5 py-4">
        <BrandLogo />
        {onClose && (
          <button type="button" aria-label="Закрыть меню" onClick={onClose}
            className="ml-auto flex size-11 items-center justify-center rounded-xl text-ink hover:bg-grey-5">
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 pt-2 pb-6">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-3">
            <p className="pl-7 text-xs font-medium uppercase leading-[1.3] tracking-tight text-ink-muted">
              {section.title}
            </p>
            <div className="flex flex-col">
              {section.items.map(({ icon: Icon, label, to }) => {
                const isActive = isNavActive(to, pathname);
                // Пункты без маршрута — ещё не реализованные экраны: показываем
                // их приглушёнными и неактивными, с меткой «Скоро».
                const isDisabled = !to;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    title={isDisabled ? "Раздел в разработке" : undefined}
                    onClick={() => {
                      if (!to) return;
                      navigate(to);
                      onNavigate?.();
                    }}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl py-3 pl-7 pr-3 text-left text-[15px] font-medium leading-[1.3] tracking-tight transition-colors",
                      isActive && "bg-brand/10 text-brand",
                      !isActive && !isDisabled && "text-ink hover:bg-grey-5",
                      isDisabled && "cursor-not-allowed text-grey-1",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-e-[10px] bg-brand" />
                    )}
                    <Icon className="size-4 shrink-0" />
                    <span
                      className={cn(
                        "min-w-0",
                        isDisabled ? "truncate" : "whitespace-nowrap",
                      )}
                    >
                      {label}
                    </span>
                    {isDisabled && (
                      <span className="ml-auto shrink-0 rounded-full bg-grey-5 px-1.5 py-0.5 text-[10px] font-medium leading-none tracking-tight text-grey-1">
                        Скоро
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-4 mb-6 flex items-center justify-between gap-3 rounded-2xl bg-grey-5 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarImage
            id={profile.data?.avatar}
            name={profileName}
            className="size-[42px] rounded-lg text-base"
          />

          <div className="flex min-w-0 flex-col text-ink">
            <span className="truncate text-base font-medium leading-[1.3] tracking-tight" title={displayName}>
              {displayName}
            </span>

            {profile.data?.type_account === "ADMIN" && (
              <span className="text-xs leading-[1.3] tracking-tight text-ink-muted">
                Администратор
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Выйти"
          onClick={onLogout}
          className="shrink-0 text-brand"
        >
          <LogOut className="size-6" />
        </button>
      </div>
    </aside>
  );
}

/** Модалка подтверждения выхода из админпанели. */
function LogoutDialog({
  open,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex w-full max-w-[452px] flex-col gap-6 rounded-[24px] border-grey-4 bg-white px-10 py-8 shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-ink">
              Выйти из админ панели
            </DialogTitle>
            <DialogClose
              aria-label="Закрыть"
              className="text-ink transition-opacity hover:opacity-70"
            >
              <X className="size-4" />
            </DialogClose>
          </div>
          <DialogDescription className="text-base leading-[1.3] text-ink">
            Вы действительно хотите выйти?
            <br />
            Для повторного входа потребуется ввести номер телефон и единоразовый
            пароль.
          </DialogDescription>
        </div>
        <div className="flex gap-3">
          <DialogClose className="flex h-12 flex-1 items-center justify-center rounded-xl border border-ink/20 bg-white text-sm font-medium text-ink transition-colors hover:bg-grey-5">
            Отмена
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Выйти
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Оболочка экранов админки: фиксированный сайдбар + прокручиваемая область
 * контента. Используется как layout-роут — контент страниц рендерится через
 * `<Outlet/>`, поэтому сайдбар остаётся смонтированным между переходами и не
 * пересоздаётся. Навигация по меню и выход (с подтверждением в модалке) —
 * через роутер; подсветка активного пункта считается от текущего маршрута.
 */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { ready, canAccessRoute } = usePermissions();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const desktopMenu = useMediaQuery("(min-width: 1280px)");

  useEffect(() => {
    if (desktopMenu) setMenuOpen(false);
  }, [desktopMenu]);

  // Запоминаем последний открытый экран, чтобы вернуть на него после входа.
  useEffect(() => {
    saveLastRoute(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // Пункты меню, доступные по правам (разделы без видимых пунктов скрываем).
  const visibleSections = useMemo(
    () =>
      NAV.map((section) => ({
        ...section,
        items: section.items.filter((i) => !i.to || canAccessRoute(i.to)),
      })).filter((section) => section.items.length > 0),
    [canAccessRoute],
  );

  /** Первый доступный пункт меню — куда уводить с запрещённого маршрута. */
  const firstAccessible =
    visibleSections[0]?.items[0]?.to ?? ROUTES.complaints;

  /** Завершить сессию: очистить токены (и на сервере) и уйти на логин. */
  const handleLogout = async () => {
    setLogoutOpen(false);
    await logout();
    // Чистим кэш, чтобы следующий пользователь не увидел данные/права прошлого.
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  };

  // Пока грузятся права — сплэш, чтобы меню не мигало и не сработал ложный гард.
  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center bg-white">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  // Прямой заход на страницу без доступа — уводим на первую доступную.
  if (!canAccessRoute(location.pathname)) {
    return <Navigate to={firstAccessible} replace />;
  }

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden bg-grey-5">
      {/* На планшетах пространство сохраняется для контента. */}
      <div className="hidden xl:flex">
        <Sidebar
          sections={visibleSections}
          onLogout={() => setLogoutOpen(true)}
        />
      </div>

      {/* Планшет/уже: выезжающий drawer поверх контента */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          id="navigation-menu"
          showCloseButton={false}
          aria-describedby={undefined}
          className="left-0 top-0 h-dvh max-h-none w-[280px] max-w-[calc(100vw-24px)] translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 shadow-xl ring-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuButton.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Навигация</DialogTitle>
          <Sidebar
            sections={visibleSections}
            onLogout={() => {
              setMenuOpen(false);
              setLogoutOpen(true);
            }}
            onNavigate={() => setMenuOpen(false)}
            onClose={() => setMenuOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <LogoutDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Топбар с гамбургером — только на планшете/уже */}
        <header className="flex shrink-0 items-center gap-3 border-b border-grey-4 bg-white px-3 py-2 xl:hidden">
          <button
            type="button"
            aria-label="Открыть меню"
            ref={menuButton}
            aria-haspopup="dialog"
            aria-controls="navigation-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-grey-5"
          >
            <Menu className="size-6" />
          </button>
          <BrandLogo />
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
