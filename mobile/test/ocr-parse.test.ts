import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpiryDate, parseLabel, parseProductName } from '../src/lib/ocr-parse';

test('дата после подсказки «годен до»', () => {
  assert.equal(parseExpiryDate('Молоко\nгоден до 01.11.2026'), '2026-11-01');
});

test('между датой изготовления и сроком выбирается срок из подсказки', () => {
  const text = 'Изготовлено 01.10.26\nГоден до 01.11.26';
  assert.equal(parseExpiryDate(text), '2026-11-01');
});

test('формат ISO распознаётся как есть', () => {
  assert.equal(parseExpiryDate('Срок годности 2027-01-31'), '2027-01-31');
});

test('без подсказки берётся самая поздняя дата', () => {
  assert.equal(parseExpiryDate('01.10.2026  01.12.2026'), '2026-12-01');
});

test('несуществующая дата не распознаётся', () => {
  assert.equal(parseExpiryDate('годен до 32.13.2026'), null);
});

test('текст без даты не даёт срока', () => {
  assert.equal(parseExpiryDate('Молоко пастеризованное'), null);
});

test('слишком далёкий год не принимается', () => {
  assert.equal(parseExpiryDate('01.01.1899'), null);
});

test('название — первая строка без цифр', () => {
  const text = '01.10.2026\nМОЛОКО ПАСТЕРИЗОВАННОЕ\nгоден до 01.11.2026';
  assert.equal(parseProductName(text), 'МОЛОКО ПАСТЕРИЗОВАННОЕ');
});

test('название не найдено, если во всех строках есть цифры', () => {
  const text = '01.10.2026\nМолоко 3.2%\nГоден до 01.11.2026';
  assert.equal(parseProductName(text), null);
});

test('название не берётся из строки с цифрами', () => {
  assert.equal(parseProductName('1234567890123\nСыр Российский'), 'Сыр Российский');
});

test('разбор целиком', () => {
  const parsed = parseLabel('Кефир\nгоден до 05.11.2026');
  assert.equal(parsed.name, 'Кефир');
  assert.equal(parsed.expiryDate, '2026-11-05');
});
