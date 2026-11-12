# Felmee Admin

Административная панель проекта Felmee. Реализуется по макету из Figma.

> Репозиторий содержит **только админ-панель**. Лендинг из нескольких страниц
> планируется отдельно и в этот репозиторий не входит.

## Технологический стек

| Слой              | Технология                                               |
| ----------------- | -------------------------------------------------------- |
| Сборка / дев      | [Vite](https://vite.dev/) 8                              |
| UI-библиотека     | [React](https://react.dev/) 19                           |
| Язык              | [TypeScript](https://www.typescriptlang.org/)            |
| Стили             | [Tailwind CSS](https://tailwindcss.com/) v4              |
| Компоненты        | [shadcn/ui](https://ui.shadcn.com/) (Radix, пресет Nova) |
| Иконки / шрифт    | Lucide, Geist                                            |
| Пакетный менеджер | pnpm                                                     |

## Требования

- Node.js 22+
- pnpm 9+

## Установка и запуск

```bash
pnpm install       # установка зависимостей
pnpm dev           # дев-сервер с HMR (http://localhost:5173)
pnpm build         # прод-сборка (tsc -b && vite build) в dist/
pnpm preview       # локальный предпросмотр прод-сборки
pnpm lint          # линтинг через oxlint
pnpm test          # регрессионные проверки API и бесконечной прокрутки
```

## Структура проекта

```
felmee-admin/
├── public/                 # статические ассеты (favicon и т.п.)
├── src/
│   ├── components/
│   │   └── ui/             # компоненты shadcn/ui
│   ├── pages/             # экраны админ-панели (login-page.tsx …)
│   ├── assets/            # ассеты из макета (иллюстрации)
│   ├── lib/
│   │   └── utils.ts        # утилиты (cn — объединение классов)
│   ├── App.tsx             # корневой компонент
│   ├── main.tsx            # точка входа
│   └── index.css           # Tailwind + тема shadcn (CSS-переменные)
├── components.json         # конфигурация shadcn/ui
├── vite.config.ts          # конфиг Vite (плагины, алиас @)
└── tsconfig*.json          # конфигурация TypeScript
```

Алиас путей: `@/*` → `src/*` (например, `import { Button } from '@/components/ui/button'`).

## Добавление компонентов shadcn/ui

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog table sidebar
```

Компоненты копируются в `src/components/ui/` и дальше редактируются как собственный код.

## Тема и бренд-токены

Тема shadcn задана CSS-переменными в `src/index.css` (`@theme inline` + `:root` / `.dark`),
цвета — в формате oklch. Поверх нейтральной палитры добавлены бренд-токены Felmee из макета:

| Токен         | Значение  | Классы                         |
| ------------- | --------- | ------------------------------ |
| `--brand`     | `#9c5cfe` | `bg-brand`, `text-brand`       |
| `--ink`       | `#3c3c43` | `text-ink` (основной текст)    |
| `--ink-muted` | ~60% ink  | `text-ink-muted`               |
| `--grey-1`    | `#aeaeb2` | `border-grey-1`, `text-grey-1` |
| `--grey-3`    | `#d1d1d6` | `bg-grey-3`                    |

## Экраны

- **Вход** — `src/pages/login-page.tsx`: авторизация по номеру телефона (маска
  `+7 (XXX) XXX-XX-XX`) и приветственный баннер. Собран по макету из Figma.

## Данные и API

Рабочие разделы используют серверные данные и бесконечную прокрутку списков.
В «Документах» доступны фильтр проверки банка, остатки Felmee и состояние переноса между получателями; переводами управляет бэкенд.
Демоданные сохранены только в обзоре бизнеса и его финансовых деталях.
Контракт и ограничения бэкенда: [docs/api-integration.md](docs/api-integration.md).
