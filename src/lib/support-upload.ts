import { getFileStatus } from "@/lib/api/files";

/** Сообщения принимают только полностью обработанные файлы с purpose MESSAGE. */
export async function waitForMessageFile(id: number): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const file = await getFileStatus(id, "FULL");
    if (file.status === "UPLOADED") return;
    if (file.status === "FAILED") throw new Error("Не удалось обработать файл");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Файл ещё обрабатывается. Попробуйте загрузить его позже.");
}
