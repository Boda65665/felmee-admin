import type { ServiceCategory, ServiceLocation, ServiceProvider } from "@/lib/api/services";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export const serviceMoney = (value: number | null | undefined) => value == null ? "—" : money.format(value);
export const providerNames: Record<ServiceProvider, string> = { MASTER: "Мастер", SALON: "Салон" };
export const locationNames: Record<ServiceLocation["service_location"], string> = {
  IN_SALON: "В салоне",
  AT_MASTER_PLACE: "У мастера",
  CLIENT_PLACE: "У клиента",
};

export function serviceCategoryLabel(category: ServiceCategory, categories: ServiceCategory[] = []): string {
  const parent = categories.find(({ id }) => id === category.parent_id);
  const label = category.name || `#${category.id}`;
  return parent ? `${parent.name || `#${parent.id}`} / ${label}` : label;
}
