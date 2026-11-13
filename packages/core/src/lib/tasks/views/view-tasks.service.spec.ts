/**
 * The tasks of a view: the tree is validated, the ids that no longer exist are taken out and reported at the place the
 * caller wrote them, the page is a keyset (or an offset for a manual ordering) with a cursor that names a row, the
 * groups are counted on the same filter, the relations are the built-in views' allowlist. The database is doubled:
 * every query builder records what it was asked, and the dialect's quoting is doubled so a raw identifier is seen
 * to pass through it.
 */
jest.mock('../../core/context', () => ({ RequestContext: { currentTenantId: () => 'ten', currentUserId: () => 'u1' } }));
jest.mock('../../database/database.helper', () => ({ quoteIdentifier: (identifier: string) => `[${identifier}]` }));

import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from '../task.entity';
import { TaskViewService } from './view.service';
import { TaskViewTasksService } from './view-tasks.service';
import { decodeCursor, encodeCursor } from './view-filters';

const A = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const C = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
const GONE = '11111111-2222-4333-8444-555555555555';

interface IRow {
	id: string;
	createdAt?: string;
	dueDate?: string | null;
	title?: string;
}

type Builder = Record<string, jest.Mock>;

/** Every query builder the service asked for, each with its own record; `calls` reads one method across all of them. */
function fixture(options: { view?: Record<string, unknown>; rows?: IRow[]; groups?: Array<{ key: string | null; count: number }> } = {}) {
	const rows = options.rows ?? [];
	const asEntity = (row: IRow) => ({ ...row, createdAt: row.createdAt ? new Date(row.createdAt) : undefined, dueDate: row.dueDate ? new Date(row.dueDate) : row.dueDate });
	const builders: Builder[] = [];
	const makeBuilder = (): Builder => {
		const builder: Builder = {};
		for (const name of ['where', 'andWhere', 'orWhere', 'select', 'addSelect', 'groupBy', 'leftJoin', 'orderBy', 'addOrderBy', 'take', 'setParameter']) builder[name] = jest.fn(() => builder);
		builder.getCount = jest.fn(async () => rows.length);
		builder.getRawMany = jest.fn(async () => options.groups ?? []);
		// The two membership reads of a manual ordering are honoured: `IN` keeps the named ids, `NOT IN` drops them.
		builder.getMany = jest.fn(async () => {
			const named = builder.andWhere.mock.calls.find((call) => typeof call[0] === 'string' && call[0].includes('task.id IN (:...ordered)'));
			const excluded = builder.andWhere.mock.calls.find((call) => typeof call[0] === 'string' && call[0].includes('task.id NOT IN (:...ordered)'));
			return rows
				.filter((row) => (named ? (named[1].ordered as string[]).includes(row.id) : true))
				.filter((row) => (excluded ? !(excluded[1].ordered as string[]).includes(row.id) : true))
				.map(asEntity);
		});
		builders.push(builder);
		return builder;
	};
	const tasks = {
		createQueryBuilder: jest.fn(() => makeBuilder()),
		find: jest.fn(async () => rows.map((row) => ({ ...row }))),
		findOne: jest.fn(async (criteria: { where: { id: string } }) => {
			const row = rows.find((candidate) => candidate.id === criteria.where.id);
			return row ? asEntity(row) : null;
		})
	};
	const references = { find: jest.fn(async (criteria: { where: { id: { _value: string[] } } }) => (criteria.where.id._value as string[]).filter((id) => id !== GONE).map((id) => ({ id, name: `name-${id.slice(0, 4)}` }))) };
	const dataSource = { getRepository: (target: unknown) => (target === Task ? tasks : references) } as unknown as DataSource;
	const views = { findOneByIdString: jest.fn(async () => ({ id: 'v1', organizationId: 'org', ...(options.view ?? {}) })) };
	const service = new TaskViewTasksService(dataSource, views as unknown as TaskViewService);
	const calls = (name: string) => builders.flatMap((builder) => builder[name].mock.calls);
	return { service, builders, calls, tasks, references, views };
}

