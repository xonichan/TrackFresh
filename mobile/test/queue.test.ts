import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLocal,
  classifyOutcome,
  compact,
  enqueue,
  isLocalNewer,
  serverAheadBeyondSkew,
  type QueueOp,
} from '../src/lib/queue';
import type { Product } from '../src/api/types';

const at = (hour: number) => `2026-10-28T${String(hour).padStart(2, '0')}:00:00.000Z`;

const draft = {
  name: 'Молоко',
  category: 'food' as const,
  expiryDate: '2026-11-01',
  productionDate: null,
};

const create: QueueOp = { op: 'create', productId: 'p1', at: at(10), draft };
const update: QueueOp = { op: 'update', productId: 'p1', at: at(11), draft: { ...draft, name: 'Молоко 1%' } };
const remove: QueueOp = { op: 'delete', productId: 'p1', at: at(12) };

test('операции сохраняют порядок', () => {
  const queue = enqueue(enqueue([], create), { op: 'update', productId: 'p2', at: at(11), draft });
  assert.deepEqual(
    queue.map((item) => item.productId),
    ['p1', 'p2'],
  );
});

test('create + update схлопываются в create с новыми полями', () => {
  const queue = compact([create, update]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.op, 'create');
  assert.equal(queue[0]!.draft?.name, 'Молоко 1%');
  assert.equal(queue[0]!.at, at(11));
});

test('create + delete убирают продукт из очереди целиком', () => {
  assert.deepEqual(compact([create, update, remove]), []);
});

test('update + delete оставляют только delete', () => {
  const queue = compact([update, remove]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.op, 'delete');
});

test('несколько update оставляют последний', () => {
  const later = { ...update, at: at(13), draft: { ...draft, name: 'Молоко 3%' } };
  const queue = compact([update, later]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.draft?.name, 'Молоко 3%');
});

test('операции по разным продуктам не смешиваются', () => {
  const other: QueueOp = { op: 'delete', productId: 'p2', at: at(12) };
  const queue = compact([create, other]);
  assert.equal(queue.length, 2);
});

test('локальное создание сразу появляется в списке', () => {
  const products = applyLocal([], create, at(10));
  assert.equal(products.length, 1);
  assert.equal(products[0]!.id, 'p1');
  assert.equal(products[0]!.updated_at, at(10));
});

test('локальное изменение и удаление применяются', () => {
  const existing: Product = {
    id: 'p1',
    name: 'Молоко',
    category: 'food',
    expiry_date: '2026-11-01',
    production_date: null,
    updated_at: at(9),
  };

  const changed = applyLocal([existing], update, at(11));
  assert.equal(changed[0]!.name, 'Молоко 1%');

  assert.deepEqual(applyLocal([existing], remove, at(12)), []);
});

test('ответы «уже так на сервере» считаются выполнением', () => {
  assert.equal(classifyOutcome(update, 404), 'done');
  assert.equal(classifyOutcome(remove, 404), 'done');
  assert.equal(classifyOutcome(create, 409), 'done');
  assert.equal(classifyOutcome(create, 201), 'done');
});

test('ошибки проверки снимают операцию, сеть и 5xx остаются на повтор', () => {
  assert.equal(classifyOutcome(update, 422), 'failed');
  assert.equal(classifyOutcome(create, 400), 'failed');
  assert.equal(classifyOutcome(update, 0), 'retry');
  assert.equal(classifyOutcome(update, 500), 'retry');
  assert.equal(classifyOutcome(update, 401), 'retry');
});

test('побеждает последнее изменение', () => {
  assert.equal(isLocalNewer(at(11), at(10)), true);
  assert.equal(isLocalNewer(at(10), at(11)), false);
  assert.equal(isLocalNewer(at(10), null), true);
});

test('заметное расхождение часов распознаётся', () => {
  // Сервер на 10 минут впереди локального изменения — это не задержка, а разница часов.
  assert.equal(serverAheadBeyondSkew(at(10), '2026-10-28T10:10:00.000Z'), true);
  // Сервер впереди на минуту — считаем обычной задержкой.
  assert.equal(serverAheadBeyondSkew(at(10), '2026-10-28T10:01:00.000Z'), false);
  assert.equal(serverAheadBeyondSkew(at(10), null), false);
});
