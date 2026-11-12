import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useClientChats,
  type AdminClientChatMessage,
} from "@/lib/api";
import { clientsKeys, getClientChatMessages } from "@/lib/api/clients";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

/* ------------------------------------------------------------------ утилиты */

/**
 * Дата из строки backend. Основной формат — «yyyy:MM:dd:HH:mm[:ss]» (через
 * двоеточие), запасной — ISO. `null`, если распарсить не удалось.
 */
const parseBackendDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (parts.length >= 5 && parts.every((n) => Number.isFinite(n))) {
    const [y, mo, d, h, mi, s = 0] = parts;
    const date = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = parseISO(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
};

/** Время сообщения → «HH:mm», иначе как есть. */
const formatTime = (value: string | null | undefined) => {
  const date = parseBackendDate(value);
  return date ? format(date, "HH:mm") : (value ?? "");
};

/* --------------------------------------------------------------------- части */

/**
 * Пузырь сообщения: исходящий (справа, брендовый) — от самого клиента;
 * входящий (слева, белый с обводкой + аватар собеседника) — от мастера/салона.
 */
function Bubble({
  message,
  outgoing,
  partnerName,
}: {
  message: AdminClientChatMessage;
  outgoing: boolean;
  partnerName: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        outgoing ? "justify-end" : "justify-start",
      )}
    >
      {!outgoing && (
        <Avatar name={partnerName} className="mt-1 size-9 text-xs" />
      )}
      <div
        className={cn(
          "flex min-w-0 max-w-[452px] items-end gap-3 rounded-2xl px-3 py-3 sm:px-4",
          outgoing
            ? "rounded-tr-[4px] bg-brand text-white"
            : "rounded-tl-[4px] border border-grey-4 bg-white text-ink",
        )}
      >
        <span className="min-w-0 text-sm font-medium leading-snug whitespace-pre-wrap wrap-anywhere">
          {message.text || "Вложение"}
        </span>
        <span
          className={cn(
            "shrink-0 self-end text-[11px] leading-none",
            outgoing ? "text-white/70" : "text-ink-muted",
          )}
        >
          {formatTime(message.at_create)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- модалка */

/**
 * Модалка «Чат» — открывается по кнопке чата в строке пользователя. Показывает
 * личные переписки клиента с мастерами/салонами: вкладки переключают диалоги
 * (`GET …/clients/{clientId}/chats`), ниже — шапка собеседника и лента
 * сообщений выбранного диалога (`GET …/clients/chats/{dialogId}/messages`).
 * Свои сообщения клиента — справа (брендовые), собеседника — слева.
 */
export function ChatViewDialog({
  open,
  onOpenChange,
  clientId,
  initialDialogId,
  restrictToDialog = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number | null;
  /** Открыть сразу на этом диалоге (напр. из карточки жалобы по `dialog_id`). */
  initialDialogId?: number | null;
  /** Complaint viewers must never fall back to another conversation. */
  restrictToDialog?: boolean;
}) {
  const [activeDialogId, setActiveDialogId] = useState<number | null>(null);

  // Режим одного диалога: открыли конкретный чат (напр. из карточки жалобы по
  // `dialog_id`). Тогда список чатов клиента не нужен — показываем ровно этот
  // диалог, а собеседника берём из участников переписки.
  const singleMode = restrictToDialog || initialDialogId != null;

  const chatsQuery = useClientChats(open && !singleMode ? clientId : null);
  const chats = useMemo(() => chatsQuery.data?.items ?? [], [chatsQuery.data]);

  // При открытии выбираем диалог: явно заданный (`initialDialogId`) или первый
  // из списка. Если `initialDialogId` есть, ждать список не нужно.
  useEffect(() => {
    if (!open) {
      setActiveDialogId(null);
      return;
    }
    if (activeDialogId != null) return;
    if (initialDialogId != null) setActiveDialogId(initialDialogId);
    else if (chats.length > 0) setActiveDialogId(chats[0].dialog_id);
  }, [open, chats, activeDialogId, initialDialogId]);

  const historyQuery = useInfiniteQuery({
    queryKey: [...clientsKeys.chatMessages(activeDialogId ?? 0), "history"],
    enabled: open && activeDialogId != null,
    initialPageParam: {} as { beforeId?: number; offset?: number },
    queryFn: ({ pageParam }) => getClientChatMessages(activeDialogId as number, { ...pageParam, limit: 50 }),
    getNextPageParam: (page, pages) => {
      if (!page.has_more || page.messages.length === 0) return undefined;
      return page.next_before_id != null
        ? { beforeId: page.next_before_id }
        : { offset: pages.reduce((total, item) => total + item.messages.length, 0) };
    },
  });
  const history = historyQuery.data?.pages[0];

  // Сообщения — по возрастанию id (старые сверху, новые снизу).
  const messages = useMemo(() => {
    const items = historyQuery.data?.pages.flatMap(page => page.messages) ?? [];
    return [...new Map(items.map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id);
  }, [historyQuery.data]);

  const clientOwnId = history?.client.id;

  // Имя собеседника: из вкладки списка чатов, иначе — из участников переписки
  // (любой `from`/`to`, чей id не равен клиенту).
  const partnerName = useMemo(() => {
    const fromList = chats.find(
      (c) => c.dialog_id === activeDialogId,
    )?.display_name;
    if (fromList) return fromList;
    for (const m of history?.messages ?? []) {
      const other =
        m.from && m.from.id !== clientOwnId
          ? m.from
          : m.to && m.to.id !== clientOwnId
            ? m.to
            : null;
      if (other?.display_name) return other.display_name;
    }
    return "Собеседник";
  }, [chats, activeDialogId, history, clientOwnId]);

  // Лента сообщений + шапка собеседника — общая часть для обоих режимов.
  const conversation = (
    <>
      {/* Шапка собеседника */}
      <div className="flex items-center gap-4 rounded-2xl border border-black/10 px-4 py-3">
        <Avatar name={partnerName} className="size-12" />
        <span className="text-base font-semibold leading-tight text-ink">
          {partnerName}
        </span>
      </div>

      {historyQuery.isLoading ? (
        <p className="py-8 text-center text-base text-ink-muted">
          Загрузка переписки…
        </p>
      ) : historyQuery.isError ? (
        <span className="text-sm text-ink-muted">Данные не загружены.</span>
      ) : messages.length === 0 ? (
        <p className="py-8 text-center text-base text-ink-muted">
          В этом чате пока нет сообщений.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {historyQuery.hasNextPage && (
            <button type="button" onClick={() => historyQuery.fetchNextPage()} disabled={historyQuery.isFetchingNextPage} className="min-h-11 self-center rounded-xl border border-grey-4 px-4 py-2 text-sm text-brand disabled:opacity-50">
              {historyQuery.isFetchingNextPage ? "Загрузка…" : "Загрузить предыдущие сообщения"}
            </button>
          )}
          {historyQuery.isFetchNextPageError && <span className="text-sm text-ink-muted">Данные не загружены.</span>}
          {messages.map((message) => (
            <Bubble
              key={message.id}
              message={message}
              outgoing={message.from?.id === clientOwnId}
              partnerName={partnerName}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[720px] flex-col gap-6 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        {/* Шапка */}
        <div className="flex w-full items-start justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
            Чат
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="h-px w-full shrink-0 bg-grey-2" />

        {singleMode && initialDialogId == null ? (
          <p className="py-8 text-center text-base text-ink-muted">
            Переписка между участниками жалобы не найдена.
          </p>
        ) : singleMode ? (
          conversation
        ) : chatsQuery.isLoading ? (
          <p className="py-8 text-center text-base text-ink-muted">
            Загрузка чатов…
          </p>
        ) : chatsQuery.isError ? (
          <span className="text-sm text-ink-muted">Данные не загружены.</span>
        ) : chats.length === 0 ? (
          <p className="py-8 text-center text-base text-ink-muted">
            У пользователя пока нет чатов.
          </p>
        ) : (
          <>
            {/* Вкладки чатов */}
            <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-white p-1">
              {chats.map((chat) => (
                <button
                  key={chat.dialog_id}
                  type="button"
                  onClick={() => setActiveDialogId(chat.dialog_id)}
                  className={cn(
                    "cursor-pointer rounded-[10px] px-6 py-2 text-base font-medium tracking-tight transition-colors",
                    chat.dialog_id === activeDialogId
                      ? "bg-black/5 text-ink"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {chat.display_name}
                </button>
              ))}
            </div>

            {conversation}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
