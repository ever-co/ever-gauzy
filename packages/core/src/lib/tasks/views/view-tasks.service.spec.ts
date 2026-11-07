/**
 * The tasks of a view: the tree is validated, the ids that no longer exist are taken out and reported, the page is a
 * keyset (or an offset for a manual ordering) with a cursor, the groups are counted on the same filter, the relations
 * are the built-in views' allowlist. The database is doubled: a chainable query builder records what it was asked.
 */
jest.mock('../../core/context', () => ({ RequestContext: { currentTenantId: () => 'ten', currentUserId: () => 'u1' } }));

import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from '../task.entity';
import { TaskViewService } from './view.service';
import { TaskViewTasksService } from './view-tasks.service';
import { decodeCursor } from './view-filters';

const A = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const GONE = '11111111-2222-4333-8444-555555555555';

function fixture(options: { view?: Record<string, unknown>; rows?: Array<{ id: string; createdAt?: string; dueDate?: string | null; title?: string }>; groups?: Array<{ key: string | null; count: number }>; existing?: Record<string, string[]> } = {}) {
	const builder: Record<string, jest.Mock> = {};
	for (const name of ['where', 'andWhere', 'orWhere', 'select', 'addSelect', 'groupBy', 'leftJoin', 'orderBy', 'addOrderBy', 'take', 'setParameter']) builder[name] = jest.fn(() => builder);
	builder.getCount = jest.fn(async () => (options.rows ?? []).length);
	builder.getRawMany = jest.fn(async () => options.groups ?? []);
	builder.getMany = jest.fn(async () => (options.rows ?? []).map((row) => ({ ...row, createdAt: row.createdAt ? new Date(row.createdAt) : undefined, dueDate: row.dueDate ? new Date(row.dueDate) : row.dueDate })));
	const tasks = { createQueryBuilder: jest.fn(() => builder), find: jest.fn(async () => (options.rows ?? []).map((row) => ({ ...row }))) };
	const references = { find: jest.fn(async (criteria: { where: { id: { _value: string[] } } }) => (criteria.where.id._value as string[]).filter((id) => id !== GONE).map((id) => ({ id, name: `name-${id.slice(0, 4)}` }))) };
	const dataSource = { getRepository: (target: unknown) => (target === Task ? tasks : references) } as unknown as DataSource;
	const views = { findOneByIdString: jest.fn(async () => ({ id: 'v1', organizationId: 'org', ...(options.view ?? {}) })) };
	const service = new TaskViewTasksService(dataSource, views as unknown as TaskViewService);
	return { service, builder, tasks, references, views };
}

