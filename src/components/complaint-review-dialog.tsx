import { Star, X } from "lucide-react";

import { AvatarImage } from "@/components/avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ProfileName, type ProfileTarget } from "./profile-name";

export type ReviewData = {
  authorAvatar?: number | null;
  masterAvatar?: number | null;
  salonAvatar?: number | null;
  authorProfile?: ProfileTarget;
  masterProfile?: ProfileTarget;
  salonProfile?: ProfileTarget;
  author: string;
  when: string;
  service: string;
  price: string;
  date: string;
  master: string;
  salon: string;
  rating: number;
  ratingLabel: string;
  liked: string;
  disliked: string;
  comment: string;
  tags: string[];
};

/** Теги отзыва (`ReviewTag`) → русские подписи для блока «что особенно понравилось». */
const REVIEW_TAG_LABELS: Record<string, string> = {
  CLEANLINESS: "Чистота",
  FRIENDLINESS: "Дружелюбие",
  PROFESSIONALISM: "Профессионализм",
  ATMOSPHERE: "Атмосфера",
  PUNCTUALITY: "Пунктуальность",
  COMMUNICATION: "Общение",
};

/** Ряд из 5 звёзд с закрашенными по рейтингу. */
function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-5",
            i < value ? "fill-brand text-brand" : "fill-grey-3 text-grey-3",
          )}
        />
      ))}
    </div>
  );
}

/** Мелкий блок «подпись: имя» с аватаром-инициалами. */
function Party({ label, name, avatarId, target, onOpen }: { label: string; name: string; avatarId?: number | null; target?: ProfileTarget; onOpen?: (target: ProfileTarget) => void }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-ink">
      <AvatarImage id={avatarId} name={name} className="size-5 text-[9px]" />
      {label}: <ProfileName target={target} onOpen={onOpen}>{name}</ProfileName>
    </span>
  );
}

/** Презентационная карточка отзыва — используется в модалках жалоб на отзыв. */
export function ReviewCard({ review, onOpenProfile }: { review: ReviewData; onOpenProfile?: (target: ProfileTarget) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AvatarImage id={review.authorAvatar} name={review.author} className="size-11 rounded-full" />
        <div className="flex min-w-0 flex-col break-words">
          <span className="text-base font-semibold text-ink"><ProfileName target={review.authorProfile} onOpen={onOpenProfile}>{review.author}</ProfileName></span>
          <span className="text-xs text-ink-muted">{review.when}</span>
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        {review.service} {review.price} · {review.date}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Party label="Мастер" name={review.master} avatarId={review.masterAvatar} target={review.masterProfile} onOpen={onOpenProfile} />
        <Party label="Салон" name={review.salon} avatarId={review.salonAvatar} target={review.salonProfile} onOpen={onOpenProfile} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-ink">Отзыв:</span>
        <span className="text-sm text-ink-muted">Оценка</span>
        <div className="flex flex-wrap items-center gap-3">
          <Stars value={review.rating} />
          <span className="text-sm text-ink-muted">{review.ratingLabel}</span>
        </div>
      </div>

      <Section title="Что понравилось?" text={review.liked} />
      <Section title="Что не понравилось?" text={review.disliked} />
      <Section title="Комментарий" text={review.comment} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Что особенно понравилось?</span>
        <div className="flex flex-wrap gap-2">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-grey-3 px-3 py-1.5 text-sm text-ink"
            >
              {REVIEW_TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{title}</span>
      <span className="text-sm text-ink-muted">{text}</span>
    </div>
  );
}

/** Модалка «Жалоба на отзыв» — карточка отзыва целиком. */
export function ComplaintReviewDialog({
  open,
  onOpenChange,
  review,
  onOpenProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: ReviewData | null;
  onOpenProfile?: (target: ProfileTarget) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[540px] flex-col gap-5 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-8 sm:py-7 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
            Жалоба на отзыв
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>
        <div className="h-px w-full bg-grey-2" />
        {review && <ReviewCard review={review} onOpenProfile={onOpenProfile} />}
      </DialogContent>
    </Dialog>
  );
}
