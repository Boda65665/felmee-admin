import { Ban, MessageCircle, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useMyPermissions } from "@/lib/api";
import { useStartSupportChat, type SupportChatTarget } from "@/lib/api/support";
import { useErrorPopupStore } from "@/lib/error-popup-store";
import { ROUTES } from "@/lib/routes";

import { IconButton } from "./icon-button";
import { BlockUserDialog } from "./block-user-dialog";
import {
  BlockAccountDialog,
  type BlockAccountVariant,
} from "./block-account-dialog";
import { ChatViewDialog } from "./chat-view-dialog";

/**
 * Действия по строке аккаунта: просмотр, редактирование и блокировка —
 * либо кнопка «Разблокировать» для уже заблокированных. Блокировка проходит
 * через подтверждение в модалке; фактическое действие отдаётся `onBlock`.
 * Разблокировка — прямое действие `onUnblock` (модалку подтверждения, если
 * нужна, держит вызывающая страница — так делают и «Пользователи», и «Мастера»).
 */
export function RowActions({
  blocked,
  onBlock,
  onUnblock,
  showChat = false,
  chatClientId = null,
  supportChatTarget,
  blockVariant = "user",
}: {
  blocked: boolean;
  /**
   * Блокировка с причиной из модалки. Промис держит кнопку в состоянии
   * блокировки и оставляет модалку открытой при ошибке.
   */
  onBlock: (reason: string) => void | Promise<void>;
  /** Разблокировка — прямое действие по кнопке (подтверждение — на странице). */
  onUnblock: () => void | Promise<void>;
  /** Просмотр и редактирование данных выполняются на странице аккаунта. */
  showView?: false;
  showEdit?: false;
  /** Показывать ли кнопку «Чат» → модалка личных переписок клиента. */
  showChat?: boolean;
  /** Клиент, чьи чаты показывать в модалке (обязателен при `showChat`). */
  chatClientId?: number | null;
  supportChatTarget?: SupportChatTarget;
  /**
   * Какая модалка блокировки: `user` — `BlockUserDialog` (по умолчанию);
   * `master`/`salon` — `BlockAccountDialog` (свой набор причин по `target`).
   */
  blockVariant?: "user" | BlockAccountVariant;
}) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const navigate = useNavigate();
  const { data: permissions } = useMyPermissions(supportChatTarget != null);
  const startChat = useStartSupportChat();
  const canStartChat = permissions?.some(
    ({ section, access_level }) => section === "SUPPORT" && access_level === "FULL",
  );

  const accountVariant = blockVariant === "user" ? null : blockVariant;

  return (
    <div className="flex items-center justify-end gap-3">
      {accountVariant ? (
        <BlockAccountDialog
          open={blockOpen}
          onOpenChange={setBlockOpen}
          variant={accountVariant}
          onConfirm={onBlock}
        />
      ) : (
        <BlockUserDialog
          open={blockOpen}
          onOpenChange={setBlockOpen}
          onConfirm={onBlock}
        />
      )}

      {showChat && (
        <ChatViewDialog
          open={chatOpen}
          onOpenChange={setChatOpen}
          clientId={chatClientId}
        />
      )}

      {showChat && (
        <IconButton
          icon={MessageCircle}
          label="История переписок"
          onClick={() => setChatOpen(true)}
        />
      )}
      {supportChatTarget && canStartChat && (
        <IconButton
          icon={MessageSquarePlus}
          label="Открыть чат поддержки"
          disabled={startChat.isPending}
          onClick={() =>
            startChat.mutate(supportChatTarget, {
              onSuccess: (chat) => navigate(ROUTES.chats + "?dialog_id=" + chat.dialog_id),
              onError: (error) => useErrorPopupStore.getState().show(error, "Не удалось открыть чат"),
            })
          }
        />
      )}
      {blocked ? (
        <button
          type="button"
          onClick={() => onUnblock()}
          className="flex h-[46px] items-center justify-center rounded-xl border border-grey-4 bg-grey-5 px-4 text-sm font-bold tracking-tight text-ink transition-colors hover:bg-grey-4"
        >
          Разблокировать
        </button>
      ) : (
        <IconButton
          icon={Ban}
          label="Заблокировать"
          onClick={() => setBlockOpen(true)}
          className="border-danger/20 bg-danger-bg text-danger hover:bg-danger/10"
        />
      )}
    </div>
  );
}
