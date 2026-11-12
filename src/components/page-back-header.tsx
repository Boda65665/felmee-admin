import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * Шапка вложенного экрана: кнопка «назад» (по умолчанию — history.back) и
 * заголовок. Используется на экранах-деталях (GMV/Выручка/Средний чек/
 * Конверсия) и в очереди модерации.
 */
export const PageBackHeader = ({
  title,
  onBack,
  className,
}: {
  title: string;
  /** Переопределить действие «назад»; по умолчанию — переход на шаг назад. */
  onBack?: () => void;
  className?: string;
}) => {
  const navigate = useNavigate();

  return (
    <div className={cn("mb-2 flex items-center gap-3", className)}>
      <button
        type="button"
        aria-label="Назад"
        onClick={() => (onBack ? onBack() : navigate(-1))}
        className="text-ink transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="size-5" />
      </button>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
    </div>
  );
};
