import { Calendar, ChevronDown, Clock, MapPin, Star, X } from "lucide-react";

import { AvatarImage } from "@/components/avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfilePhoto } from "./profile-form";
import { ProfileName, type ProfileTarget } from "./profile-name";

export type ServiceData = {
  providerAvatar?: number | null;
  providerProfile?: ProfileTarget;
  /** id файлов фото услуги (int64) — ссылки тянутся через `ProfilePhoto`. */
  imageIds: number[];
  priceFrom: string;
  title: string;
  rating: number;
  reviews: number;
  duration: string;
  description: string;
  place: string;
  placeKind: string;
  placeRating: number;
  placeReviews: number;
  address: string;
  hours: string;
  advantages: string[];
};

/**
 * Презентационная карточка услуги: фото, цена, название, рейтинг и длительность,
 * описание, место приёма и преимущества. Используется в модалке «Жалоба на
 * услугу» и в общем разборе `ComplaintCaseDialog`.
 */
export function ServiceCard({ service, onOpenProfile }: { service: ServiceData; onOpenProfile?: (target: ProfileTarget) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {service.imageIds.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-muted">Фото услуги</span>
          <div className="grid grid-cols-3 gap-2">
            {service.imageIds.map((id, i) => (
              <ProfilePhoto
                key={`${id}-${i}`}
                id={id}
                className="aspect-square w-full rounded-2xl"
              />
            ))}
          </div>
        </div>
      )}

      <span className="text-2xl font-semibold text-ink">{service.priceFrom}</span>

      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-ink">{service.title}</span>
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink">
          <span className="flex items-center gap-1">
            <Star className="size-4 fill-ink text-ink" />
            {service.rating} ({service.reviews})
          </span>
          <span className="flex items-center gap-1 text-ink-muted">
            <Clock className="size-4" />
            Длительность: {service.duration}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm leading-relaxed text-ink-muted">
          {service.description}
        </p>
        <button type="button" className="w-fit text-sm font-medium text-ink">
          Читать всё
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-base font-semibold text-ink">Место приема</span>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AvatarImage id={service.providerAvatar} name={service.place} className="size-9 rounded-lg text-xs" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-ink"><ProfileName target={service.providerProfile} onOpen={onOpenProfile}>{service.place}</ProfileName></span>
              <span className="text-xs text-ink-muted">{service.placeKind}</span>
            </div>
          </div>
          <span className="flex items-center gap-1 text-sm text-ink">
            <Star className="size-4 fill-ink text-ink" />
            {service.placeRating} ({service.placeReviews})
          </span>
        </div>
        <button
          type="button"
          className="flex items-center justify-between text-sm text-ink-muted"
        >
          <span className="flex items-center gap-2">
            <MapPin className="size-4" />
            {service.address}
          </span>
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          className="flex items-center justify-between text-sm text-ink-muted"
        >
          <span className="flex items-center gap-2">
            <Calendar className="size-4" />
            {service.hours}
          </span>
          <ChevronDown className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-ink">Преимущества</span>
        <ul className="flex flex-col gap-1.5">
          {service.advantages.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-ink-muted">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-muted" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Модалка «Жалоба на услугу» — карточка услуги целиком. Презентационная.
 */
export function ComplaintServiceDialog({
  open,
  onOpenChange,
  service,
  onOpenProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceData | null;
  onOpenProfile?: (target: ProfileTarget) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[500px] flex-col gap-5 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-8 sm:py-7 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
            Жалоба на услугу
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>
        <div className="h-px w-full bg-grey-2" />

        {service && <ServiceCard service={service} onOpenProfile={onOpenProfile} />}
      </DialogContent>
    </Dialog>
  );
}
