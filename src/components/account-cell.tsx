import { AvatarImage } from "./avatar";

/**
 * Ячейка «аккаунт» в таблицах: аватар + имя-ссылка + подпись под именем
 * (телефон, «город · услуги» и т.п.). Общая для списков пользователей,
 * мастеров/салонов и очереди модерации.
 */
export const AccountCell = ({
  name,
  subtitle,
  subtitleClassName = "text-base text-ink/60",
  onNameClick,
  avatarId,
}: {
  name: string;
  subtitle: string;
  /** Классы подписи под именем (по умолчанию — крупный приглушённый текст). */
  subtitleClassName?: string;
  /** Если задан — имя становится кнопкой (напр. открыть карточку/правку). */
  onNameClick?: () => void;
  /** int64-id файла аватара; без него — кружок с инициалами. */
  avatarId?: number | null;
}) => {
  const nameClassName =
    "w-fit max-w-full text-left font-semibold text-brand underline underline-offset-2";
  return (
    <div className="flex min-w-0 items-center gap-3 md:gap-4">
      <AvatarImage id={avatarId} name={name} className="size-11 text-base md:size-14 md:text-lg" />
      <div className="flex min-w-0 flex-col gap-1 break-words">
        {onNameClick ? (
          <button type="button" title={name} onClick={onNameClick} className={nameClassName}>
            {name}
          </button>
        ) : (
          <a href="#" title={name} className={nameClassName}>
            {name}
          </a>
        )}
        <span title={subtitle} className={subtitleClassName}>{subtitle}</span>
      </div>
    </div>
  );
};
