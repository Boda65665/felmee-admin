/** Пути маршрутов приложения — единый источник, чтобы не хардкодить строки. */
export const ROUTES = {
  login: "/login",
  code: "/login/code",
  dashboard: "/dashboard",
  users: "/users",
  masters: "/masters",
  mastersModeration: "/masters/moderation",
  appointments: "/appointments",
  categories: "/categories",
  documents: "/documents",
  roles: "/roles",
  history: "/history",
  referral: "/referral",
  loyalty: "/loyalty",
  notifications: "/notifications",
  chats: "/chats",
  complaints: "/complaints",
  gmv: "/gmv",
  revenue: "/revenue",
  averageCheck: "/average-check",
  conversion: "/conversion",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
