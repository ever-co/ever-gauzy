/**
 * The worked status picks each employee's last log with `DISTINCT ON`, which only Postgres has, and the cases below
 * run that query as Postgres would. The dialect is read from DB_TYPE when the process starts, so it is pinned to
 * Postgres here: under DB_TYPE=mysql, `prepareSQLQuery` quoted the query's columns with backticks.
 */
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ITimerStatus, TimeLogType } from '@gauzy/contracts';
import { FindOperator } from 'typeorm';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimerService } from './timer.service';

/**
 * The MikroORM branch of `getTimerWorkedStatus` picks each employee's last log with raw knex
 * (`DISTINCT ON ("employeeId")`), which skips the soft-delete filter. When that last log was deleted, the
 * follow-up `find()` (which does filter deleted rows) returned nothing and the employee vanished from the
 * result, instead of falling back to their previous log as the TypeORM branch does.
 */
describe('TimerService.getTimerWorkedStatus (MikroORM)', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as never });

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		// An employee without CHANGE_SELECTED_EMPLOYEE / ORG_MEMBER_LAST_LOG_VIEW only sees their own status
		jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(false);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('never picks a soft-deleted time log as the last log', async () => {
		const builder: Record<string, jest.Mock> = {};
		for (const method of ['select', 'whereNotNull', 'whereNull', 'whereIn', 'andWhere', 'orderBy']) {
			builder[method] = jest.fn(() => builder);
		}
		builder.toString = jest.fn(() => 'select ...');
		const knex = Object.assign(
			jest.fn(() => builder),
			{
				raw: jest.fn((sql: string) =>
					sql === 'select ...' ? Promise.resolve({ rows: [{ id: 'log-1' }] }) : sql
				)
			}
		);
		const find = jest.fn().mockResolvedValue([]);

		await TimerService.prototype.getTimerWorkedStatus.call(
			{
				ormType: MultiORMEnum.MikroORM,
				typeOrmTimeLogRepository: {},
				mikroOrmTimeLogRepository: { getKnex: () => knex, find }
			},
			{ organizationId: fixture.organizationId }
		);

		expect(knex).toHaveBeenCalledWith('time_log');
		expect(builder.whereNull).toHaveBeenCalledWith('deletedAt');
		expect(builder.whereIn).toHaveBeenCalledWith('employeeId', ['employee-1']);
		expect(find).toHaveBeenCalledWith({ id: { $in: ['log-1'] } }, expect.anything());
	});
});

/** A time log of the in-memory table the queries below read. */
interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	isActive: boolean;
	isArchived: boolean;
	isRunning: boolean | null;
	startedAt: Date;
	stoppedAt: Date;
	createdAt: Date;
	deletedAt: Date | null;
	logType?: TimeLogType;
	duration?: number;
}

/** An ORDER BY item as either branch builds it. */
interface OrderItem {
	expression: string;
	order: string;
	nulls?: string;
}

/** The column an expression names: `"time_log"."startedAt"`, or `startedAt` as knex takes it. */
function columnOf(expression: string): keyof TimeLogRow {
	const column = /^(?:"time_log"\.)?"?(\w+)"?$/.exec(expression)?.[1];
	if (!column) {
		throw new Error(`Unexpected expression: ${expression}`);
	}
	return column as keyof TimeLogRow;
}

/** A row's value for a column or for `COALESCE(<column>, false)`; any other expression fails the spec. */
function valueOf(row: TimeLogRow, expression: string): unknown {
	const coalesced = /^COALESCE\((.+), false\)$/i.exec(expression);
	if (coalesced) {
		return valueOf(row, coalesced[1]) ?? false;
	}
	return row[columnOf(expression)];
}

/**
 * Compares two values as Postgres orders them: false before true, and NULL above any value, so first in DESC and
 * last in ASC unless the item says NULLS FIRST or NULLS LAST.
 */
