import { Client, type IMessage } from "@stomp/stompjs";
import type { QueryClient } from "@tanstack/react-query";

import { supportKeys } from "@/lib/api/support";
import { useAuthStore } from "@/lib/auth/auth-store";
import type { components } from "@/lib/api/schema";
import { useSupportReadStore } from "./read-store";

type ReadMessageWs = components["schemas"]["ReadMessageWsResponse"];

// Бэкенд поднимает `/ws` как чистый STOMP-over-WebSocket (без SockJS-фоллбэка:
// `/ws/info` отдаёт 404), поэтому коннектимся нативным WebSocket. HTTP(S)-базу
// (env или текущий origin — в dev `/ws` проксируется в vite.config) переводим
// в ws(s):// для `brokerURL`.
const HTTP_BASE =
  import.meta.env.VITE_API_BASE_URL || window.location.origin;
const WS_URL = `${HTTP_BASE.replace(/^http/, "ws")}/ws`;

let client: Client | null = null;

/**
 * Поднять STOMP-соединение чата поддержки (нативный WebSocket `/ws`, JWT в
 * CONNECT-заголовке `Authorization`). Подписки:
 * - `admin.support.new_message` / `.delivered` / `.status` → инвалидируют кэш
 *   обращений (список + сообщения обновляются live);
 * - `chat.read_message` → двигают указатель прочтения (галочки ✓✓ на исходящих).
 * Идемпотентна: повторный вызов при активном клиенте — no-op.
 */
export const activateSupportSocket = (queryClient: QueryClient) => {
  if (client) return;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: supportKeys.all });

  // Диагностика на этапе интеграции с реальным бэкендом (только в dev).
  const log = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.info("[support-ws]", ...args);
  };

  const instance = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,
    beforeConnect: () => {
      const jwt = useAuthStore.getState().jwt;
      instance.connectHeaders = jwt ? { Authorization: `Bearer ${jwt}` } : {};
      log("connecting", WS_URL);
    },
    onConnect: () => {
      log("connected");
      instance.subscribe("/user/queue/admin.support.new_message", invalidate);
      instance.subscribe("/user/queue/admin.support.delivered", invalidate);
      instance.subscribe("/user/queue/admin.support.status", invalidate);
      instance.subscribe("/user/queue/chat.read_message", (msg: IMessage) => {
        log("read_message", msg.body);
        try {
          const body = JSON.parse(msg.body) as ReadMessageWs;
          useSupportReadStore
            .getState()
            .setLastRead(body.dialog_id, body.last_read_message_id);
        } catch {
          // Некорректный payload игнорируем.
        }
      });
      // Fetch changes that arrived before subscriptions or during an outage.
      void invalidate();
    },
    onStompError: (frame) =>
      log("stomp error", frame.headers["message"], frame.body),
    onWebSocketError: (event) => log("ws error", event),
    onWebSocketClose: (event) => log("ws closed", event.code, event.reason),
  });

  client = instance;
  instance.activate();
};

/** Закрыть STOMP-соединение чата поддержки. */
export const deactivateSupportSocket = () => {
  client?.deactivate();
  client = null;
};
