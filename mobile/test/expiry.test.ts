import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysUntil,
  formatDaysLeft,
  freshness,
  isoDayNumber,
  toDayNumber,
} from '../src/lib/expiry';

test('день срока совпадает с текущим — ноль дней', () => {
  const today = new Date(2026, 10, 1, 23, 30);
  assert.equal(daysUntil('2026-11-01', today), 0);
});

test('часовой пояс не сдвигает календарный день', () => {
  const lateEvening = new Date(2026, 10, 1, 23, 59);
  const earlyMorning = new Date(2026, 10, 1, 0, 1);
  assert.equal(toDayNumber(lateEvening), toDayNumber(earlyMorning));
  assert.equal(isoDayNumber('2026-11-01'), toDayNumber(earlyMorning));
});

test('прошедшая дата — просрочено, независимо от периода предупреждения', () => {
  const today = new Date(2026, 10, 10);
  assert.equal(freshness('2026-11-01', 30, today), 'expired');
});

test('дата внутри периода предупреждения — истекает скоро', () => {
  const today = new Date(2026, 10, 1);
  assert.equal(freshness('2026-11-04', 3, today), 'soon');
  assert.equal(freshness('2026-11-05', 3, today), 'fresh');
});

test('изменение периода предупреждения меняет статус', () => {
  const today = new Date(2026, 10, 1);
  assert.equal(freshness('2026-11-20', 3, today), 'fresh');
  assert.equal(freshness('2026-11-20', 30, today), 'soon');
});

test('текст оставшихся дней', () => {
  const today = new Date(2026, 10, 1);
  assert.equal(formatDaysLeft('2026-11-01', today), 'истекает сегодня');
  assert.equal(formatDaysLeft('2026-11-03', today), 'осталось 2 дн.');
  assert.equal(formatDaysLeft('2026-10-30', today), 'просрочен 2 дн.');
});
