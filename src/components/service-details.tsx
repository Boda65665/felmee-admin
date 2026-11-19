import { Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StatusPill } from "@/components/status-pill";
import { useFileUrl } from "@/lib/api/files";
import { cn } from "@/lib/utils";
import { useService, type AdminService, type ServiceStatus } from "@/lib/api/services";
import { locationNames, providerNames, serviceMoney } from "@/lib/service-display";

export function ServiceStatusPill({ status }: { status: ServiceStatus }) {
  return status === "ACTIVE"
    ? <StatusPill label="Активна" cls="bg-success-bg text-success-fg" />
    : <StatusPill label="Ожидает удаления" cls="bg-warning-bg text-warning" />;
}

export function ServicePhoto({ id, className }: { id?: number | null; className?: string }) {
  const { data } = useFileUrl(id ?? null, "PREVIEW");
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = data?.url;
  const frame = cn("size-24 shrink-0 rounded-xl", className);

  if (!url || url === failedUrl) {
    return <span aria-hidden="true" className={cn(frame, "flex items-center justify-center bg-grey-5 text-ink-muted")}>
      <ImageIcon className="size-5" />
    </span>;
  }

  return <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)}
    className={cn(frame, "object-cover")} />;
}

export function DeferredServicePhoto({ serviceId, className }: { serviceId: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const service = useService(visible ? serviceId : null);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "160px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  const fileId = service.data?.images?.[0];
  return (
    <span ref={ref} className="block shrink-0">
      <ServicePhoto key={fileId} id={fileId} className={className} />
    </span>
  );
}

export function ServiceCard({ service }: { service: AdminService }) {
  const provider = service.provider_name || (service.provider_id == null ? null : `#${service.provider_id}`);
  const providerLabel = [service.provider_type && providerNames[service.provider_type], provider].filter(Boolean).join(" · ");
  const fields = [
    ["Исполнитель", providerLabel || "—"],
    ["Категория", service.category_name || "—"],
    ["Цена", `${service.is_fix_price === false && service.price != null ? "от " : ""}${serviceMoney(service.price)}`],
    ["Длительность", service.duration == null ? "—" : `${service.duration} мин.`],
    ["Скидка", service.discount_percent == null ? "—" : `${service.discount_percent}%`],
    ["Оценка и отзывы", `${service.rating ?? "—"} · ${service.reviews_count ?? 0} отзывов`],
  ];

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="break-words text-lg font-semibold">{service.name || `Услуга #${service.id}`}</h3>
        <ServiceStatusPill status={service.status} />
      </div>
      {service.status === "PENDING_DELETION" && (
        <p className="rounded-xl bg-warning-bg p-3 text-warning">
          Услуга скрыта и будет удалена после завершения связанных записей.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {service.description && <p className="whitespace-pre-wrap break-words">{service.description}</p>}
      {!!service.price_intervals?.length && (
        <div>
          <h4 className="mb-1 font-medium">Цена по времени</h4>
          <ul className="space-y-1 text-ink-muted">
            {service.price_intervals.map((interval) => (
              <li key={interval.start_time}>{interval.start_time.slice(0, 5)}–{interval.end_time.slice(0, 5)} · {serviceMoney(interval.price)}</li>
            ))}
          </ul>
        </div>
      )}
      {service.address && <p className="break-words"><span className="font-medium">Адрес</span> {service.address}</p>}
      {!!service.service_locations?.length && (
        <ul className="space-y-1">
          {service.service_locations.map((location) => (
            <li key={location.service_location} className="break-words">
              <strong className="font-medium">{locationNames[location.service_location]}</strong>
              {location.salon_name && ` · ${location.salon_name}`}
              {location.address && ` · ${location.address}`}
              {location.radius_km && ` · ${location.radius_km} км`}
            </li>
          ))}
        </ul>
      )}
      {!!service.advantages?.length && (
        <p className="break-words"><span className="font-medium">Преимущества</span> {service.advantages.join(" · ")}</p>
      )}
      {!!service.seo_queries?.length && (
        <p className="break-words"><span className="font-medium">Поисковые фразы</span> {service.seo_queries.join(" · ")}</p>
      )}
      {!!service.images?.length && (
        <div className="flex flex-wrap gap-2">
          {service.images.map((id) => <ServicePhoto key={id} id={id} />)}
        </div>
      )}
    </div>
  );
}
