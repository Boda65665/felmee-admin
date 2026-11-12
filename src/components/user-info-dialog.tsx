import { X } from "lucide-react";

import type { AdminClientDetails } from "@/lib/api";
import { Dialog, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { AvatarImage } from "./avatar";
import { ModalShell } from "./modal-shell";
import { Field } from "./profile-form";

/**
 * Модалка «Карточка пользователя» — открывается кликом по имени клиента в
 * таблице записей. Показывает данные клиента из `GET /api/admin/clients/{id}`
 * (`useClient`): аватар, имя/фамилия, город, адрес, телефон, e-mail. Поля
 * read-only. Способа оплаты в API нет — не показываем.
 */
export function UserInfoDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Данные клиента из `useClient`; пока грузится — undefined. */
  client?: AdminClientDetails;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalShell className="max-w-[800px]">
        <div className="flex w-full items-start justify-between gap-3">
          <DialogTitle className="sr-only">Карточка пользователя</DialogTitle>
          <AvatarImage
            id={client?.avatar}
            name={
              client
                ? `${client.first_name ?? ""} ${client.last_name ?? ""}`
                : ""
            }
            className="size-16 text-lg"
          />
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Имя" value={client?.first_name ?? ""} readOnly />
          <Field label="Фамилия" value={client?.last_name ?? ""} readOnly />
          <Field label="Город" value={client?.city ?? "—"} readOnly />
          <Field label="Адрес" value={client?.address ?? "—"} readOnly />
          <Field
            label="Номер телефона"
            value={client?.phone ?? "—"}
            readOnly
          />
          <Field label="e-mail" value={client?.email ?? "—"} readOnly />
        </div>
      </ModalShell>
    </Dialog>
  );
}
