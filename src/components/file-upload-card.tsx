import {
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type FileKind = "pdf" | "doc" | "xls" | "ppt" | "img" | "other";

/** Статус загрузки файла — определяет подпись и заполнение прогресс-бара. */
export type UploadStatus =
  | { kind: "uploading"; percent: number }
  | { kind: "checking" }
  | { kind: "done" }
  | { kind: "error" };

const KIND: Record<
  FileKind,
  { ext: string; icon: ComponentType<{ className?: string }>; color: string }
> = {
  pdf: { ext: "PDF", icon: FileText, color: "text-danger" },
  doc: { ext: "DOC", icon: FileText, color: "text-[#2b7cd3]" },
  xls: { ext: "XLS", icon: FileSpreadsheet, color: "text-success" },
  ppt: { ext: "PPT", icon: Presentation, color: "text-warning" },
  img: { ext: "JPG", icon: ImageIcon, color: "text-ink-muted" },
  other: { ext: "XXX", icon: File, color: "text-ink-muted" },
};

/** Подпись статуса и доля заполнения прогресс-бара (0..1). */
function statusView(status: UploadStatus): {
  label: string;
  fill: number;
  danger?: boolean;
} {
  switch (status.kind) {
    case "uploading":
      return { label: `загрузка ${status.percent}%`, fill: status.percent / 100 };
    case "checking":
      return { label: "проверка файла…", fill: 0.6 };
    case "done":
      return { label: "файл загружен", fill: 1 };
    case "error":
      return { label: "Ошибка", fill: 0.4, danger: true };
  }
}

/**
 * Карточка файла в чате: цветная иконка по типу, имя, метаданные
 * (расширение · размер · статус) и прогресс-бар. Статусы: загрузка N%,
 * проверка файла, файл загружен, ошибка. `onRemove` — крестик справа.
 */
export function FileUploadCard({
  name,
  size,
  kind,
  status,
  onRemove,
}: {
  name: string;
  /** Размер, отформатированный для показа (напр. «2,5 MB»). */
  size: string;
  kind: FileKind;
  status: UploadStatus;
  onRemove?: () => void;
}) {
  const meta = KIND[kind];
  const Icon = meta.icon;
  const { label, fill, danger } = statusView(status);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-grey-4 bg-white px-3 py-2.5">
      <Icon className={cn("size-7 shrink-0", meta.color)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-ink">{name}</span>
        </div>
        <span className="text-xs text-ink-muted">
          {meta.ext} {size}{" "}
          <span className={cn("ml-1", danger ? "text-danger underline" : "text-ink-muted")}>
            {label}
          </span>
        </span>
        <Progress
          value={Math.round(fill * 100)}
          indicatorClassName={danger ? "bg-danger" : undefined}
        />
      </div>
      {onRemove && (
        <button
          type="button"
          aria-label="Удалить файл"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-grey-5 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
