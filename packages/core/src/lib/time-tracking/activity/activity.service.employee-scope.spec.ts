/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../../core/entities/internal';

import { knex as createKnex, Knex } from 'knex';
import { IGetActivitiesInput, IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { NO_ACCESSIBLE_EMPLOYEE_ID } from '../../employee/managed-employee.service';
import { executedFilters, RecordingQueryBuilder } from '../testing/recording-query-builder';
import { ActivityService } from './activity.service';

/**
 * #10738 — the activity reads and a caller with no employee record.
 *
 * A caller without CHANGE_SELECTED_EMPLOYEE was limited to `[user.employeeId]`, and every read applies its
 * employee predicate only to a non-empty list. With no employee id in the session that list was `[undefined]`,
 * which `isNotEmpty` reads as empty, so `GET /timesheet/activity`, `/activity/daily`, `/activity/report` and
 * their GraphQL fields answered the activity of every employee of the organization.
 *
 * Each read is run on both ORMs: the TypeORM branches through the query builder they build (a recording double
 * of it), the MikroORM aggregations against a real in-memory SQLite store through knex, as they run, and the
 * MikroORM list through the `where` it hands the repository. The arms that read as a caller with no employee
 * record and no organization-wide view fail before the fix; the others pin the callers whose results it keeps.
 */

const TENANT_ID = '10738000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '10738000-0000-4000-8000-0000000000bb';
const OWN_EMPLOYEE_ID = '10738000-0000-4000-8000-000000000001';
const COLLEAGUE_EMPLOYEE_ID = '10738000-0000-4000-8000-000000000002';

const REQUEST: IGetActivitiesInput = {
	organizationId: ORGANIZATION_ID,
	startDate: '2026-10-01' as any,
	endDate: '2026-10-31' as any
} as IGetActivitiesInput;

/** Who reads: their employee record, and the permissions their role holds. */
interface ICaller {
	employeeId: string | null;
	permissions: PermissionsEnum[];
}

const PLAIN_EMPLOYEE: ICaller = { employeeId: OWN_EMPLOYEE_ID, permissions: [] };
const NO_EMPLOYEE_RECORD: ICaller = { employeeId: null, permissions: [] };
const ORGANIZATION_VIEWER: ICaller = { employeeId: null, permissions: [PermissionsEnum.ALL_ORG_VIEW] };
const EMPLOYEE_PICKER: ICaller = { employeeId: null, permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] };

function actAs(caller: ICaller): void {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		employeeId: caller.employeeId
	} as IUser);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
		caller.permissions.includes(permission as PermissionsEnum)
	);
}

/** The TypeORM query builder the reads chain on; only the predicates in place when it runs are kept. */
class ActivityQueryBuilder extends RecordingQueryBuilder {
	take(): this {
		return this;
	}
	skip(): this {
		return this;
	}
	select(): this {
		return this;
	}
	addSelect(): this {
		return this;
	}
	groupBy(): this {
		return this;
	}
	addGroupBy(): this {
		return this;
	}
	orderBy(): this {
		return this;
	}
	addOrderBy(): this {
		return this;
	}
	limit(): this {
		return this;
	}
	leftJoinAndSelect(): this {
		return this;
	}
	async getRawMany(): Promise<unknown[]> {
		return await this.getMany();
	}
}

/** The employees a TypeORM read filtered on, or `undefined` when it applied no employee predicate. */
function typeOrmEmployeeFilter(builder: ActivityQueryBuilder): unknown {
	const { conditions, parameters } = executedFilters(builder);
	const filtered = conditions.some((condition) => condition.includes('"employeeId" IN (:...employeeIds)'));
	return filtered ? parameters.employeeIds : undefined;
}