describe('TaskViewTasksService', () => {
	it('applies the view\'s tree, takes the deleted ids out and reports them, and counts the groups on the same filter', async () => {
		const { service, builder, references } = fixture({
			view: { filterOptions: { filter: { op: 'and', conditions: [{ field: 'status', operator: 'in', values: [A, GONE] }, { field: 'labels', operator: 'isNotEmpty' }, { field: 'colour', operator: 'in', values: [A] }] }, groupBy: 'status' } },
			rows: [{ id: A, createdAt: '2026-11-07T12:00:00.000Z' }],
			groups: [{ key: A, count: 1 }, { key: null, count: 2 }]
		});
		const page = await service.tasksOf('v1', { timeZone: 'Europe/Sofia' });
		expect(references.find).toHaveBeenCalledTimes(2); // the status ids, then the group names
		expect(page.invalidFilters).toEqual([
			{ path: 'filter.conditions.2', field: 'colour', reason: 'unknown-field' },
			{ path: 'filter.conditions.0', field: 'status', reason: 'deleted-reference', values: [GONE] }
		]);
		expect(page.total).toBe(1);
		expect(page.groupBy).toBe('status');
		expect(page.groups).toEqual([{ key: A, label: `name-${A.slice(0, 4)}`, count: 1 }, { key: null, label: null, count: 2 }]);
		expect(page.items.map((task) => task.id)).toEqual([A]);
		expect(page.nextCursor).toBeNull();
		// The tenant and organization bound every query; the tree was applied in brackets.
		expect(builder.where).toHaveBeenCalledWith('task.tenantId = :tenantId', { tenantId: 'ten' });
		expect(builder.andWhere.mock.calls.some((call) => typeof call[0] === 'object')).toBe(true);
		expect(builder.groupBy).toHaveBeenCalledWith('task.taskStatusId');
	});

	it('pages by keyset with a cursor of the last row, and reads the cursor back on the next page', async () => {
		const rows = [
			{ id: A, createdAt: '2026-11-07T12:00:00.000Z' },
			{ id: B, createdAt: '2026-11-07T11:00:00.000Z' },
			{ id: GONE, createdAt: '2026-11-07T10:00:00.000Z' }
		];
		const { service, builder } = fixture({ rows });
		const first = await service.tasksOf('v1', { limit: 2 });
		expect(first.items).toHaveLength(2);
		expect(builder.take).toHaveBeenCalledWith(3);
		expect(decodeCursor(first.nextCursor)).toEqual({ v: '2026-11-07T11:00:00.000Z', id: B });
		await service.tasksOf('v1', { limit: 2, cursor: first.nextCursor as string });
		const seek = builder.andWhere.mock.calls.find((call) => typeof call[0] === 'string' && call[0].includes(':cursorValue'));
		expect(seek?.[1]).toEqual({ cursorValue: new Date('2026-11-07T11:00:00.000Z'), cursorId: B });
		expect(seek?.[0]).toContain('task.createdAt < :cursorValue');
	});

	it('orders a manual view by its order first, pages by offset, and refuses a relation outside the allowlist', async () => {
		const rows = [{ id: A }, { id: B }, { id: GONE }];
		const { service } = fixture({ rows, view: { manualOrder: [GONE, A], filterOptions: { orderBy: { field: 'manual' } } } });
		const first = await service.tasksOf('v1', { limit: 2 });
		expect(first.items.map((task) => task.id)).toEqual([GONE, A]);
		expect(decodeCursor(first.nextCursor)).toEqual({ o: 2 });
		const second = await service.tasksOf('v1', { limit: 2, cursor: first.nextCursor as string });
		expect(second.items.map((task) => task.id)).toEqual([B]);
		expect(second.nextCursor).toBeNull();
		await expect(service.tasksOf('v1', { relations: ['timeLogs'] })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('takes the query\'s filter over the view\'s, and resolves a relative window in the caller\'s zone', async () => {
		const { service, builder } = fixture({ rows: [], view: { filterOptions: { filter: { op: 'and', conditions: [{ field: 'priority', operator: 'isEmpty' }] } } } });
		const page = await service.tasksOf('v1', { filter: { op: 'or', conditions: [{ field: 'dueDate', operator: 'relative', relative: { unit: 'day', direction: 'current' } }] }, timeZone: 'Europe/Sofia' }, new Date('2026-11-07T12:30:00.000Z'));
		expect(page.items).toEqual([]);
		expect(page.invalidFilters).toEqual([]);
		// The bracket was built: its callback ran against a where double and produced the window's bounds.
		const bracket = builder.andWhere.mock.calls.find((call) => typeof call[0] === 'object')?.[0] as { whereFactory: (qb: unknown) => void };
		const inner: Record<string, jest.Mock> = {};
		for (const name of ['where', 'andWhere', 'orWhere']) inner[name] = jest.fn(() => inner);
		bracket.whereFactory(inner);
		expect(inner.where).toHaveBeenCalledWith('task.dueDate >= :f0a AND task.dueDate < :f0b', { f0a: new Date('2026-11-06T22:00:00.000Z'), f0b: new Date('2026-11-07T22:00:00.000Z') });
	});
});