function comparePostgres(a: unknown, b: unknown, { order, nulls }: OrderItem): number {
	const descending = /^desc$/i.test(order);
	const nullsFirst = nulls ? /first/i.test(nulls) : descending;
	const aIsNull = a === null || a === undefined;
	const bIsNull = b === null || b === undefined;
	if (aIsNull || bIsNull) {
		if (aIsNull && bIsNull) {
			return 0;
		}
		return aIsNull === nullsFirst ? -1 : 1;
	}
	const rank = (value: unknown): number | string =>
		value instanceof Date ? value.getTime() : typeof value === 'boolean' ? Number(value) : String(value);
	const [x, y] = [rank(a), rank(b)];
	const ascending = x < y ? -1 : x > y ? 1 : 0;
	return descending ? -ascending : ascending;
}

/**
 * `SELECT DISTINCT ON (<column>) ... ORDER BY <orders>` over `rows`, as Postgres runs it: the rows in that order, the
 * first of each group kept. Postgres refuses an ORDER BY that does not start with the DISTINCT ON column.
 */
function selectDistinctOn(rows: TimeLogRow[], distinctOn: string, orders: OrderItem[]): TimeLogRow[] {
	if (columnOf(orders[0].expression) !== columnOf(distinctOn)) {
		throw new Error('SELECT DISTINCT ON expressions must match initial ORDER BY expressions');
	}
	const sorted = [...rows].sort((a, b) => {
		for (const item of orders) {
			const result = comparePostgres(valueOf(a, item.expression), valueOf(b, item.expression), item);
			if (result !== 0) {
				return result;
			}
		}
		return 0;
	});
	const firstOfEach = new Map<unknown, TimeLogRow>();
	for (const row of sorted) {
		const group = valueOf(row, distinctOn);
		if (!firstOfEach.has(group)) {
			firstOfEach.set(group, row);
		}
	}
	return [...firstOfEach.values()];
}

/** Applies the `where` of the TypeORM branch: plain values, `In`, `Not(IsNull())`. */
function matchesTypeOrmWhere(row: TimeLogRow, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => {
		const value = row[key as keyof TimeLogRow];
		if (!(condition instanceof FindOperator)) {
			return value === condition;
		}
		if (condition.type === 'in') {
			return (condition.value as unknown as unknown[]).includes(value);
		}
		if (condition.type === 'not' && condition.child?.type === 'isNull') {
			return value !== null && value !== undefined;
		}
		throw new Error(`Unexpected TypeORM operator "${condition.type}" on ${key}`);
	});
}

/** The TypeORM repository over `rows`: its query builder records the query and runs it as Postgres would. */
function typeOrmRepositoryOver(rows: TimeLogRow[]) {
	return {
		metadata: undefined,
		createQueryBuilder: (alias: string) => {
			let where: Record<string, unknown> = {};
			let distinctOn = '';
			const orders: OrderItem[] = [];
			const query = {
				alias,
				setFindOptions: () => query,
				where: (conditions: Record<string, unknown>) => {
					where = conditions;
					return query;
				},
				orderBy: (expression: string, order: string, nulls?: string) => {
					orders.splice(0, orders.length, { expression, order, nulls });
					return query;
				},
				addOrderBy: (expression: string, order: string, nulls?: string) => {
					orders.push({ expression, order, nulls });
					return query;
				},
				distinctOn: ([expression]: string[]) => {
					distinctOn = expression;
					return query;
				},
				// TypeORM leaves soft-deleted rows out of its queries
				getMany: async () =>
					selectDistinctOn(
						rows.filter((row) => row.deletedAt === null && matchesTypeOrmWhere(row, where)),
						distinctOn,
						orders
					)
			};
			return query;
		}
	};
}