describe('ActivityService — the employees a caller reads the activity of', () => {
	let db: Knex;

	beforeAll(async () => {
		db = createKnex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

		// `deletedAt` as on every soft-deletable table: the aggregations leave deleted rows out
		await db.schema.createTable('employee', (table) => {
			table.string('id').primary();
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('time_slot', (table) => {
			table.string('id').primary();
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('time_slot_time_logs', (table) => {
			table.string('timeSlotId');
			table.string('timeLogId');
		});
		await db.schema.createTable('activity', (table) => {
			table.string('id').primary();
			table.string('tenantId');
			table.string('organizationId');
			table.string('employeeId');
			table.string('projectId').nullable();
			table.string('timeSlotId');
			table.string('date');
			table.string('title');
			table.integer('duration');
			table.datetime('deletedAt').nullable();
		});

		// One activity of the caller's own, one of a colleague, in the same organization.
		for (const [index, employeeId] of [OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].entries()) {
			await db('employee').insert({ id: employeeId });
			await db('time_slot').insert({ id: `slot-${index}` });
			await db('time_slot_time_logs').insert({ timeSlotId: `slot-${index}`, timeLogId: `log-${index}` });
			await db('activity').insert({
				id: `activity-${index}`,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				employeeId,
				projectId: null,
				timeSlotId: `slot-${index}`,
				date: '2026-10-12',
				title: 'editor',
				duration: 60
			});
		}
	});

	afterAll(async () => {
		await db?.destroy();
	});

	afterEach(() => jest.restoreAllMocks());

	function createService(orm: MultiORMEnum) {
		const builders: ActivityQueryBuilder[] = [];
		const typeOrmRepository = {
			createQueryBuilder: jest.fn(() => {
				const builder = new ActivityQueryBuilder('activity');
				builders.push(builder);
				return builder;
			})
		};
		const mikroOrmRepository = { getKnex: () => db, find: jest.fn(async () => []) };
		const relatedRepository = { find: jest.fn(async () => []) };

		const service = new ActivityService(
			typeOrmRepository as any,
			mikroOrmRepository as any,
			relatedRepository as any,
			relatedRepository as any,
			{} as any
		);
		Object.defineProperty(service, 'ormType', { value: orm });

		return { service, builders, mikroOrmRepository };
	}

	/** The employees whose rows each read answers or filters on, as each ORM runs it. */
	async function readsAs(caller: ICaller, request: IGetActivitiesInput = REQUEST) {
		actAs(caller);

		const typeOrm = createService(MultiORMEnum.TypeORM);
		await typeOrm.service.getActivities(request);
		await typeOrm.service.getDailyActivities(request);
		await typeOrm.service.getDailyActivitiesReport(request);

		const mikroOrm = createService(MultiORMEnum.MikroORM);
		await mikroOrm.service.getActivities(request);
		const [where] = mikroOrm.mikroOrmRepository.find.mock.calls[0] as unknown as [Record<string, any>];
		const daily = await mikroOrm.service.getDailyActivities(request);
		const report = await mikroOrm.service.getDailyActivitiesReport(request);
		const employeesOf = (rows: Array<{ employeeId: string }>) => rows.map((row) => row.employeeId).sort();

		return {
			typeOrm: typeOrm.builders.map(typeOrmEmployeeFilter),
			mikroOrmList: where.employeeId,
			mikroOrmDaily: employeesOf(daily as any),
			mikroOrmReport: employeesOf(report as any)
		};
	}

	it('reads nothing for a caller with no employee record who may neither pick employees nor view the organization', async () => {
		const reads = await readsAs(NO_EMPLOYEE_RECORD);

		expect(reads.typeOrm).toEqual([
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID]
		]);
		expect(reads.mikroOrmList).toEqual({ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] });
		expect(reads.mikroOrmDaily).toEqual([]);
		expect(reads.mikroOrmReport).toEqual([]);
	});

	it('reads only their own activity for an employee who may not pick employees', async () => {
		const reads = await readsAs(PLAIN_EMPLOYEE, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID] });

		expect(reads.typeOrm).toEqual([[OWN_EMPLOYEE_ID], [OWN_EMPLOYEE_ID], [OWN_EMPLOYEE_ID]]);
		expect(reads.mikroOrmList).toEqual({ $in: [OWN_EMPLOYEE_ID] });
		expect(reads.mikroOrmDaily).toEqual([OWN_EMPLOYEE_ID]);
		expect(reads.mikroOrmReport).toEqual([OWN_EMPLOYEE_ID]);
	});

	it('keeps the whole organization for an organization-wide viewer with no employee record', async () => {
		const reads = await readsAs(ORGANIZATION_VIEWER);

		expect(reads.typeOrm).toEqual([undefined, undefined, undefined]);
		expect(reads.mikroOrmList).toBeUndefined();
		expect(reads.mikroOrmDaily).toEqual([OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort());
		expect(reads.mikroOrmReport).toEqual([OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort());
	});

	it('reads the employees a CHANGE_SELECTED_EMPLOYEE holder picks, and everyone when they pick none', async () => {
		const picked = await readsAs(EMPLOYEE_PICKER, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID] });

		expect(picked.typeOrm).toEqual([[COLLEAGUE_EMPLOYEE_ID], [COLLEAGUE_EMPLOYEE_ID], [COLLEAGUE_EMPLOYEE_ID]]);
		expect(picked.mikroOrmList).toEqual({ $in: [COLLEAGUE_EMPLOYEE_ID] });
		expect(picked.mikroOrmDaily).toEqual([COLLEAGUE_EMPLOYEE_ID]);
		expect(picked.mikroOrmReport).toEqual([COLLEAGUE_EMPLOYEE_ID]);

		jest.restoreAllMocks();
		const everyone = await readsAs(EMPLOYEE_PICKER);

		expect(everyone.typeOrm).toEqual([undefined, undefined, undefined]);
		expect(everyone.mikroOrmDaily).toEqual([OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort());
	});
});
