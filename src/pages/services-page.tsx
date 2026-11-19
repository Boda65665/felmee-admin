import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  Card,
  ClearFiltersButton,
  DataTable,
  IconButton,
  ModalActions,
  ModalButton,
  ModalHeader,
  ModalShell,
  SearchInput,
} from "@/components";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { MasterProfileDialog } from "@/components/master-profile-dialog";
import { ProfileName } from "@/components/profile-name";
import { SalonProfileDialog } from "@/components/salon-profile-dialog";
import { DeferredServicePhoto, ServiceCard, ServicePhoto, ServiceStatusPill } from "@/components/service-details";
import { ServiceEditForm } from "@/components/service-edit-form";
import { SingleFilterMenu, SortMenu, type SortDir } from "@/components/table-controls";
import { Dialog, useToast } from "@/components/ui";
import {
  getMastersSalons,
  useMyPermissions,
  useProviderProfile,
  type AdminMasterProfile,
  type AdminSalonProfile,
} from "@/lib/api";
import {
  useDeleteService,
  useService,
  useServiceCategories,
  useServices,
  type AdminServiceListItem,
  type ServiceProvider,
  type ServiceStatus,
} from "@/lib/api/services";
import { useErrorPopupStore } from "@/lib/error-popup-store";
import { providerNames, serviceCategoryLabel, serviceMoney } from "@/lib/service-display";

const grid = "grid grid-cols-[1.7fr_1.4fr_1.15fr_0.8fr_1.1fr_46px] items-center gap-3";
const emptyServices: AdminServiceListItem[] = [];
const providerOptions = [
  { value: "MASTER", label: "Мастера" },
  { value: "SALON", label: "Салоны" },
] satisfies { value: ServiceProvider; label: string }[];
const statusOptions = [
  { value: "ACTIVE", label: "Активные" },
  { value: "PENDING_DELETION", label: "Ожидают удаления" },
] satisfies { value: ServiceStatus; label: string }[];

type Selection = {
  action: "view" | "edit" | "delete";
  service: AdminServiceListItem;
};

type SelectedProvider = {
  id: number;
  role: ServiceProvider;
  salonLookup?: { name: string | null };
};

async function findSalonIdForServiceOwner(ownerId: number, name: string | null, signal: AbortSignal) {
  const today = format(new Date(), "yyyy-MM-dd");
  const query = name?.trim().slice(0, 200) || undefined;
  let offset = 0;
  for (;;) {
    signal.throwIfAborted();
    const page = await getMastersSalons({
      from: today,
      to: today,
      role: ["SALON"],
      query,
      offset,
      limit: 100,
    });
    const salon = page.items.find((item) => item.id === ownerId);
    const salonId = salon?.salon_id ?? salon?.salonId;
    if (salonId != null) return salonId;
    if (!page.has_more || page.items.length === 0) break;
    offset += page.items.length;
  }
  throw new Error("Салон исполнителя не найден");
}

