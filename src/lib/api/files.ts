import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError, api, refreshTokens, unwrap, type Envelope } from "./client";
import { useAuthStore } from "@/lib/auth/auth-store";
import type { components } from "./schema";

/** Назначение файла (AVATAR/VOICE/MESSAGE/CARD/CATEGORY/BLOG). */
export type FilePurpose = components["schemas"]["FilePurpose"];

/** Статус файла + временная ссылка (`url` только при `UPLOADED`). */
export type FileStatusData = components["schemas"]["FileStatusData"];

/** Ключи запросов TanStack Query для файлов. */
export const filesKeys = {
  all: ["files"] as const,
  status: (id: number) => [...filesKeys.all, "status", id] as const,
};

/**
 * Загрузить файл (multipart `file` + `metadata`).
 * `POST /api/file/upload`. Возвращает числовой id файла.
 *
 * ВАЖНО: upload отдаёт `data.file_id` строкой («object key»), а `file_ids` в
 * отправке сообщения и `GET /file/{id}` ожидают int64. Работаем по допущению,
 * что строка — это int64, сериализованный строкой: парсим в число. Если строка
 * непарсится (реальный object-key) — падаем осознанно `ApiError`.
 */
export const uploadFile = async (
  file: File,
  purpose: FilePurpose,
): Promise<number> => {
  const res = await api.POST("/api/file/upload", {
    // Тело реально формируется в bodySerializer (multipart); значение здесь —
    // формальность для типов openapi-fetch.
    body: { file: file as unknown as string, metadata: { purpose } },
    bodySerializer() {
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "metadata",
        new Blob([JSON.stringify({ purpose })], { type: "application/json" }),
      );
      return fd;
    },
  });
  const data = unwrap(res)!;
  const id = Number(data.file_id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(
      null,
      "Файл загружен, но получить числовой id не удалось",
      res.response.status,
    );
  }
  return id;
};

/**
 * Статус файла и временная ссылка по id.
 * `GET /api/file/{id}` (`type` — FULL/PREVIEW).
 */
export const getFileStatus = async (
  id: number,
  type?: "FULL" | "PREVIEW",
): Promise<FileStatusData> => {
  const res = await api.GET("/api/file/{id}", {
    params: { path: { id }, query: type ? { type } : {} },
  });
  return unwrap(res)!;
};

/** API download URLs need JWT; signed storage URLs can be embedded directly. */
export function isProtectedFileUrl(url: string): boolean {
  return new URL(url, "http://local.invalid").pathname.startsWith("/api/file/download/");
}

async function requestDocument(id: number, inline: boolean, signal?: AbortSignal): Promise<Response> {
  const query = inline ? "type=FULL&inline=true&redirect=false" : "type=FULL";
  const request = () => fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/file/download/${id}?${query}`, {
    headers: { Authorization: `Bearer ${useAuthStore.getState().jwt ?? ""}` },
    signal,
  });
  let response = await request();
  if (response.status === 401 && await refreshTokens()) response = await request();
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(error?.error_code ?? error?.codeError ?? null, error?.message ?? "Не удалось загрузить файл", response.status);
  }
  return response;
}

/** Fetch protected original bytes for downloading, without requesting inline. */
export async function getDocumentBlob(id: number, signal?: AbortSignal): Promise<Blob> {
  return (await requestDocument(id, false, signal)).blob();
}

type InlineDocument = { kind: "url"; url: string } | { kind: "blob"; blob: Blob };

/** Inline may return a signed URL as JSON or decrypted bytes, depending on purpose. */
export async function getInlineDocument(id: number, signal?: AbortSignal): Promise<InlineDocument> {
  const response = await requestDocument(id, true, signal);
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const body = await response.json() as Envelope<FileStatusData>;
    if (!body.success || !body.data?.url) {
      throw new ApiError(body.error_code ?? body.codeError, body.message ?? "Не удалось открыть файл", response.status);
    }
    return { kind: "url", url: body.data.url };
  }
  return { kind: "blob", blob: await response.blob() };
}

/** Inline links render photos/PDF; decrypted bytes use a short-lived local URL. */
export function useDocumentFile(id: number) {
  const metadata = useFileUrl(id, "FULL");
  const download = useQuery({
    queryKey: [...filesKeys.status(id), "document-inline"],
    queryFn: ({ signal }) => getInlineDocument(id, signal),
    enabled: metadata.data?.status === "UPLOADED",
    retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
  });
  const [object, setObject] = useState<{ blob: Blob; url: string } | null>(null);
  const blob = download.data?.kind === "blob" ? download.data.blob : undefined;
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setObject({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const url = download.data?.kind === "url" ? download.data.url : object?.blob === blob ? object?.url ?? null : null;
  return {
    data: metadata.data ? { ...metadata.data, url } : undefined,
    isError: metadata.isError || download.isError,
    refetch: async () => {
      const status = await metadata.refetch();
      if (status.data?.status === "UPLOADED") await download.refetch();
    },
  };
}

/* ------------------------------------------------- хуки React Query */

/** Загрузка файла. */
export const useUploadFile = () =>
  useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose: FilePurpose }) =>
      uploadFile(file, purpose),
  });

/**
 * Временная ссылка на файл по id. Пока файл в обработке (`PENDING`) — опрашивает
 * каждые 2 с. Запрос не идёт, пока `id` не задан.
 */
export const useFileUrl = (id: number | null, type?: "FULL" | "PREVIEW") =>
  useQuery({
    queryKey: [...filesKeys.status(id ?? 0), type ?? "FULL"],
    queryFn: () => getFileStatus(id as number, type),
    enabled: id != null,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" ? 2000 : false,
  });
