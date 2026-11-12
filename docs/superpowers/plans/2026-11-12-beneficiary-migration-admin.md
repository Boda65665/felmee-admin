# Beneficiary migration in Felmee Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Подключить остатки Felmee, ход переноса бенефициара и фильтр банковского статуса к существующему разделу документов.

**Architecture:** Синхронизировать только Business Registry из локального OpenAPI. Сохранить плоскую карточку и её переход на ключ из ответа PATCH. Правила подтверждения и опроса расширить в существующем модуле банковских статусов; переводами управляет только backend.

**Tech Stack:** React 19, TypeScript, TanStack Query, react-hook-form, Vite; существующие компоненты Select и токены.

**Spec:** `D:/projects/felmee-master/docs/admin-beneficiary-migration-handoff.md`, `D:/projects/felmee-master/openapi.yaml`.

## Global Constraints

- `available_rub` и `blocked_rub` — целые рубли Felmee; не делить на 100 и не получать баланс у Точки.
- `balance_transfer_status` необязателен: PENDING, READY, TRANSFERRING, PROCESSING, APPLYING, DONE, REVIEW_REQUIRED.
- Окончательное подтверждение: bank_status=VERIFIED, а при переносе дополнительно DONE.
- REVIEW_REQUIRED требует ручной сверки и показа bank_error_code, без повторного перевода из UI.
- Положительный доступный остаток не блокирует PATCH; 409 при зарезервированных средствах получает понятное пояснение.
- После PATCH следующие запросы адресуются по source/business_type/business_entity_id ответа.
- bank_status — скалярный параметр API; интерфейс поддерживает множественный выбор с OR по веткам и совместимостью с остальными фильтрами и пагинацией.
- Не перезапускать сервер; сохранить внесённые изменения и поведение ошибок банка только по нажатию.

## Review Focus

- Нет новых полей в работающем старом backend: показывать неизвестный баланс, а не выдуманный ноль.
- VERIFIED вместе с незавершённым переносом не даёт сообщения об окончательном успехе.
- REVIEW_REQUIRED не приводит к повторной банковской отправке или бесконечному опросу.
- Изменение статуса/баланса при опросе не стирает редактируемые поля и не возвращает старый ключ.
- Изменение/очистка bank_status начинает пагинацию заново и сохраняет остальные фильтры.

## Task 1: Контракт и фильтр банка

**Files:** `openapi/feelme.json`, `src/lib/api/schema.d.ts`, `src/lib/api/business-registry.ts`, `src/pages/documents-page.tsx`, `tests/multiple-filters.test.mjs`.

**Interfaces:** `BusinessApplicationsListParams.bank_status?: BusinessBankStatus`; `BusinessBankStatus = BusinessApplicationCard['bank_status']`; `BusinessApplicationsFilters.bank_statuses?: BusinessBankStatus[]`. UI использует общий CheckboxFilterMenu с множественным выбором и вариантом «Все» в заголовке колонки.

- [x] Зафиксировать в браузерной проверке отсутствие фильтра; проверить передачу выбранного bank_status, очистку и сочетание с пагинацией типов.
- [x] Импортировать Business Registry paths и связанные схемы из локального YAML, сгенерировать типы существующим api:gen.
- [x] Добавить persistent bankStatuses, передавать один bank_status для каждого сочетания, сохранить отдельные offsets и общий query key выбранных фильтров.
- [x] Проверить фильтр на подменённом API и HTTP-параметры в тестах.

## Task 2: Остатки и перенос в карточке

**Files:** `src/lib/business-bank-status.ts`, `src/lib/format.ts`, `src/lib/error-messages.ts`, `src/lib/api/business-registry.ts`, `src/components/document-review-dialog.tsx`, `tests/api-integration.test.mjs`, `tests/business-registry.test.mjs`.

**Interfaces:** `isBusinessApplicationConfirmed(card)` проверяет VERIFIED плюс отсутствие переноса или DONE; `shouldPollBusinessApplication(card, queued)` задаёт необходимость опроса. Общие метаданные семи состояний переноса — в модуле банковских статусов. `formatRubles(value)` форматирует только безопасное неотрицательное целое число, иначе «—».

