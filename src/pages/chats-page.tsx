import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { useInfiniteSupportChats } from "@/lib/api/infinite-lists";
import {
  ArrowDown,
  Check,
  CheckCheck,
  ChevronLeft,
  Paperclip,
  Send,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import {
  Avatar,
  Card,
  FileUploadCard,
  SearchInput,
  type FileKind,
  type UploadStatus,
} from "@/components";
import { useToast } from "@/components/ui";
import {
  ApiError,
  useFileUrl,
  useUploadFile,
  useReopenSupportChat,
  useCloseSupportChat,
  useMarkSupportRead,
  useSendSupportMessage,
  useSupportChat,

  useSupportMessages,
  type AdminSupportChat,
  type MessageResponse,
  type SupportCaseStatus,
} from "@/lib/api";
import { useLastReadId, useSupportRealtime } from "@/lib/ws";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/lib/use-persistent-state";
import { SupportAttachment } from "@/components/support-attachment";
import { waitForMessageFile } from "@/lib/support-upload";

/* ------------------------------------------------------------------ данные */

const PAGE_SIZE = 20;

type Tab = "all" | "open" | "closed" | "unread";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "open", label: "Открытые" },
  { value: "closed", label: "Закрытые" },
  { value: "unread", label: "Непрочитанные" },
];

/** Таб → серверные параметры (status/unread). */
const TAB_PARAMS: Record<Tab, { status?: SupportCaseStatus; unread?: boolean }> = {
  all: {},
  open: { status: "OPEN" },
  closed: { status: "CLOSED" },
  unread: { unread: true },
};

/** Имя клиента из обращения (фолбэк — телефон). */
const clientName = (chat: AdminSupportChat) =>
  [chat.client.first_name, chat.client.last_name].filter(Boolean).join(" ") ||
  chat.client.phone ||
  "Без имени";

/**
 * Дата из строки backend. Основной формат — «yyyy:MM:dd:HH:mm[:ss]» (всё через
 * двоеточие), запасной — ISO. Возвращает `null`, если распарсить не удалось.
 */
const parseBackendDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  // "2026:08:20:13:46" → [yyyy, MM, dd, HH, mm, (ss)]
  const parts = value.split(":").map(Number);
  if (parts.length >= 5 && parts.every((n) => Number.isFinite(n))) {
    const [y, mo, d, h, mi, s = 0] = parts;
    const date = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = parseISO(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
};

/** Время из строки backend → «HH:mm», иначе как есть. */
const formatTime = (value: string | null | undefined) => {
  const date = parseBackendDate(value);
  return date ? format(date, "HH:mm") : (value ?? "");
};

/** Ключ дня сообщения (для группировки по датам); null — если дата не распарсилась. */
const dayKey = (value: string | null | undefined) => {
  const date = parseBackendDate(value);
  return date ? format(date, "yyyy-MM-dd") : null;
};

/** Подпись даты-разделителя: «Сегодня» / «Вчера» / «8 августа 2026». */
const formatDay = (value: string) => {
  const date = parseBackendDate(value);
  if (!date) return "";
  if (isToday(date)) return "Сегодня";
  if (isYesterday(date)) return "Вчера";
  return format(date, "d MMMM yyyy", { locale: ru });
};

/** Превью последнего сообщения (текст или «Вложение»). */
const messagePreview = (message: MessageResponse | null | undefined) => {
  if (!message) return "—";
  return message.text || "Вложение";
};

/** Тип файла для иконки карточки загрузки. */
const fileKind = (file: File): FileKind => {
  const type = file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return "img";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xls";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  return "other";
};

/** Размер файла, отформатированный для показа. */
const formatSize = (bytes: number) => {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
};

/** Вложение в поле ввода: локальный статус загрузки + числовой id при успехе. */
type Attachment = {
  localId: number;
  name: string;
  size: string;
  kind: FileKind;
  status: UploadStatus;
  fileId?: number;
};

/* --------------------------------------------------------------- список чатов */

/** Строка обращения: аватар, имя, превью, время и счётчик непрочитанных. */
function ChatRow({
  chat,
  onOpen,
}: {
  chat: AdminSupportChat;
  onOpen: () => void;
}) {
  const name = clientName(chat);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-grey-4 bg-white px-4 py-3 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
    >
      <Avatar name={name} className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight text-ink">
          {name}
        </span>
        <span className="truncate text-sm leading-tight text-ink-muted">
          {messagePreview(chat.last_message)}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-ink-muted">
          {formatTime(chat.last_message?.at_create ?? chat.opened_at)}
        </span>
        {chat.unread_count > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium text-white">
            {chat.unread_count}
          </span>
        ) : chat.status === "CLOSED" ? (
          <CheckCheck className="size-4 text-brand" />
        ) : (
          <Check className="size-4 text-ink-muted" />
        )}
      </div>
    </button>
  );
}

