# Модель данных TrackFresh (PostgreSQL)

Источник истины — миграция [`migrations/0001_init_data_model.sql`](../migrations/0001_init_data_model.sql).
Проверено на `192.168.3.69`, база `mydb`, PostgreSQL 16.15, роль `trackfresh`.

```
users 1 ──── * products
users 1 ──── 1 user_settings
```

## Таблицы

### users

| Колонка | Тип | NULL | По умолчанию |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| email | text | YES | — (UNIQUE) |
| created_at | timestamptz | NO | `now()` |

### products

| Колонка | Тип | NULL | По умолчанию |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — (FK → users.id) |
| name | text | NO | — |
| category | text | NO | — |
| expiry_date | date | NO | — |
| production_date | date | YES | — |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

### user_settings

| Колонка | Тип | NULL | По умолчанию |
|---|---|---|---|
| user_id | uuid | NO | — (PK, FK → users.id) |
| notify_frequency | text | NO | `'daily'` |
| notify_time | time without time zone | NO | `'09:00:00'` |
| warn_days | integer | NO | `3` |

## Ограничения целостности

| Ограничение | Правило |
|---|---|
| `users_email_key` | `email` уникален |
| `products_category_chk` | `category IN ('food','medicine')` |
| `products_dates_order_chk` | `production_date IS NULL OR production_date <= expiry_date` |
| `user_settings_warn_days_chk` | `warn_days >= 0` |
| `products_user_id_fkey` | FK → `users(id) ON DELETE CASCADE` |
| `user_settings_user_id_fkey` | FK → `users(id) ON DELETE CASCADE` |

## Индекс

- `products_owner_expiry_idx (user_id, expiry_date)` — под выборку продуктов владельца, упорядоченную по сроку годности.

## Правила доступа (Row-Level Security)

На `products` и `user_settings` включён RLS и **FORCE ROW LEVEL SECURITY** (действует и для владельца таблиц).

Политики `products_owner_policy` и `user_settings_owner_policy` разрешают строки, где
`user_id = nullif(current_setting('app.user_id', true), '')::uuid`.

Использование:

```sql
SET app.user_id = '<uuid пользователя>';
```

- Без установленного `app.user_id` выборка возвращает 0 строк, а вставка отклоняется (код `42501`).
- Строки другого пользователя не читаются и не изменяются.

## Семантика дат

- `expiry_date`, `production_date` — тип `date` (календарная дата без времени), чтобы исключить сдвиг по часовому поясу.
- `created_at`, `updated_at` — `timestamptz` (момент времени).
- `notify_time` — `time without time zone`; часовой пояс не хранится.

> Внимание для клиентов: некоторые драйверы (в т.ч. `node-postgres`) возвращают значение `date` как JS `Date` в локальной зоне. При проверке продукт с `expiry_date = 2026-11-01` сериализовался в `2026-10-31T21:00:00.000Z` (MSK). Для календарных дат получайте их текстом (например, `to_char(expiry_date, 'YYYY-MM-DD')`) либо парсите строку без времени.

## Открытые вопросы

- Инструмент миграций (raw SQL / Flyway / Prisma и т. п.) — определяется вместе с API-слоем.
- Способ передачи идентичности в `app.user_id` (`SET` vs роль) — зависит от изменения о подключении.
- Хранение часового пояса для `notify_time` — вне текущей схемы.