/** The where double a bracket's callback is run against, and what it was told. */
function runBracket(bracket: unknown): Record<string, jest.Mock> {
	const inner: Record<string, jest.Mock> = {};
	for (const name of ['where', 'andWhere', 'orWhere']) inner[name] = jest.fn(() => inner);
	// A query that built no bracket fails here, by name, not on a property of `undefined`.
	if (!bracket || typeof bracket !== 'object') throw new Error('the query passed no bracket to andWhere');
	(bracket as { whereFactory: (qb: unknown) => void }).whereFactory(inner);
	return inner;
}

describe('TaskViewTasksService', () => {
	it('applies the view\'s tree, takes the deleted ids out and reports them, and counts the groups on the same filter', async () => {
		const { service, calls, references } = fixture({
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
		expect(calls('where')).toContainEqual(['task.tenantId = :tenantId', { tenantId: 'ten' }]);
		expect(calls('andWhere').some((call) => typeof call[0] === 'object')).toBe(true);
		expect(calls('groupBy')).toContainEqual(['task.taskStatusId']);
	});

	it('reports a deleted reference at the place the caller wrote it, after a condition dropped before it', async () => {
		const { service } = fixture({
			rows: [],
			view: { filterOptions: { filter: { op: 'and', conditions: [{ field: 'colour', operator: 'in', values: [A] }, { field: 'labels', operator: 'in', values: [GONE, B] }] } } }
		});
		const page = await service.tasksOf('v1', {});
		expect(page.invalidFilters).toEqual([
			{ path: 'filter.conditions.0', field: 'colour', reason: 'unknown-field' },
			{ path: 'filter.conditions.1', field: 'labels', reason: 'deleted-reference', values: [GONE] }
		]);
	});

	it('names the join tables and their columns through the dialect\'s quoting, in the memberships and the group counts', async () => {
		const { service, calls } = fixture({
			rows: [],
			groups: [],
			view: { filterOptions: { filter: { op: 'and', conditions: [{ field: 'labels', operator: 'in', values: [A] }, { field: 'assignees', operator: 'isEmpty' }] }, groupBy: 'team' } }
		});
		await service.tasksOf('v1', {});
		const inner = runBracket(calls('andWhere').find((call) => typeof call[0] === 'object')?.[0]);
		expect(inner.where).toHaveBeenCalledWith('EXISTS (SELECT 1 FROM [tag_task] [f0m] WHERE [f0m].[taskId] = task.id AND [f0m].[tagId] IN (:...f0))', { f0: [A] });
		expect(inner.andWhere).toHaveBeenCalledWith('NOT EXISTS (SELECT 1 FROM [task_employee] [f1m] WHERE [f1m].[taskId] = task.id)', undefined);
		expect(calls('leftJoin')).toContainEqual(['task_team', 'g', '[g].[taskId] = task.id']);
		expect(calls('groupBy')).toContainEqual(['[g].[organizationTeamId]']);
	});

	it('pages by keyset with a cursor that names the last row, and seeks past that row on the next page', async () => {
		const rows = [
			{ id: A, createdAt: '2026-11-07T12:00:00.000Z' },
			{ id: B, createdAt: '2026-11-07T11:00:00.000Z' },
			{ id: GONE, createdAt: '2026-11-07T10:00:00.000Z' }
		];
		const { service, calls, tasks } = fixture({ rows });
		const first = await service.tasksOf('v1', { limit: 2 });
		expect(first.items).toHaveLength(2);
		expect(calls('take')).toContainEqual([3]);
		expect(decodeCursor(first.nextCursor)).toEqual({ id: B });
		await service.tasksOf('v1', { limit: 2, cursor: first.nextCursor as string });
		// The row is read back by the cursor's id within the tenant (the stale check); the seek compares against its stored
		// value in the database, at the store's own precision.
		expect(tasks.findOne).toHaveBeenCalledWith({ select: { id: true, createdAt: true }, where: { id: B, tenantId: 'ten' } });
		const anchor = '(SELECT [a].[createdAt] FROM [task] [a] WHERE [a].[id] = :cursorId)';
		const seek = calls('andWhere').find((call) => typeof call[0] === 'string' && call[0].includes(':cursorId'));
		expect(seek?.[0]).toBe(`(task.createdAt < ${anchor} OR (task.createdAt = ${anchor} AND task.id < :cursorId))`);
		expect(seek?.[1]).toEqual({ cursorId: B });
		expect(calls('orderBy')).toContainEqual(['task.createdAt', 'DESC']);
	});

	it('refuses a cursor whose row is no longer there, rather than starting over or guessing', async () => {
		const { service } = fixture({ rows: [{ id: A }] });
		await expect(service.tasksOf('v1', { cursor: encodeCursor({ id: GONE }) })).rejects.toMatchObject({ message: expect.stringContaining('TASK_VIEW_CURSOR_STALE') });
	});

	it('sorts the tasks without a due date last in both directions, and seeks the same way past a dated and an undated row', async () => {
		const rows = [
			{ id: A, dueDate: '2026-11-10T00:00:00.000Z' },
			{ id: B, dueDate: null },
			{ id: C, dueDate: '2026-11-09T00:00:00.000Z' }
		];
		const { service, calls } = fixture({ rows, view: { filterOptions: { orderBy: { field: 'dueDate', direction: 'desc' } } } });
		await service.tasksOf('v1', {});
		expect(calls('orderBy')).toContainEqual(['CASE WHEN task.dueDate IS NULL THEN 1 ELSE 0 END', 'ASC']);
		expect(calls('addOrderBy')).toContainEqual(['task.dueDate', 'DESC']);
		// Past a dated row: the earlier dated rows, then every undated one.
		await service.tasksOf('v1', { cursor: encodeCursor({ id: A }) });
		const anchor = '(SELECT [a].[dueDate] FROM [task] [a] WHERE [a].[id] = :cursorId)';
		const dated = calls('andWhere').find((call) => typeof call[0] === 'string' && call[0].includes('IS NOT NULL AND'));
		expect(dated?.[0]).toBe(`((task.dueDate IS NOT NULL AND (task.dueDate < ${anchor} OR (task.dueDate = ${anchor} AND task.id < :cursorId))) OR task.dueDate IS NULL)`);
		expect(dated?.[1]).toEqual({ cursorId: A });
		// Past an undated row: only the undated rows after it.
		await service.tasksOf('v1', { cursor: encodeCursor({ id: B }) });
		const undated = calls('andWhere').find((call) => typeof call[0] === 'string' && call[0].includes('IS NULL AND task.id'));
		expect(undated?.[0]).toBe('(task.dueDate IS NULL AND task.id < :cursorId)');
		expect(undated?.[1]).toEqual({ cursorId: B });
	});

	it('orders a manual view by its order first — whatever the tasks\' age — then the newest of the rest, pages by offset, and refuses a relation outside the allowlist', async () => {
		const rows = [{ id: A, createdAt: '2026-11-07T12:00:00.000Z' }, { id: B, createdAt: '2026-11-07T11:00:00.000Z' }, { id: GONE, createdAt: '2020-01-01T00:00:00.000Z' }];
		const { service, calls } = fixture({ rows, view: { manualOrder: [GONE, A], filterOptions: { orderBy: { field: 'manual' } } } });
		const first = await service.tasksOf('v1', { limit: 2 });
		expect(first.items.map((task) => task.id)).toEqual([GONE, A]);
		expect(decodeCursor(first.nextCursor)).toEqual({ o: 2 });
		// The ordered tasks are read by their ids, not from the newest page; the rest are read without them.
		expect(calls('andWhere')).toContainEqual(['task.id IN (:...ordered)', { ordered: [GONE, A] }]);
		expect(calls('andWhere')).toContainEqual(['task.id NOT IN (:...ordered)', { ordered: [GONE, A] }]);
		const second = await service.tasksOf('v1', { limit: 2, cursor: first.nextCursor as string });
		expect(second.items.map((task) => task.id)).toEqual([B]);
		expect(second.nextCursor).toBeNull();
		await expect(service.tasksOf('v1', { relations: ['timeLogs'] })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('takes the query\'s filter over the view\'s, and resolves a relative window in the caller\'s zone', async () => {
		const { service, calls } = fixture({ rows: [], view: { filterOptions: { filter: { op: 'and', conditions: [{ field: 'priority', operator: 'isEmpty' }] } } } });
		const page = await service.tasksOf('v1', { filter: { op: 'or', conditions: [{ field: 'dueDate', operator: 'relative', relative: { unit: 'day', direction: 'current' } }] }, timeZone: 'Europe/Sofia' }, new Date('2026-11-07T12:30:00.000Z'));
		expect(page.items).toEqual([]);
		expect(page.invalidFilters).toEqual([]);
		// The bracket was built: its callback ran against a where double and produced the window's bounds.
		const inner = runBracket(calls('andWhere').find((call) => typeof call[0] === 'object')?.[0]);
		expect(inner.where).toHaveBeenCalledWith('task.dueDate >= :f0a AND task.dueDate < :f0b', { f0a: new Date('2026-11-06T22:00:00.000Z'), f0b: new Date('2026-11-07T22:00:00.000Z') });
	});

	it('compares a due date that is a date only by the day picked, and leaves the other date fields and old views on their instants', async () => {
		const { service, calls } = fixture({ rows: [] });
		// "Due on or after 14 Nov" and "created on or after 14 Nov", each picked in UTC−4, then the same due date saved without its day.
		const picked = { operator: 'after', from: '2026-11-14T04:00:00.000Z', fromDay: '2026-11-14' } as const;
		await service.tasksOf('v1', { filter: { op: 'or', conditions: [{ field: 'dueDate', ...picked }, { field: 'createdAt', ...picked }, { field: 'dueDate', operator: 'after', from: picked.from }] } });
		const inner = runBracket(calls('andWhere').find((call) => typeof call[0] === 'object')?.[0]);
		expect(inner.where).toHaveBeenCalledWith('(task.dueDate > :f0 OR task.dueDate = :f0d0)', { f0: new Date(picked.from), f0d0: new Date('2026-11-14T00:00:00.000Z') });
		expect(inner.orWhere).toHaveBeenCalledWith('task.createdAt > :f1', { f1: new Date(picked.from) });
		expect(inner.orWhere).toHaveBeenCalledWith('task.dueDate > :f2', { f2: new Date(picked.from) });
	});

	it('takes "due today" in UTC−4 to hold today\'s date-only due date and not tomorrow\'s', async () => {
		const { service, calls } = fixture({ rows: [] });
		// 14 Nov, 15:00 in Caracas: today runs from 04:00 UTC to 04:00 UTC the next day.
		await service.tasksOf('v1', { filter: { op: 'and', conditions: [{ field: 'dueDate', operator: 'relative', relative: { unit: 'day', direction: 'current' } }] }, timeZone: 'America/Caracas' }, new Date('2026-11-14T19:00:00.000Z'));
		const inner = runBracket(calls('andWhere').find((call) => typeof call[0] === 'object')?.[0]);
		expect(inner.where).toHaveBeenCalledWith('(task.dueDate >= :f0a OR task.dueDate = :f0ad0) AND (task.dueDate < :f0b AND task.dueDate <> :f0bx0)', {
			f0a: new Date('2026-11-14T04:00:00.000Z'),
			f0ad0: new Date('2026-11-14T00:00:00.000Z'),
			f0b: new Date('2026-11-15T04:00:00.000Z'),
			f0bx0: new Date('2026-11-15T00:00:00.000Z')
		});
	});
});