/** Экран списка обращений: поиск, табы и список. */
function ChatsList({ onOpen }: { onOpen: (dialogId: number) => void }) {
  const [tab, setTab] = usePersistentState<Tab>("chats.tab", "all");
  const [query, setQuery] = usePersistentState("chats.query", "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);


  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage } = useInfiniteSupportChats({
    query: debouncedQuery || undefined,
    ...TAB_PARAMS[tab],

    limit: PAGE_SIZE,
  });

  const chats = data?.chats ?? [];

  return (
    <div className="flex min-w-0 gap-6">
      {/* Список */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Поиск по чатам"
          className="bg-white"
        />

        <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-grey-4/60 p-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === item.value
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-base text-ink-muted">
            Загрузка обращений…
          </p>
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-base text-danger">
              Не удалось загрузить обращения.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg border border-grey-4 px-3 py-1 text-sm text-ink transition-colors hover:bg-grey-5 disabled:opacity-60"
            >
              Повторить
            </button>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex flex-col gap-2",
                isFetching && "opacity-60 transition-opacity",
              )}
            >
              {chats.length === 0 ? (
                <p className="py-10 text-center text-base text-ink-muted">
                  Ничего не найдено
                </p>
              ) : (
                chats.map((chat) => (
                  <ChatRow
                    key={chat.dialog_id}
                    chat={chat}
                    onOpen={() => onOpen(chat.dialog_id)}
                  />
                ))
              )}
            </div>

            <InfiniteScrollSentinel
                hasNextPage={hasNextPage}
                isFetching={isFetching}
                isError={isError}
                onLoadMore={() => isError && !hasNextPage ? refetch() : fetchNextPage()}
              />
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- чат */

/** Одно изображение сообщения (из `MessageResponse.images`). */
type ChatImage = NonNullable<MessageResponse["images"]>[number];

/**
 * Картинка-вложение внутри пузыря (edge-to-edge). Размер — по соотношению сторон
 * из `width`/`height`, ширина в пределах [180, 280]. Пока грузится ссылка
 * (`useFileUrl`) — скелетон тех же размеров.
 */
function AttachmentImage({ image }: { image: ChatImage }) {
  const { data, isError, refetch } = useFileUrl(image.id, "PREVIEW");
  const [failed, setFailed] = useState(false);
  const width = Math.min(280, Math.max(180, image.width || 280));
  const ratio = image.width && image.height ? image.height / image.width : 0.66;
  const height = Math.round(width * ratio);

  if (isError || data?.status === "FAILED" || failed) {
    return (
      <button type="button" onClick={() => { setFailed(false); void refetch(); }} style={{ width, aspectRatio: `${width} / ${height}` }} className="max-w-full p-3 text-sm underline">
        Не удалось загрузить фото. Повторить
      </button>
    );
  }
  if (!data?.url) {
    return (
      <div
        style={{ width, aspectRatio: `${width} / ${height}` }}
        className="max-w-full animate-pulse bg-black/10"
        role="status"
        aria-label="Загрузка фотографии"
      />
    );
  }
  return (
    <img
      src={data.url}
      alt=""
      style={{ width, aspectRatio: `${width} / ${height}` }}
      className="block h-auto max-w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Разделитель дня переписки: горизонтальная черта с подписью-датой по центру. */
function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-3">
      <span className="h-px flex-1 bg-grey-4" />
      <span className="shrink-0 text-xs font-medium text-ink-muted">{label}</span>
      <span className="h-px flex-1 bg-grey-4" />
    </div>
  );
}

/**
 * Пузырь сообщения — входящий (белый с рамкой + кружок-аватар слева) или
 * исходящий (брендовый справа). Фото-сообщение — единый пузырь: картинка сверху
 * edge-to-edge, подпись под ней (или время оверлеем на фото, если подписи нет).
 */
function Bubble({
  message,
  outgoing,
  read,
}: {
  message: MessageResponse;
  outgoing: boolean;
  /** Прочитано ли клиентом (для исходящих: ✓ отправлено / ✓✓ прочитано). */
  read?: boolean;
}) {
  const images = message.images ?? [];
  const hasText = !!message.text;
  const hasImages = images.length > 0;
  const ticks = outgoing ? (
    (read || message.is_read) ? (
      <CheckCheck className="size-3.5 shrink-0" />
    ) : (
      <Check className="size-3.5 shrink-0" />
    )
  ) : null;
  const attachments = (
    <>
      {(message.documents ?? []).map((file) => <SupportAttachment key={`document-${file.id}`} file={file} kind="document" />)}
      {(message.audios ?? []).map((file) => <SupportAttachment key={`audio-${file.id}`} file={file} kind="audio" />)}
      {(message.videos ?? []).map((file) => <SupportAttachment key={`video-${file.id}`} file={file} kind="video" />)}
      {message.voice && <SupportAttachment file={message.voice} kind="audio" />}
    </>
  );
  const hasOtherAttachments = !!(
    message.documents?.length || message.audios?.length || message.videos?.length || message.voice
  );
  const time = formatTime(message.at_create);

  const row = (children: ReactNode) => (
    <div
      className={cn(
        "flex min-w-0 items-end gap-2 sm:gap-3",
        outgoing ? "justify-end" : "justify-start",
      )}
    >
      {!outgoing && (
        <span className="size-9 shrink-0 self-end rounded-full bg-brand" />
      )}
      {children}
    </div>
  );

  // Фото-сообщение: картинка(и) сверху, подпись/время — в одном пузыре.
  if (hasImages) {
    return row(
      <div
        className={cn(
          "relative flex min-w-0 max-w-[min(452px,calc(100%_-_44px))] flex-col overflow-hidden rounded-2xl",
          outgoing
            ? "bg-brand text-white"
            : "border border-grey-4 bg-white text-ink",
        )}
      >
        {images.map((image) => (
          <AttachmentImage key={image.id} image={image} />
        ))}
        {attachments}

        {hasText || hasOtherAttachments ? (
          <div className="flex items-end justify-between gap-2 px-3 py-2">
            <span className="min-w-0 whitespace-pre-wrap wrap-anywhere text-left text-sm leading-snug">
              {message.text}
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 self-end text-[10px] leading-none",
                outgoing ? "text-white/70" : "text-ink-muted",
              )}
            >
              {time}
              {ticks}
            </span>
          </div>
        ) : (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] leading-none text-white">
            {time}
            {ticks}
          </span>
        )}
      </div>,
    );
  }

  // Текстовое сообщение / прочее вложение.
  return row(
    <div
      className={cn(
        "min-w-0 max-w-[min(452px,calc(100%_-_44px))] rounded-2xl px-3 py-2.5 sm:px-4",
        outgoing
          ? "bg-brand text-white"
          : "border border-grey-4 bg-white text-ink",
      )}
    >
      {attachments}
      <div className="flex items-end gap-2">
        {hasText && <span className="min-w-0 whitespace-pre-wrap wrap-anywhere text-sm leading-snug">{message.text}</span>}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 self-end text-[10px] leading-none",
            outgoing ? "text-white/70" : "text-ink-muted",
          )}
        >
          {time}
          {ticks}
        </span>
      </div>
    </div>,
  );
}

