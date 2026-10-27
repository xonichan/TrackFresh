-- 0001_init_data_model.sql
-- TrackFresh — каноническая реляционная модель данных (PostgreSQL).
-- См. openspec/changes/define-postgres-data-model/design.md

-- Пользователи
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Продукты и лекарства
CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL,
  expiry_date     date NOT NULL,
  production_date date NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_category_chk CHECK (category IN ('food', 'medicine')),
  CONSTRAINT products_dates_order_chk CHECK (production_date IS NULL OR production_date <= expiry_date)
);

CREATE INDEX products_owner_expiry_idx ON products (user_id, expiry_date);

-- Настройки уведомлений пользователя
CREATE TABLE user_settings (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_frequency text NOT NULL DEFAULT 'daily',
  notify_time      time NOT NULL DEFAULT '09:00',
  warn_days        integer NOT NULL DEFAULT 3,
  CONSTRAINT user_settings_warn_days_chk CHECK (warn_days >= 0)
);

-- Разграничение доступа: строка видна и изменяема только её владельцу.
-- Идентичность передаётся в сессию через app.user_id.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY products_owner_policy ON products
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY user_settings_owner_policy ON user_settings
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
