/**
 * 🛑 This import must stay FIRST: the entity graph has to finish initializing before the controller and the handlers
 * import through the validators.
 */
import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { assertOwnEmployeeUnlessSelecting } from './employee-statistics-scope';
import { AggregateOrganizationQueryHandler } from './queries/handlers/aggregate-employee-statistic.handler';

/**
 * A caller without `CHANGE_SELECTED_EMPLOYEE` reads only their own employee's statistics.
 *
 * The routes and fields ask for `ADMIN_DASHBOARD_VIEW` (or `HUMAN_RESOURCE_DASHBOARD` / `ACCOUNTING_DASHBOARD`), and the
 * default EMPLOYEE role holds `ADMIN_DASHBOARD_VIEW`. With only the organization checked, an employee could read the
 * income, expense and bonus figures of every coworker: one by one (`/months/:id`, `/months`, `/history` and their
 * GraphQL fields, which share `assertStatisticsReadInScope`) or all at once (`/aggregate`).
 */

const MINE = '11111111-1111-4111-8111-111111111111';
const MY_EMPLOYEE = '33333333-3333-4333-8333-333333333333';
const COWORKER = '44444444-4444-4444-8444-444444444444';

function caller({ selecting, employeeId = MY_EMPLOYEE }: { selecting: boolean; employeeId?: string | null }) {
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission) => selecting && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(MINE);
}

afterEach(() => jest.restoreAllMocks());

describe('assertOwnEmployeeUnlessSelecting', () => {
	it('lets a caller with CHANGE_SELECTED_EMPLOYEE name any employee', () => {
		caller({ selecting: true });
		expect(() => assertOwnEmployeeUnlessSelecting(COWORKER)).not.toThrow();
	});

	it('lets a caller without it name their own employee', () => {
		caller({ selecting: false });
		expect(() => assertOwnEmployeeUnlessSelecting(MY_EMPLOYEE)).not.toThrow();
	});

	it.each([
		['a coworker', COWORKER],
		['no employee', undefined],
		['a non-string id', [MY_EMPLOYEE]]
	])('refuses a caller without it who names %s', (_case, employeeId) => {
		caller({ selecting: false });
		expect(() => assertOwnEmployeeUnlessSelecting(employeeId)).toThrow(ForbiddenException);
	});

	it('refuses a caller without it who has no employee of their own', () => {
		caller({ selecting: false, employeeId: null });
		expect(() => assertOwnEmployeeUnlessSelecting(null)).toThrow(ForbiddenException);
	});
});

describe('the per-employee routes, for a caller without CHANGE_SELECTED_EMPLOYEE', () => {
	function controller() {
		const execute = jest.fn().mockResolvedValue([]);
		const getStatisticsByEmployeeId = jest.fn().mockResolvedValue({});
		const findOneByIdString = jest.fn(async (id: string) => ({ id, organizationId: MINE }));
		const manager = { count: jest.fn(async () => 1) };
		const instance = new EmployeeStatisticsController(
			{ getStatisticsByEmployeeId } as any,
			{ execute } as any,
			{ findOneByIdString } as any,
			{ manager } as any
		);
		return { instance, execute, getStatisticsByEmployeeId };
	}

	beforeEach(() => caller({ selecting: false }));

	it('answers their own figures (GET /months/:id)', async () => {
		const { instance, getStatisticsByEmployeeId } = controller();

		await instance.findAllByEmployeeId(MY_EMPLOYEE, { valueDate: new Date(), months: 12 } as any);

		expect(getStatisticsByEmployeeId).toHaveBeenCalled();
	});

	it('answers 403 for a coworker’s figures, before reading (GET /months/:id, /months, /history)', async () => {
		const { instance, execute, getStatisticsByEmployeeId } = controller();

		await expect(
			instance.findAllByEmployeeId(COWORKER, { valueDate: new Date(), months: 12 } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			instance.findAggregatedStatisticsByEmployeeId({ employeeId: COWORKER, organizationId: MINE } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			instance.findEmployeeStatisticsHistory({ findInput: { employeeId: COWORKER, organizationId: MINE } } as any)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(getStatisticsByEmployeeId).not.toHaveBeenCalled();
		expect(execute).not.toHaveBeenCalled();
	});
});

describe('the organization aggregate (/aggregate, employeeAggregatedStatistics)', () => {
	function handler() {
		const working = [
			{ id: MY_EMPLOYEE, user: { id: 'user-1' } },
			{ id: COWORKER, user: { id: 'user-2' } }
		];
		const employeeService = { findWorkingEmployees: jest.fn(async () => ({ items: working })) };
		const instance: any = new AggregateOrganizationQueryHandler(employeeService as any, {} as any);
		const loadAllData = jest.spyOn(instance, '_loadAllData').mockResolvedValue(undefined);
		const loadChartData = jest.spyOn(instance, '_loadChartData').mockResolvedValue([]);
		return { instance, loadAllData, loadChartData };
	}

	const query = { input: { organizationId: MINE, startDate: new Date(), endDate: new Date() } } as any;
	const employeesOf = (map: Map<string, unknown>) => Array.from(map.keys());

	it('answers every working employee to a caller with CHANGE_SELECTED_EMPLOYEE', async () => {
		caller({ selecting: true });
		const { instance, loadAllData, loadChartData } = handler();

		const answer = await instance.execute(query);

		expect(employeesOf(loadAllData.mock.calls[0][1] as Map<string, unknown>)).toEqual([MY_EMPLOYEE, COWORKER]);
		expect((loadChartData.mock.calls[0][0] as any[]).map(({ id }) => id)).toEqual([MY_EMPLOYEE, COWORKER]);
		expect(answer.employees.map(({ employee }) => employee.id)).toEqual([MY_EMPLOYEE, COWORKER]);
	});

	it('answers only their own figures, chart included, to a caller without it', async () => {
		caller({ selecting: false });
		const { instance, loadAllData, loadChartData } = handler();

		const answer = await instance.execute(query);

		expect(employeesOf(loadAllData.mock.calls[0][1] as Map<string, unknown>)).toEqual([MY_EMPLOYEE]);
		expect((loadChartData.mock.calls[0][0] as any[]).map(({ id }) => id)).toEqual([MY_EMPLOYEE]);
		expect(answer.employees.map(({ employee }) => employee.id)).toEqual([MY_EMPLOYEE]);
	});

	it('answers no employee to a caller without it who has no employee of their own', async () => {
		caller({ selecting: false, employeeId: null });
		const { instance, loadChartData } = handler();

		const answer = await instance.execute(query);

		expect(answer.employees).toEqual([]);
		expect(loadChartData.mock.calls[0][0]).toEqual([]);
	});
});
