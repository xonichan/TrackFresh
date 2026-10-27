# Design

## Context

См. proposal.md — Why. Приложение TrackFresh ещё не реализовано; исходный план (изменение `create-trackfresh-app`) описывал хранение в Firebase Firestore. Никакого кода и схемы в репозитории пока нет. Целевое хранилище этого изменения — PostgreSQL на сервере `192.168.3.69`. Способ подключения приложения и аутентификация в объём не входят.

## Goals / Non-Goals

**Goals:**
- Зафиксировать реляционную схему: пользователи, продукты, настройки.
- Определить типы, ограничения целостности и индексы под реальные запросы приложения.
- Определить модель разграничения доступа на уровне хранилища.

**Non-Goals:**
- Способ подключения мобильного приложения к базе (API-слой, драйвер, VPN).
- Аутентификация и идентичность пользователя.
- Офлайн-синхронизация и очередь локальных изменений.
- Миграция данных из Firestore (данных ещё нет).
- Выбор инструмента миграций.

## Decisions

### 1. Реляционная схема вместо документной
**Выбор**: три таблицы — `users`, `products`, `user_settings`.
**Rationale**: Набор полей фиксирован и однороден, связи «пользователь → продукты» явные. Реляционная модель даёт декларативные ограничения целостности и предсказуемые выборки, чего Firestore-подход не обеспечивал.
**Альтернатива**: JSONB-документ в одной таблице — гибче, но теряет типизацию и проверки на уровне схемы.

### 2. Типы дат
**Выбор**: `expiry_date DATE`, `production_date DATE NULL`, `created_at/updated_at timestamptz NOT NULL DEFAULT now()`.
**Rationale**: Срок годности и дата производства — календарные даты; `DATE` исключает сдвиг по часовому поясу (см. спек `product-management`). Служебные метки — момент времени, поэтому `timestamptz`.
**Альтернатива**: всё `timestamptz` — даёт классические off-by-one при смене пояса.

### 3. Идентификаторы — UUID
**Выбор**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
**Rationale**: Идентификаторы можно генерировать на клиенте (важно для будущей офлайн-синхронизации), без раскрытия порядка и объёма записей.
**Альтернатива**: `bigserial` — компактнее, но выдаёт последовательность и усложняет офлайн-создание.

### 4. Категория — текст с CHECK
**Выбор**: `category text NOT NULL CHECK (category IN ('food','medicine'))`.
**Rationale**: Список категорий может расширяться; CHECK эволюционирует простой миграцией лучше, чем `enum`.
**Альтернатива**: `enum` — строже, но добавление значения требует `ALTER TYPE`.

### 5. Целостность дат — CHECK
**Выбор**: `CHECK (production_date IS NULL OR production_date <= expiry_date)`.
**Rationale**: Правило проверяется хранилищем, а не только UI (см. спек `data-model`).
**Альтернатива**: проверка только в приложении — правило легко обходится.

### 6. Разграничение доступа — Row-Level Security
**Выбор**: включить RLS на `products` и `user_settings` с политикой `user_id = current_setting('app.user_id')::uuid`.
**Rationale**: Доступ ограничен на уровне базы (defense-in-depth), приложение не может «забыть» фильтр по владельцу.
**Альтернатива**: фильтрация только в API-слое — единая точка ошибки, риск утечки чужих строк.
**Открыто**: как именно идентичность попадает в сессию — зависит от отложенного изменения о подключении.

### 7. Индексы
**Выбор**: `INDEX (user_id, expiry_date)` на `products`; PK/UNIQUE по `user_id` на `user_settings`.
**Rationale**: Основной запрос — выборка продуктов владельца, упорядоченная по сроку годности (см. спек `data-model`).

### Схема (эскиз)

```sql
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('food','medicine')),
  expiry_date     date NOT NULL,
  production_date date NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (production_date IS NULL OR production_date <= expiry_date)
);
CREATE INDEX products_owner_expiry_idx ON products (user_id, expiry_date);

CREATE TABLE user_settings (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_frequency text NOT NULL DEFAULT 'daily',
  notify_time      time NOT NULL DEFAULT '09:00',
  warn_days        integer NOT NULL DEFAULT 3 CHECK (warn_days >= 0)
);
```

## Risks / Trade-offs

- **[Приватный адрес `192.168.3.69`]** → вне домашней сети недоступен; способ доступа и офлайн-стратегия решаются отдельным изменением. Здесь фиксируется только схема.
- **[RLS требует корректной передачи идентичности]** → если `app.user_id` не выставляется, политика не сработает ожидаемо. Митигация: определить способ в изменении о подключении; до этого не полагаться на RLS как на единственный барьер.
- **[Конфликт с действующим планом]** → `user-data-sync` и `create-trackfresh-app` описывают Firestore. Митигация: зафиксировать противоречие (см. proposal Impact) и разрешить отдельным изменением, не смешивая с моделью данных.
- **[`updated_at` не обновляется сам]** → нужен триггер или явное заполнение в API. Митигация: решить вместе с API-слоем; в схеме поле присутствует.

## Migration Plan

1. Создать миграцию с тремя таблицами, ограничениями и индексом.
2. Применить на сервере `192.168.3.69` (в объём не входит, выполняется в рамках реализации).
3. Проверить: ограничения `category` и порядка дат отклоняют некорректные строки; выборка по `(user_id, expiry_date)` упорядочена.
4. Откат: удалить таблицы (данных ещё нет, безопасно).

## Open Questions

- Инструмент миграций (raw SQL / Flyway / Prisma и т. п.) — определяется вместе с API-слоем.
- Как идентичность пользователя передаётся в RLS (`SET app.user_id` vs роль) — зависит от отложенного изменения о подключении.
- Хранить ли часовой пояс для `notify_time` — нужно для серверного планировщика уведомлений, вне этой схемы.
