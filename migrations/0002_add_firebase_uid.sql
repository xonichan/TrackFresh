-- 0002_add_firebase_uid.sql
-- Привязка профиля пользователя к учётной записи Firebase Authentication.
-- См. openspec/changes/adapt-user-data-sync-to-postgres/design.md
--
-- Firebase UID — строка (обычно 28 символов), не UUID, поэтому хранится
-- отдельным текстовым полем; users.id остаётся суррогатным uuid.

ALTER TABLE users
  ADD COLUMN firebase_uid text NOT NULL UNIQUE;
