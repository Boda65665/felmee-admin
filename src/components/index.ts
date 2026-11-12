// Баррель компонентов админки — единая точка импорта: `@/components`.
// Примитивы shadcn/ui остаются отдельным барелем — `@/components/ui`.

// Общие примитивы
export * from "./card";
export * from "./delta-badge";
export * from "./date-filter";
export * from "./search-input";
export * from "./data-table";
export * from "./page-back-header";
export * from "./avatar";
export * from "./account-cell";
export * from "./address-autocomplete-field";
export * from "./city-autocomplete-field";
export * from "./icon-button";
export * from "./stat-card";
export * from "./status-pill";
export * from "./segment-tabs";
export * from "./account-status-badge";
export * from "./appointment-status-badge";
export * from "./row-actions";
export * from "./block-user-dialog";
export * from "./block-account-dialog";
export * from "./unblock-account-dialog";
export * from "./unblock-user-dialog";
export * from "./user-edit-dialog";
export * from "./role-badge";
export * from "./moderation-actions";
export * from "./reject-reason-dialog";
export * from "./rejection-reason-view-dialog";
export * from "./modal-shell";
export * from "./appointment-view-dialog";
export * from "./appointment-cancel-dialog";
export * from "./user-info-dialog";
export * from "./partner-info-dialog";
export * from "./cooldown-dialog";
export * from "./document-review-dialog";
export * from "./notification-form-dialog";
export * from "./confirm-delete-notification-dialog";
export * from "./chat-view-dialog";
export * from "./master-profile-dialog";
export * from "./salon-profile-dialog";
export * from "./category-form-dialog";
export * from "./delete-category-dialog";
export * from "./confirm-delete-category-dialog";
export * from "./employee-form-dialog";
export * from "./delete-employee-dialog";
export * from "./loyalty-reward-dialog";
export * from "./file-upload-card";
export * from "./complaints-table";
export * from "./access-table";
export * from "./complaint-review-dialog";
export * from "./review-complaint-dialog";
export * from "./complaint-reason-dialog";
export * from "./complaint-case-dialog";
export * from "./complaint-decision-dialog";
export * from "./complaint-service-dialog";
export * from "./table-controls";

// Оболочки экранов
export * from "./layout/app-shell";
export * from "./layout/auth-layout";

// Блоки дашборда
export * from "./dashboard/kpi-card";
export * from "./dashboard/metric-detail-screen";
export * from "./dashboard/metric-chart-card";
export * from "./dashboard/metrics-grid";
export * from "./dashboard/transactions-table";
