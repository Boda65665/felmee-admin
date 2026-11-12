import { Navigate, Route, Routes } from "react-router-dom";

import { ROUTES } from "@/lib/routes";
import { AppShell, AuthLayout } from "@/components";
import { ProtectedRoute, PublicOnlyRoute } from "@/lib/auth";
import {
  GmvPage,
  LoginPage,
  RolesPage,
  UsersPage,
  ChatsPage,
  HistoryPage,
  MastersPage,
  RevenuePage,
  LoyaltyPage,
  ComplaintsPage,
  CodeLoginPage,
  DashboardPage,
  ConversionPage,
  CategoriesPage,
  DocumentsPage,
  AverageCheckPage,
  AppointmentsPage,
  NotificationsPage,
  ReferralProgramPage,
  MastersModerationPage,
} from "@/pages";

function App() {
  return (
    <Routes>
      {/* Публичные экраны авторизации — общая оболочка (баннер не пересоздаётся).
          С активной сессией сразу уводим внутрь приложения. */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.code} element={<CodeLoginPage />} />
        </Route>
      </Route>

      {/* Оболочка админки — единый layout: сайдбар монтируется один раз и
          не пересоздаётся между переходами (контент идёт через <Outlet/>). */}
      <Route element={<AppShell />}>
        {/* Все экраны админки под защитой: без токена — редирект на /login */}
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.gmv} element={<GmvPage />} />
          <Route path={ROUTES.users} element={<UsersPage />} />
          <Route path={ROUTES.roles} element={<RolesPage />} />
          <Route path={ROUTES.chats} element={<ChatsPage />} />
          <Route path={ROUTES.loyalty} element={<LoyaltyPage />} />
          <Route path={ROUTES.history} element={<HistoryPage />} />
          <Route path={ROUTES.revenue} element={<RevenuePage />} />
          <Route path={ROUTES.masters} element={<MastersPage />} />
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.conversion} element={<ConversionPage />} />
          <Route path={ROUTES.categories} element={<CategoriesPage />} />
          <Route path={ROUTES.documents} element={<DocumentsPage />} />
          <Route path={ROUTES.complaints} element={<ComplaintsPage />} />
          <Route path={ROUTES.referral} element={<ReferralProgramPage />} />
          <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
          <Route path={ROUTES.averageCheck} element={<AverageCheckPage />} />
          <Route path={ROUTES.notifications} element={<NotificationsPage />} />
          <Route
            path={ROUTES.mastersModeration}
            element={<MastersModerationPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
    </Routes>
  );
}

export default App;
