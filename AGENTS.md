# TG Calendar — Telegram Mini App

Кастомный календарь как Telegram Mini App. Заменяет ограничения Google
Calendar: даёт контролируемый ввод событий пользователями.

## Стек
- Frontend: React 18 + Vite + TypeScript, Telegram WebApp SDK, Telegram UI
- Backend: NestJS + TypeScript
- DB: PostgreSQL + Prisma (миграции)
- Монорепо: pnpm workspaces + Turborepo
- Общие типы: packages/shared-types

## Структура
- apps/web  — фронтенд (Mini App)
- apps/api  — бэкенд (NestJS)
- packages/shared-types — DTO и доменные типы, шарятся между web и api

## Команды
- pnpm dev          — запуск web + api в dev
- pnpm --filter api test
- pnpm --filter api prisma migrate dev
- pnpm lint && pnpm typecheck

## Язык и локализация
- UI и сообщения: украинский (uk) по умолчанию, английский (en) — дубликат.
  Русский НЕ использовать.
- Все строки — через i18n (ключи), без хардкода.
- Комментарии в коде минимальны и только на английском.

## Принципы
- Строгий TypeScript, никакого `any`
- Любые данные с фронта валидируются на бэке (DTO + class-validator)
- Аутентификация только через проверку Telegram initData (HMAC)
- Любое клиентское ограничение прав дублируется проверкой на бэке
- Новые домены = новый NestJS-модуль + типы в shared-types