/** The MikroORM repository over `rows`: its knex records the query, and `raw` runs it as Postgres would. */
function mikroOrmRepositoryOver(rows: TimeLogRow[]) {
	const printed = 'select ...';
	const conditions: Array<(row: TimeLogRow) => boolean> = [];
	const orders: OrderItem[] = [];
	let distinctOn = '';
	const valueIn = (row: TimeLogRow, column: string) => row[column as keyof TimeLogRow];
	const builder = {
		select: (expression: string) => {
			distinctOn = /^DISTINCT ON \((.+)\) \*$/.exec(expression)[1];
			return builder;
		},
		whereNotNull: (column: string) => {
			conditions.push((row) => valueIn(row, column) !== null && valueIn(row, column) !== undefined);
			return builder;
		},
		whereNull: (column: string) => {
			conditions.push((row) => valueIn(row, column) === null || valueIn(row, column) === undefined);
			return builder;
		},
		whereIn: (column: string, values: unknown[]) => {
			conditions.push((row) => values.includes(valueIn(row, column)));
			return builder;
		},
		andWhere: (values: Record<string, unknown>) => {
			conditions.push((row) => Object.entries(values).every(([column, value]) => valueIn(row, column) === value));
			return builder;
		},
		orderBy: (items: Array<{ column: string; order: string; nulls?: string }>) => {
			orders.push(...items.map(({ column, order, nulls }) => ({ expression: column, order, nulls })));
			return builder;
		},
		toString: () => printed
	};
	// `raw` makes an expression (its SQL stands for it here) or runs the query the builder printed
	const raw = (sql: string) =>
		sql === printed
			? Promise.resolve({
					rows: selectDistinctOn(
						rows.filter((row) => conditions.every((matches) => matches(row))),
						distinctOn,
						orders
					)
				})
			: sql;
	return {
		getKnex: () => Object.assign(() => builder, { raw }),
		// The logs found by id, as MikroORM loads them: `wrapSerialize` calls their `toJSON`
		find: async ({ id }: { id: { $in: string[] } }) =>
			rows
				.filter((row) => id.$in.includes(row.id) && row.deletedAt === null)
				.map((row) => ({ ...row, toJSON: () => ({ ...row }) }))
	};
}

/**
 * The worked status picked each employee's latest-started log, running or not. A completed log that starts after the
 * running one (manual time with future dates allowed, a desktop offline upload) was returned instead, and Ever Teams
 * showed a running timer as stopped to the team. The running log now comes first, else the latest log as before.
 *
 * Both branches run their `DISTINCT ON` query over an in-memory table, with Postgres' ordering (no Postgres here).
 */
describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService.getTimerWorkedStatus returning the running log (%s)',
	(ormType) => {
		const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as never });
		const NOW = new Date('2026-10-24T10:30:00.000Z');

		/** A completed log of employee-1 unless `overrides` say otherwise. */
		const log = (
			overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>
		): TimeLogRow => ({
			employeeId: 'employee-1',
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			isActive: true,
			isArchived: false,
			isRunning: false,
			createdAt: overrides.startedAt,
			deletedAt: null,
			...overrides
		});

		/** The run going since 08:00, its `stoppedAt` moved forward by its time slots. */
		const running = () =>
			log({
				id: 'running',
				isRunning: true,
				startedAt: new Date('2026-10-24T08:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:25:00.000Z')
			});

		const workedStatus = (rows: TimeLogRow[], request: object = {}): Promise<ITimerStatus[]> =>
			TimerService.prototype.getTimerWorkedStatus.call(
				{
					ormType,
					typeOrmTimeLogRepository: typeOrmRepositoryOver(rows),
					mikroOrmTimeLogRepository: mikroOrmRepositoryOver(rows)
				},
				{ organizationId: fixture.organizationId, ...request }
			);

		let restore: () => void;

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
			jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(false);
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		it('returns the running log of an employee who also has a completed log that starts later', async () => {
			const manualLater = log({
				id: 'manual-later',
				startedAt: new Date('2026-10-24T10:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T11:00:00.000Z')
			});

			const [status, ...others] = await workedStatus([running(), manualLater]);

			expect(others).toEqual([]);
			expect(status).toMatchObject({ running: true, timerStatus: 'running', lastLog: { id: 'running' } });
		});

		it('keeps a break as the last log, with no worked duration, and a work log with its own', async () => {
			const lunch = log({
				id: 'lunch',
				logType: TimeLogType.BREAK,
				duration: 3600,
				startedAt: new Date('2026-10-24T09:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:00:00.000Z')
			});
			const work = { ...lunch, id: 'work', logType: TimeLogType.TRACKED };

			const [onBreak] = await workedStatus([lunch]);
			const [atWork] = await workedStatus([work]);

			expect(onBreak).toMatchObject({ lastLog: { id: 'lunch' }, duration: 0, running: false });
			expect(atWork).toMatchObject({ lastLog: { id: 'work' }, duration: 3600 });
		});

		it('shows an employee on a running break as paused, not tracking, with the break as the last log', async () => {
			const coffee = log({
				id: 'coffee',
				logType: TimeLogType.BREAK,
				isRunning: true,
				startedAt: new Date('2026-10-24T10:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:00:00.000Z')
			});

			const [onBreak] = await workedStatus([coffee]);

			expect(onBreak).toMatchObject({
				lastLog: { id: 'coffee', isRunning: true },
				duration: 0,
				running: false,
				timerStatus: 'pause'
			});
		});

		it('still returns the latest log of an employee with no running log', async () => {
			const earlier = log({
				id: 'earlier',
				startedAt: new Date('2026-10-24T07:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T08:00:00.000Z')
			});
			const latest = log({
				id: 'latest',
				startedAt: new Date('2026-10-24T09:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:00:00.000Z')
			});

			const [status] = await workedStatus([earlier, latest]);

			expect(status).toMatchObject({ running: false, lastLog: { id: 'latest' } });
		});

		it('counts a log stored without the running flag as not running, beside a running log', async () => {
			const unflaggedLater = log({
				id: 'unflagged-later',
				isRunning: null,
				startedAt: new Date('2026-10-24T10:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:20:00.000Z')
			});

			const [status] = await workedStatus([running(), unflaggedLater]);

			expect(status).toMatchObject({ running: true, lastLog: { id: 'running' } });
		});

		it('counts a log stored without the running flag as not running, so the latest log still wins', async () => {
			const unflaggedEarlier = log({
				id: 'unflagged-earlier',
				isRunning: null,
				startedAt: new Date('2026-10-24T07:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T08:00:00.000Z')
			});
			const latest = log({
				id: 'latest',
				startedAt: new Date('2026-10-24T09:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:00:00.000Z')
			});

			const [status] = await workedStatus([unflaggedEarlier, latest]);

			expect(status).toMatchObject({ running: false, lastLog: { id: 'latest' } });
		});

		it('gives each employee of a team view their own log, the running one when it runs', async () => {
			jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(true);
			const teammateEarlier = log({
				id: 'teammate-earlier',
				employeeId: 'employee-2',
				startedAt: new Date('2026-10-24T07:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T08:00:00.000Z')
			});
			const teammateLatest = log({
				id: 'teammate-latest',
				employeeId: 'employee-2',
				startedAt: new Date('2026-10-24T10:10:00.000Z'),
				stoppedAt: new Date('2026-10-24T10:20:00.000Z')
			});
			const manualLater = log({
				id: 'manual-later',
				startedAt: new Date('2026-10-24T10:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T11:00:00.000Z')
			});

			const statuses = await workedStatus([running(), manualLater, teammateEarlier, teammateLatest], {
				employeeIds: ['employee-1', 'employee-2']
			});

			const lastLogOf = (employeeId: string) =>
				statuses.find((status) => status.lastLog.employeeId === employeeId)?.lastLog.id;
			expect(statuses).toHaveLength(2);
			expect(lastLogOf('employee-1')).toBe('running');
			expect(lastLogOf('employee-2')).toBe('teammate-latest');
		});
	}
);
