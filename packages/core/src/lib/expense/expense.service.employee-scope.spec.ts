/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { IGetExpenseInput, IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { NO_ACCESSIBLE_EMPLOYEE_ID } from '../employee/managed-employee.service';
import { executedFilters, RecordingQueryBuilder } from '../time-tracking/testing/recording-query-builder';
import { ExpenseService } from './expense.service';

/**
 * The expense report reads and a caller with no employee record.
 *
 * A caller without CHANGE_SELECTED_EMPLOYEE was limited to `[user.employeeId]` only when that id existed, and
 * every read applies its employee predicate only to a non-empty list. With no employee id in the session the
 * requested list was kept as sent, so `GET /expense/report`, `/expense/report/daily-chart`,
 * `/expense/statistics` and the `expenseStatistics` GraphQL field answered every employee's expenses of the
 * organization when no employee was named, and a colleague's when one was.
 *
 * Each read is run on both ORMs: the TypeORM branch through the query builder it builds (a recording double of
 * it), the MikroORM branch through the `where` it hands the repository. The arms that read as a caller with no
 * employee record and no organization-wide view fail before the fix; the others pin the callers whose results
 * it keeps.
 */

const TENANT_ID = '11550000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '11550000-0000-4000-8000-0000000000bb';
const OWN_EMPLOYEE_ID = '11550000-0000-4000-8000-000000000001';
const COLLEAGUE_EMPLOYEE_ID = '11550000-0000-4000-8000-000000000002';

const REQUEST: IGetExpenseInput = {
	organizationId: ORGANIZATION_ID,
	startDate: '2026-10-01' as any,
	endDate: '2026-10-31' as any
} as IGetExpenseInput;

/** Who reads: their employee record, and the permissions their role holds. */
interface ICaller {
	employeeId: string | null;
	permissions: PermissionsEnum[];
}

const PLAIN_EMPLOYEE: ICaller = { employeeId: OWN_EMPLOYEE_ID, permissions: [] };
const NO_EMPLOYEE_RECORD: ICaller = { employeeId: null, permissions: [] };
const ORGANIZATION_VIEWER: ICaller = { employeeId: null, permissions: [PermissionsEnum.ALL_ORG_VIEW] };
const EMPLOYEE_PICKER: ICaller = { employeeId: null, permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] };
const EMPLOYEE_PICKER_WITH_RECORD: ICaller = {
	employeeId: OWN_EMPLOYEE_ID,
	permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
};

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
class ExpenseQueryBuilder extends RecordingQueryBuilder {
	take(): this {
		return this;
	}
	skip(): this {
		return this;
	}
	leftJoin(): this {
		return this;
	}
	leftJoinAndSelect(): this {
		return this;
	}
	orderBy(): this {
		return this;
	}
}

/** The employees a TypeORM read filtered on, or `undefined` when it applied no employee predicate. */
function typeOrmEmployeeFilter(builder: ExpenseQueryBuilder): unknown {
	const { conditions, parameters } = executedFilters(builder);
	const filtered = conditions.some((condition) => condition.includes('"employeeId" IN (:...employeeIds)'));
	return filtered ? parameters.employeeIds : undefined;
}

