import { useState } from "react";

import { useFileUrl } from "@/lib/api/files";

/** Вложения поддержки получают временную ссылку по реальному ID файла. */
export function SupportAttachment({
  file,
  kind,
}: {
  file: { id: number; file_name: string };
  kind: "document" | "audio" | "video";
}) {
  const { data, isError, refetch } = useFileUrl(file.id, "FULL");
  const [mediaError, setMediaError] = useState(false);
  const name = file.file_name || `Файл #${file.id}`;
  const failed = isError || data?.status === "FAILED" || mediaError;

  return (
    <div className="flex min-w-0 flex-col gap-2 px-3 py-2 text-sm">
      <span className="break-all">{name}</span>
      {failed ? (
        <button
          type="button"
          className="text-left underline"
          onClick={() => { setMediaError(false); void refetch(); }}
        >
          Не удалось загрузить файл. Повторить
        </button>
      ) : !data?.url ? (
        <span role="status" className="opacity-70">Загрузка файла…</span>
      ) : (
        <>
          {kind === "audio" && (
            <audio controls preload="none" src={data.url} onError={() => setMediaError(true)} className="max-w-full" />
          )}
          {kind === "video" && (
            <video controls preload="metadata" src={data.url} onError={() => setMediaError(true)} className="max-h-80 max-w-full" />
          )}
          <a href={data.url} target="_blank" rel="noreferrer" className="w-fit underline">
            {kind === "document" ? "Открыть / скачать файл" : "Скачать файл"}
          </a>
        </>
      )}
    </div>
  );
}
