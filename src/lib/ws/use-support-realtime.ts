import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/lib/auth/auth-store";
import { activateSupportSocket, deactivateSupportSocket } from "./support-socket";

/**
 * Поднимает STOMP-соединение чата поддержки на время жизни компонента (при
 * наличии токена) и закрывает при размонтировании. Вызывать на экране
 * «Обращения», чтобы получать live-сообщения, смены статуса и события прочтения.
 */
export const useSupportRealtime = () => {
  const queryClient = useQueryClient();
  const jwt = useAuthStore((state) => state.jwt);

  useEffect(() => {
    if (!jwt) return;
    activateSupportSocket(queryClient);
    return () => deactivateSupportSocket();
  }, [jwt, queryClient]);
};