/** Сайдбар смены статуса: закрытие обращения / повторное открытие. */
function StatusSidebar({ chat }: { chat: AdminSupportChat }) {
  const toast = useToast();
  const reopen = useReopenSupportChat();
  const closeChat = useCloseSupportChat();

  const errText = (err: unknown) =>
    err instanceof ApiError ? err.message : "Попробуйте ещё раз.";

  return (
    <aside className="h-fit w-full shrink-0 lg:w-[240px] xl:w-[280px]">
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-base font-semibold text-ink">Статус обращения</h2>

        {chat.status === "OPEN" ? (
          <>
            <button
              type="button"
              onClick={() =>
                closeChat.mutate(chat.dialog_id, {
                  onSuccess: () => toast.success("Обращение закрыто"),
                  onError: (err) =>
                    toast.error("Не удалось закрыть обращение", errText(err)),
                })
              }
              disabled={closeChat.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {closeChat.isPending ? "Закрытие…" : "Закрыть обращение"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">Обращение закрыто.</p>
            <button
              type="button"
              onClick={() =>
                reopen.mutate(chat.dialog_id, {
                  onSuccess: () => toast.success("Обращение открыто повторно"),
                  onError: (err) =>
                    toast.error("Не удалось открыть обращение", errText(err)),
                })
              }
              disabled={reopen.isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-grey-3 text-sm font-medium text-ink transition-colors hover:bg-grey-5 disabled:opacity-50"
            >
              {reopen.isPending ? "Открытие…" : "Открыть повторно"}
            </button>
          </>
        )}
      </Card>
    </aside>
  );
}

/** Экран открытого чата: шапка, переписка, поле ввода и смена статуса. */
function ChatView({
  dialogId,
  onBack,
}: {
  dialogId: number;
  onBack: () => void;
}) {
  const toast = useToast();
  const { data: chat } = useSupportChat(dialogId);
  const { data: page, isLoading } = useSupportMessages(dialogId, {
    limit: 100,
  });
  const lastReadId = useLastReadId(dialogId);
  const sendMutation = useSendSupportMessage(dialogId);
  const markRead = useMarkSupportRead();
  const uploadMutation = useUploadFile();

  const errText = (err: unknown) =>
    err instanceof ApiError ? err.message : "Попробуйте ещё раз.";

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const localIdRef = useRef(0);
  const markedRef = useRef<number>(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const previousMessageRef = useRef<number | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Сообщения приходят курсором (новые первыми) — показываем по возрастанию id.
  const messages = [...(page?.messages ?? [])].sort((a, b) => a.id - b.id);
  const clientId = chat?.client.id;
  const latestMessageId = messages.at(-1)?.id ?? 0;

  const scrollToLatest = () => {
    const viewport = messagesRef.current;
    if (!viewport) return;
    atBottomRef.current = true;
    setHasNewMessages(false);
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  const onMessagesScroll = () => {
    const viewport = messagesRef.current;
    if (!viewport) return;
    const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 48;
    atBottomRef.current = atBottom;
    if (atBottom) setHasNewMessages(false);
  };

  useLayoutEffect(() => {
    if (!page || !messagesRef.current) return;
    const previous = previousMessageRef.current;
    if (previous === null || latestMessageId > previous) {
      if (atBottomRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        setHasNewMessages(false);
      } else {
        setHasNewMessages(true);
      }
    }
    previousMessageRef.current = latestMessageId;
  }, [page, latestMessageId]);

  useEffect(() => {
    const content = messageContentRef.current;
    const viewport = messagesRef.current;
    if (!content || !viewport) return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(content);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Отметить прочитанным до последнего сообщения при наличии непрочитанных.
  useEffect(() => {
    if (!chat || chat.unread_count === 0 || messages.length === 0) return;
    const lastId = messages[messages.length - 1].id;
    if (lastId <= markedRef.current) return;
    markedRef.current = lastId;
    markRead.mutate({ dialogId, lastMessageId: lastId });
    // markRead/messages стабильны в рамках диалога; следим за счётчиком и id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogId, chat?.unread_count, latestMessageId]);

  const setAttachment = (localId: number, patch: Partial<Attachment>) =>
    setAttachments((prev) =>
      prev.map((a) => (a.localId === localId ? { ...a, ...patch } : a)),
    );

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const localId = ++localIdRef.current;
    setAttachments((prev) => [
      ...prev,
      {
        localId,
        name: file.name,
        size: formatSize(file.size),
        kind: fileKind(file),
        status: { kind: "checking" },
      },
    ]);
    try {
      const fileId = await uploadMutation.mutateAsync({
        file,
        purpose: "MESSAGE",
      });
      await waitForMessageFile(fileId);
      setAttachment(localId, { fileId, status: { kind: "done" } });
    } catch (err) {
      setAttachment(localId, { status: { kind: "error" } });
      toast.error("Не удалось загрузить файл", err instanceof Error ? err.message : errText(err));
    }
  };

  const uploading = attachments.some((a) => a.status.kind === "checking");
  const readyIds = attachments
    .filter((a) => a.fileId != null)
    .map((a) => a.fileId as number);
  const canSend =
    (text.trim() !== "" || readyIds.length > 0) &&
    !uploading &&
    !sendMutation.isPending;

  const submit = async () => {
    if (!canSend) return;
    const value = text.trim();
    try {
      await sendMutation.mutateAsync({
        text: value || undefined,
        file_ids: readyIds.length ? readyIds : undefined,
      });
      setText("");
      setAttachments([]);
    } catch (err) {
      // Ошибка также видна инлайном под полем ввода (sendMutation.isError).
      toast.error("Не удалось отправить сообщение", errText(err));
    }
  };

  const hasContent = text.trim() !== "" || attachments.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Переписка — на белой подложке */}
      <Card className="flex h-[70dvh] min-h-[420px] min-w-0 flex-none flex-col gap-4 p-3 sm:p-6 lg:h-auto lg:min-h-0 lg:flex-1">
        {/* Шапка — отдельная плашка */}
        <div className="flex items-center gap-3 rounded-2xl border border-grey-4 bg-white px-4 py-3">
          <button
            type="button"
            aria-label="Назад"
            onClick={onBack}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-grey-5"
          >
            <ChevronLeft className="size-5" />
          </button>
          <Avatar
            name={chat ? clientName(chat) : "?"}
            className="size-10 shrink-0 rounded-full sm:size-12"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-semibold text-ink">
              {chat ? clientName(chat) : "Загрузка…"}
            </span>
            <span className="text-sm text-ink-muted">
              {chat?.client.phone ?? ""}
            </span>
          </div>
        </div>

        {/* Сообщения */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={messagesRef} onScroll={onMessagesScroll} data-slot="chat-messages" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
        <div ref={messageContentRef} className="flex min-w-0 flex-col gap-3">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-ink-muted">
              Загрузка сообщений…
            </p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">
              Сообщений пока нет
            </p>
          ) : (
            (() => {
              let lastDay: string | null = null;
              return messages.map((message) => {
                const key = dayKey(message.at_create);
                const divider =
                  key && key !== lastDay ? formatDay(message.at_create!) : null;
                if (key) lastDay = key;
                const outgoing = message.from?.id !== clientId;
                return (
                  <Fragment key={message.id}>
                    {divider && <DateDivider label={divider} />}
                    <Bubble
                      message={message}
                      outgoing={outgoing}
                      read={outgoing && message.id <= lastReadId}
                    />
                  </Fragment>
                );
              });
            })()
          )}

          {/* Прикреплённые файлы — справа, как исходящие */}
          {attachments.length > 0 && (
            <div className="flex w-full max-w-[460px] flex-col gap-2 self-end">
              {attachments.map((file) => (
                <FileUploadCard
                  key={file.localId}
                  name={file.name}
                  size={file.size}
                  kind={file.kind}
                  status={file.status}
                  onRemove={() =>
                    setAttachments((prev) =>
                      prev.filter((a) => a.localId !== file.localId),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
        </div>
        {hasNewMessages && (
          <button
            type="button"
            onClick={scrollToLatest}
            aria-label="Прокрутить к новым сообщениям"
            title="К новым сообщениям"
            className="absolute bottom-3 right-3 flex size-12 items-center justify-center rounded-full border border-grey-4 bg-white text-brand shadow-lg transition-colors hover:bg-grey-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ArrowDown className="size-6" />
            <span className="absolute right-0 top-0 size-3 rounded-full border-2 border-white bg-brand" />
          </button>
        )}
        </div>

        {sendMutation.isError && (
          <p className="text-right text-sm text-danger">
            Не удалось отправить сообщение.
          </p>
        )}

        {/* Поле ввода — плашка со скрепкой внутри */}
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-grey-4 bg-white px-2 py-2.5 sm:gap-3 sm:px-4">
          <button
            type="button"
            aria-label="Прикрепить файл"
            onClick={() => fileRef.current?.click()}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-grey-5 hover:text-ink"
          >
            <Paperclip className="size-5" />
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ваше сообщение"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          {hasContent && (
            <button
              type="button"
              aria-label="Отправить"
              onClick={submit}
              disabled={!canSend}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          )}
        </div>
      </Card>

      {/* Смена статуса */}
      {chat && <StatusSidebar chat={chat} />}
    </div>
  );
}

/* --------------------------------------------------------------------- экран */

export default function ChatsPage() {
  const [openDialogId, setOpenDialogId] = useState<number | null>(null);

  // Live-обновления обращений + события прочтения на время экрана «Обращения».
  useSupportRealtime();

  return openDialogId != null ? (
    <ChatView dialogId={openDialogId} onBack={() => setOpenDialogId(null)} />
  ) : (
    <ChatsList onOpen={setOpenDialogId} />
  );
}
