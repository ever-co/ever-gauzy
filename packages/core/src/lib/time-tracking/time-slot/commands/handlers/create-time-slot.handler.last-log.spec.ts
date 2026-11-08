import '../../../../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { CreateTimeSlotHandler } from './create-time-slot.handler';

/**
 * A new slot is attached to the employee's newest stopped log of the same source and type. That lookup orders by
 * `createdAt` and reads its answer through `getOneOrFail`, which keeps the first row of whatever the query returns:
 * without a row limit Postgres handed back every stopped log of the employee (2,194 rows per call on production,
 * 12.4 M rows in a month) for the one that was used. The query now asks for one row.
 */
describe('CreateTimeSlotHandler last stopped log', () => {
	const TENANT = 'tenant-own';
	const ORGANIZATION = 'org-own';
	const EMPLOYEE = 'employee-own';
	const LAST_LOG = { id: 'log-newest', employeeId: EMPLOYEE, source: 'DESKTOP', logType: 'TRACKED' };

	let saved: any[];
	let logLookups: Array<Array<unknown[]>>;
	let handler: CreateTimeSlotHandler;

	/** A query builder that records its calls; `getOneOrFail` answers `row`, or misses when there is none. */
	const recording = (calls: unknown[][], row?: unknown) => {
		const record =
			(name: string) =>
			(...args: unknown[]) => {
				calls.push([name, ...args]);
				return query;
			};
		const query: any = {
			alias: 'q',
			leftJoinAndSelect: record('leftJoinAndSelect'),
			where: record('where'),
			andWhere: record('andWhere'),
			addOrderBy: record('addOrderBy'),
			limit: record('limit'),
			getQueryAndParameters: () => ['', []],
			getOneOrFail: async () => (row ? row : Promise.reject(new Error('EntityNotFound'))),
			getMany: async () => []
		};
		return query;
	};

	beforeEach(() => {
		saved = [];
		logLookups = [];
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-own', name: 'Own' } as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.TIME_TRACKER
		);

		// Only the collaborators the TypeORM path touches (see create-time-slot.handler.spec.ts).
		handler = Object.create(CreateTimeSlotHandler.prototype);
		Object.assign(handler, {
			ormType: 'typeorm',
			typeOrmTimeSlotRepository: {
				// No slot exists for the slot's start: the handler builds a new one
				createQueryBuilder: () => recording([]),
				save: jest.fn(async (slot: any) => {
					saved.push({ ...slot });
					return slot;
				}),
				findOne: jest.fn(async () => saved[saved.length - 1])
			},
			typeOrmTimeLogRepository: {
				createQueryBuilder: () => {
					const calls: unknown[][] = [];
					logLookups.push(calls);
					return recording(calls, LAST_LOG);
				},
				update: jest.fn()
			},
			_commandBus: { execute: jest.fn(async () => []) },
			logger: { debug: jest.fn() }
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads one row, the newest by createdAt, and attaches it to the new slot', async () => {
		await handler.execute(
			new CreateTimeSlotCommand({
				organizationId: ORGANIZATION,
				startedAt: '2026-10-22T03:10:00.000Z',
				duration: 600,
				source: 'DESKTOP',
				logType: 'TRACKED'
			} as any)
		);

		expect(logLookups).toHaveLength(1);
		const [calls] = logLookups;
		const names = calls.map(([name]) => name);
		// CONTROL: the ordering that makes "first row" mean "newest" is still there
		expect(calls).toContainEqual(['addOrderBy', '"q"."createdAt"', 'DESC']);
		expect(calls).toContainEqual(['limit', 1]);
		// The limit is set after the filters and the order, before the read
		expect(names.indexOf('limit')).toBeGreaterThan(names.indexOf('addOrderBy'));
		expect(names.filter((name) => name === 'limit')).toHaveLength(1);

		expect(saved).toHaveLength(1);
		expect(saved[0].timeLogs).toEqual([LAST_LOG]);
	});
});
