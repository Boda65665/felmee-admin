import { useEffect, useState } from "react";

import { useFileUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Инициалы из имени: «Екатерина Морозова» → «ЕМ» (небуквенные символы отброшены). */
export function initials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/[^\p{L}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Круглый аватар-заглушка с инициалами имени (сиреневый фон, брендовый текст). */
export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#f6efff] font-semibold tracking-tight text-brand",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

/**
 * Аватар по int64-id файла: тянет превью-ссылку через `useFileUrl(id, "PREVIEW")`
 * и показывает `<img>`. Если id нет, файл ещё не готов, ссылка не пришла или
 * картинка не загрузилась — откатывается на кружок с инициалами (`Avatar`).
 * Форму/размер задаёт `className` (как у `Avatar`); по умолчанию — круг.
 */
export function AvatarImage({
  id,
  name,
  className,
}: {
  id: number | null | undefined;
  name: string | null | undefined;
  className?: string;
}) {
  const { data, isError } = useFileUrl(id ?? null, "PREVIEW");
  const [imgError, setImgError] = useState(false);
  const url = data?.url ?? null;

  // Сбрасываем флаг ошибки img при смене ссылки (переиспользование в списках).
  useEffect(() => {
    setImgError(false);
  }, [url]);

  if (id == null || isError || imgError || !url) {
    return <Avatar name={name} className={className} />;
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setImgError(true)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}