describe('ExpenseService — the employees a caller reads the expenses of', () => {
	afterEach(() => jest.restoreAllMocks());

	function createService(orm: MultiORMEnum) {
		const builders: ExpenseQueryBuilder[] = [];
		const typeOrmRepository = {
			createQueryBuilder: jest.fn(() => {
				const builder = new ExpenseQueryBuilder('expense');
				builders.push(builder);
				return builder;
			})
		};
		const mikroOrmRepository = { find: jest.fn(async () => []) };

		const service = new ExpenseService(typeOrmRepository as any, mikroOrmRepository as any);
		Object.defineProperty(service, 'ormType', { value: orm });

		return { service, builders, mikroOrmRepository };
	}

	/** The employees each report read filters on, as each ORM runs it. */
	async function readsAs(caller: ICaller, request: IGetExpenseInput = REQUEST) {
		actAs(caller);

		const typeOrm = createService(MultiORMEnum.TypeORM);
		await typeOrm.service.getExpense(request);
		await typeOrm.service.getDailyReportChartData(request);
		await typeOrm.service.getStatistics(request);

		const mikroOrm = createService(MultiORMEnum.MikroORM);
		await mikroOrm.service.getExpense(request);
		await mikroOrm.service.getDailyReportChartData(request);
		await mikroOrm.service.getStatistics(request);
		const wheres = mikroOrm.mikroOrmRepository.find.mock.calls.map(
			(call) => (call as unknown as [Record<string, any>])[0]
		);

		return {
			typeOrm: typeOrm.builders.map(typeOrmEmployeeFilter),
			mikroOrm: wheres.map((where) => where.employeeId)
		};
	}

	it('reads nothing for a caller with no employee record who may neither pick employees nor view the organization', async () => {
		const reads = await readsAs(NO_EMPLOYEE_RECORD);

		expect(reads.typeOrm).toEqual([
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID]
		]);
		expect(reads.mikroOrm).toEqual([
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] }
		]);
	});

	it('does not read a colleague such a caller names, nor their own "only me" selection', async () => {
		const named = await readsAs(NO_EMPLOYEE_RECORD, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID] });

		expect(named.typeOrm).toEqual([
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID]
		]);
		expect(named.mikroOrm).toEqual([
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] }
		]);

		jest.restoreAllMocks();
		const onlyMe = await readsAs(NO_EMPLOYEE_RECORD, { ...REQUEST, onlyMe: true });

		expect(onlyMe.typeOrm).toEqual([
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID],
			[NO_ACCESSIBLE_EMPLOYEE_ID]
		]);
		expect(onlyMe.mikroOrm).toEqual([
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
			{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] }
		]);
	});

	it('reads only their own expenses for an employee who may not pick employees', async () => {
		const reads = await readsAs(PLAIN_EMPLOYEE, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID] });

		expect(reads.typeOrm).toEqual([[OWN_EMPLOYEE_ID], [OWN_EMPLOYEE_ID], [OWN_EMPLOYEE_ID]]);
		expect(reads.mikroOrm).toEqual([
			{ $in: [OWN_EMPLOYEE_ID] },
			{ $in: [OWN_EMPLOYEE_ID] },
			{ $in: [OWN_EMPLOYEE_ID] }
		]);
	});

	it('keeps the whole organization, or the employees named, for an organization-wide viewer with no employee record', async () => {
		const everyone = await readsAs(ORGANIZATION_VIEWER);

		expect(everyone.typeOrm).toEqual([undefined, undefined, undefined]);
		expect(everyone.mikroOrm).toEqual([undefined, undefined, undefined]);

		jest.restoreAllMocks();
		const named = await readsAs(ORGANIZATION_VIEWER, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID] });

		expect(named.typeOrm).toEqual([[COLLEAGUE_EMPLOYEE_ID], [COLLEAGUE_EMPLOYEE_ID], [COLLEAGUE_EMPLOYEE_ID]]);
		expect(named.mikroOrm).toEqual([
			{ $in: [COLLEAGUE_EMPLOYEE_ID] },
			{ $in: [COLLEAGUE_EMPLOYEE_ID] },
			{ $in: [COLLEAGUE_EMPLOYEE_ID] }
		]);
	});

	it('reads the employees a CHANGE_SELECTED_EMPLOYEE holder picks, and everyone when they pick none', async () => {
		const picked = await readsAs(EMPLOYEE_PICKER, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID] });

		expect(picked.typeOrm).toEqual([[COLLEAGUE_EMPLOYEE_ID], [COLLEAGUE_EMPLOYEE_ID], [COLLEAGUE_EMPLOYEE_ID]]);
		expect(picked.mikroOrm).toEqual([
			{ $in: [COLLEAGUE_EMPLOYEE_ID] },
			{ $in: [COLLEAGUE_EMPLOYEE_ID] },
			{ $in: [COLLEAGUE_EMPLOYEE_ID] }
		]);

		jest.restoreAllMocks();
		const everyone = await readsAs(EMPLOYEE_PICKER);

		expect(everyone.typeOrm).toEqual([undefined, undefined, undefined]);
		expect(everyone.mikroOrm).toEqual([undefined, undefined, undefined]);
	});

	it('reads nothing on "only me" for a caller with no employee record, whatever their role', async () => {
		for (const caller of [EMPLOYEE_PICKER, ORGANIZATION_VIEWER]) {
			jest.restoreAllMocks();
			const reads = await readsAs(caller, { ...REQUEST, employeeIds: [COLLEAGUE_EMPLOYEE_ID], onlyMe: true });

			expect(reads.typeOrm).toEqual([
				[NO_ACCESSIBLE_EMPLOYEE_ID],
				[NO_ACCESSIBLE_EMPLOYEE_ID],
				[NO_ACCESSIBLE_EMPLOYEE_ID]
			]);
			expect(reads.mikroOrm).toEqual([
				{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
				{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] },
				{ $in: [NO_ACCESSIBLE_EMPLOYEE_ID] }
			]);
		}
	});

	it('reads their own expenses when a CHANGE_SELECTED_EMPLOYEE holder with an employee record asks for "only me"', async () => {
		const reads = await readsAs(EMPLOYEE_PICKER_WITH_RECORD, {
			...REQUEST,
			employeeIds: [COLLEAGUE_EMPLOYEE_ID],
			onlyMe: true
		});

		expect(reads.typeOrm).toEqual([[OWN_EMPLOYEE_ID], [OWN_EMPLOYEE_ID], [OWN_EMPLOYEE_ID]]);
		expect(reads.mikroOrm).toEqual([
			{ $in: [OWN_EMPLOYEE_ID] },
			{ $in: [OWN_EMPLOYEE_ID] },
			{ $in: [OWN_EMPLOYEE_ID] }
		]);
	});
});