export default function ServicesPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [providerType, setProviderType] = useState<ServiceProvider | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<ServiceStatus | "">("");
  const [priceSort, setPriceSort] = useState<SortDir | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [profileTarget, setProfileTarget] = useState<SelectedProvider | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const { data: permissions } = useMyPermissions();
  const canWrite = permissions?.some(
    ({ section, access_level }) => section === "SERVICES" && access_level === "FULL",
  ) ?? false;

  const canReadProfiles = permissions?.some(
    ({ section, access_level }) => section === "MASTERS_AND_SALONS"
      && (access_level === "READ" || access_level === "FULL"),
  ) ?? false;
  const salonLookup = profileTarget?.salonLookup;
  const salonOwnerId = salonLookup ? profileTarget?.id : undefined;
  const salonId = useQuery({
    queryKey: ["masters-salons", "service-owner", salonOwnerId, salonLookup?.name],
    queryFn: ({ signal }) => findSalonIdForServiceOwner(salonOwnerId!, salonLookup?.name ?? null, signal),
    enabled: salonOwnerId != null,
    retry: false,
  });
  const profileId = salonLookup ? salonId.data : profileTarget?.id;
  const providerProfile = useProviderProfile(profileId ?? null, profileTarget?.role ?? null);

  const list = useServices({
    q: query || undefined,
    provider_type: providerType || undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    status: status || undefined,
    sort: priceSort ? `price:${priceSort}` : undefined,
  });
  const categories = useServiceCategories();
  const detail = useService(selection?.action === "delete" ? null : selection?.service.id ?? null);
  const deletion = useDeleteService();
  const toast = useToast();
  const reportError = useErrorPopupStore((store) => store.show);

  useEffect(() => {
    const error = salonId.error ?? providerProfile.error;
    if (profileTarget && error) {
      reportError(error, "Не удалось открыть карточку исполнителя");
      setProfileTarget(null);
    }
  }, [profileTarget, salonId.error, providerProfile.error, reportError]);

  const filterCount = [search.trim(), providerType, categoryId, status, priceSort].filter(Boolean).length;
  const categoryOptions = categories.data?.map((item) => ({
    value: String(item.id),
    label: serviceCategoryLabel(item, categories.data),
  })) ?? [];

  function clearFilters() {
    setSearch("");
    setQuery("");
    setProviderType("");
    setCategoryId("");
    setStatus("");
    setPriceSort(null);
  }

  async function removeService() {
    if (!selection || !canWrite || deletion.isPending) return;
    try {
      const result = await deletion.mutateAsync(selection.service.id);
      if (result.deletion_pending) {
        toast.success("Услуга скрыта", "Она удалится автоматически после завершения связанных записей и заявок.");
      } else {
        toast.success("Услуга удалена");
      }
      setSelection(null);
    } catch (error) {
      reportError(error, "Не удалось удалить услугу");
    }
  }

  const columns: ColumnDef<AdminServiceListItem>[] = [
    {
      accessorKey: "name",
      header: "Услуга",
      meta: { mobileLabel: "Услуга", mobileSpan: "full", wrap: true },
      cell: ({ row: { original } }) => (
        <button type="button" onClick={() => setSelection({ action: "edit", service: original })}
          className="flex w-full min-w-0 items-center gap-3 text-left font-semibold text-brand hover:underline">
          {original.preview_file_id === undefined ? (
            <DeferredServicePhoto key={original.id} serviceId={original.id} className="size-11 rounded-lg" />
          ) : (
            <ServicePhoto key={original.preview_file_id} id={original.preview_file_id} className="size-11 rounded-lg" />
          )}
          <span className="min-w-0 break-words">{original.name || `Услуга #${original.id}`}</span>
        </button>
      ),
    },
    {
      accessorKey: "provider_name",
      header: () => <SingleFilterMenu label="Исполнитель" options={providerOptions} value={providerType} onChange={setProviderType} />,
      meta: { mobileLabel: "Исполнитель", mobileFilter: true, wrap: true },
      cell: ({ row: { original } }) => {
        const { provider_type, provider_id, provider_name, salon_id } = original;
        // Older services responses only identify a salon by its owner account.
        const needsSalonLookup = provider_type === "SALON" && salon_id === undefined;
        const id = provider_type === "SALON" && !needsSalonLookup ? salon_id : provider_id;
        const target = id != null && provider_type ? { id, role: provider_type } : null;
        return (
          <>
            <ProfileName
              target={target}
              onOpen={canReadProfiles && target ? () => setProfileTarget({
                ...target,
                salonLookup: needsSalonLookup ? { name: provider_name } : undefined,
              }) : undefined}
            >
              {provider_name || (provider_id == null ? "—" : `#${provider_id}`)}
            </ProfileName>
            {provider_type && <span className="block text-xs text-ink-muted">{providerNames[provider_type]}</span>}
          </>
        );
      },
    },
    {
      accessorKey: "category_name",
      header: () => <SingleFilterMenu label="Категория" options={categoryOptions} value={categoryId} onChange={setCategoryId} />,
      meta: { mobileLabel: "Категория", mobileFilter: true, wrap: true },
      cell: ({ row: { original } }) => original.category_name || "—",
    },
    {
      accessorKey: "price",
      header: () => <SortMenu label="Цена и время" value={priceSort} onChange={setPriceSort} />,
      meta: { mobileLabel: "Цена и время", mobileFilter: true },
      cell: ({ row: { original } }) => (
        <>
          <span>{original.is_fix_price === false && original.price != null ? "от " : ""}{serviceMoney(original.price)}</span>
          <span className="block text-xs text-ink-muted">{original.duration == null ? "—" : `${original.duration} мин.`}</span>
        </>
      ),
    },
    {
      accessorKey: "status",
      header: () => <SingleFilterMenu label="Статус" options={statusOptions} value={status} onChange={setStatus} />,
      meta: { mobileLabel: "Статус", mobileFilter: true, wrap: true },
      cell: ({ row: { original } }) => <ServiceStatusPill status={original.status} />,
    },
    {
      id: "actions",
      header: "",
      meta: { mobileSpan: "full" },
      cell: ({ row: { original } }) => (
        <div className="flex justify-end">
          {canWrite && original.status === "ACTIVE" && (
            <IconButton icon={Trash2} label="Удалить услугу" className="border-danger/20 bg-danger-bg text-danger hover:bg-danger/10"
              onClick={() => setSelection({ action: "delete", service: original })} />
          )}
        </div>
      ),
    },
  ];

  const selected = selection?.service;
  const canEditDetail = canWrite && detail.data?.status === "ACTIVE";
  const isEditing = selection?.action === "edit" && canEditDetail;

  return (
    <>
      <Card>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={(value) => setSearch(value.slice(0, 200))}
            placeholder="Поиск по названию, исполнителю, категории или ID" className="max-w-[547px] focus-within:border-brand" />
          <ClearFiltersButton count={filterCount} onClick={clearFilters} />
        </div>
        {categories.isError && (
          <button type="button" onClick={() => categories.refetch()} className="mt-2 text-sm text-brand hover:underline">
            Загрузить категории повторно
          </button>
        )}
        <div className="mt-9">
          <DataTable
            data={list.data ?? emptyServices}
            columns={columns}
            gridClassName={grid}
            rowClassName={list.isFetching ? "opacity-60 transition-opacity" : undefined}
            emptyState={list.isPending ? (
              <p role="status" className="py-8 text-center text-ink-muted">Загрузка услуг…</p>
            ) : list.isError && !list.data ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-ink-muted">
                Не удалось загрузить услуги.
                <button type="button" disabled={list.isFetching} onClick={() => list.refetch()}
                  className="rounded-lg border border-grey-4 px-3 py-1 text-ink transition-colors hover:bg-grey-5 disabled:opacity-60">
                  Повторить
                </button>
              </div>
            ) : undefined}
          />
          {list.data && (
            <InfiniteScrollSentinel
              hasNextPage={list.hasNextPage} isFetching={list.isFetching} isError={list.isError}
              onLoadMore={() => list.isRefetchError && !list.isFetchNextPageError ? list.refetch() : list.fetchNextPage()}
            />
          )}
        </div>
      </Card>

      {profileTarget?.role === "SALON" && (
        <SalonProfileDialog
          key={profileTarget.id}
          open={providerProfile.isSuccess}
          onOpenChange={(open) => !open && setProfileTarget(null)}
          profile={providerProfile.data as AdminSalonProfile | undefined}
        />
      )}
      {profileTarget?.role === "MASTER" && (
        <MasterProfileDialog
          key={profileTarget.id}
          open={providerProfile.isSuccess}
          onOpenChange={(open) => !open && setProfileTarget(null)}
          profile={providerProfile.data as AdminMasterProfile | undefined}
        />
      )}

      <Dialog open={selected != null} onOpenChange={(open) => {
        if (!open && !deletion.isPending) setSelection(null);
      }}>
        {selection && (
          <ModalShell className={selection.action === "delete" ? "sm:max-w-[480px]" : "sm:max-w-[660px]"}>
            <ModalHeader
              title={selection.action === "delete" ? "Удалить услугу" : isEditing ? "Редактирование услуги" : "Услуга"}
              accent={`#${selection.service.id}`}
            />
            {selection.action === "delete" ? (
              <>
                <p className="text-sm text-ink-muted">
                  Удалить «{selection.service.name || `#${selection.service.id}`}»? При наличии незавершённых записей или заявок услуга будет скрыта
                  и удалится автоматически после их завершения.
                </p>
                <ModalActions>
                  <ModalButton close disabled={deletion.isPending}>Отмена</ModalButton>
                  <button type="button" disabled={!canWrite || deletion.isPending} onClick={removeService}
                    className="min-h-12 flex-1 rounded-full bg-danger px-4 py-2 text-white hover:opacity-90 disabled:opacity-60">
                    {deletion.isPending ? "Удаление…" : "Удалить"}
                  </button>
                </ModalActions>
              </>
            ) : detail.isPending ? (
              <p role="status" className="text-sm text-ink-muted">Загрузка карточки…</p>
            ) : detail.isError ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                Не удалось загрузить карточку услуги.
                <button type="button" disabled={detail.isFetching} onClick={() => detail.refetch()}
                  className="rounded-lg border border-grey-4 px-3 py-1 text-ink hover:bg-grey-5">
                  Повторить
                </button>
              </div>
            ) : isEditing ? (
              <ServiceEditForm key={detail.data.id} service={detail.data} categories={categories.data ?? []}
                onSaved={() => setSelection((current) => current?.action === "edit" && current.service.id === detail.data.id ? { action: "view", service: detail.data } : current)} />
            ) : (
              <>
                <ServiceCard service={detail.data} />
                <ModalActions>
                  <ModalButton close>Закрыть</ModalButton>
                  {canEditDetail && <ModalButton variant="primary"
                    onClick={() => setSelection({ action: "edit", service: detail.data })}>Изменить</ModalButton>}
                </ModalActions>
              </>
            )}
          </ModalShell>
        )}
      </Dialog>
    </>
  );
}