- [x] Написать и запустить красные проверки для ожидания переноса при VERIFIED, остановки REVIEW_REQUIRED и форматирования рублей.
- [x] Показать два остатка и отдельный блок переноса без новых композитов. PENDING объясняет ожидание документов/банка; APPLYING — обновление внутреннего остатка; DONE подтверждает перенос, общий успех зависит также от VERIFIED.
- [x] Для REVIEW_REQUIRED показать код и ручную сверку, отключить отправку банка; заблокировать изменение получателя во время активного переноса. Не блокировать форму по available_rub.
- [x] Продолжать опрос активных фаз, прекращать его при ручной сверке/итоге/закрытии; обновлять список при итоговом результате.
- [x] Добавить пояснения 409 reserved funds, migration in progress и manual review. Сохранить существующий переход карточки по ключу ответа PATCH.
- [x] Пройти проверки ИП→ООО с available_rub>0, blocked_rub=0/>0, новыми документами, новым id, всеми фазами и ручной сверкой.

## Task 3: Итоговая проверка и документация

**Files:** `docs/design-system.md`, `docs/api-integration.md`, `CLAUDE.md`, при необходимости `README.md`; временные браузерные проверки — `.figma/`.

- [x] Выполнить полный `npm test`, `npm run build`, `npm run lint` (pnpm отсутствует; это те же scripts).
- [x] Проверить браузером desktop/mobile с подменой API; никаких реальных банковских переводов для теста.
- [x] Выполнить read-only HTTP-проверку localhost:8080, отдельно отметить доступность нового контракта работающего backend.
- [x] Обновить живые документы, выполнить независимые review/simplify и git diff --check.

## Execution ledger

- Ruling: работать в текущем D:/felmee-admin-dev — пользователь продолжает проверять эту запущенную админку и передал контракт именно для неё; перенос на HEAD отдельного worktree потерял бы имеющиеся незакоммиченные исправления. Изменения вносить точечно, без коммитов чужой работы.
- Ruling: выполнение в текущей сессии — требования заданы handoff, выбор компонентов и проверок является рутинной реализацией; отдельное подтверждение плана не требуется в авторизованном объёме.
- Plan reviewed against handoff: все пять пунктов и bank_status покрыты задачами 1–3.
- Task 1: контракт и типы синхронизированы; браузер проверил выбор/замену/очистку bank_status; тест multiple-filters проверил фильтр во всех ветках и offsets.
- Task 2: четыре новые unit-проверки RED→GREEN; браузер проверил все перечисленные сценарии и мобильный REVIEW_REQUIRED; 47/47 тестов, build и lint прошли до финальной правки стиля.
- Ruling: после замечания пользователя фильтр банка использует тот же CheckboxFilterMenu/ColumnTrigger, что и соседний фильтр, с новым multiple=false; одиночный API-параметр сохранён, стандартный мультивыбор остальных меню не изменён.
- Review: независимый reviewer сверил frontend с handoff/OpenAPI и backend service; существенных проблем в миграции не обнаружено. Финальная проверка стиля и обновление документов выполняются.
- Task 3 complete: после унификации фильтров npm test — 47/47, npm run build — exit 0, npm run lint — exit 0 (16 прежних warnings); browser на подмене API — все сценарии зелёные, визуально проверены desktop фильтры и mobile390 REVIEW_REQUIRED. Документация обновлена. HTTP localhost:8080 — 401 для обеих вкладок и bank_status=VERIFIED/без фильтра, поэтому новый контракт работающего backend и банковский перевод остаются непроверенными. Реальных банковских действий, изменений БД и перезапуска сервера не выполнялось.
- Ruling: по последующему запросу пользователя банк теперь допускает множественный выбор; scalar bank_status остался только в API отдельных веток. Совместимость текущего одиночного выбора сохранена. Неиспользуемый single-mode у CheckboxFilterMenu удалён.
- Multi-select RED→GREEN: новые проверки сочетаний типов/банков, независимых offsets, total, выбора всех/ни одного и ошибки отдельной ветки; браузер 1440/390 проверил две одновременные отметки, счётчик, открытое меню, снятие одной отметки и «Все».
- Ruling: последующее требование владельца отменяет клиентское предупреждение по blocked_rub. Суммы available/blocked не блокируют форму; backend обновляет серверное правило отдельно. Проверено в браузере с новым API fixture: ИП→ООО при available=1000 и blocked=1000, успешный PATCH и переход на новый ключ; build и lint — exit 0.
