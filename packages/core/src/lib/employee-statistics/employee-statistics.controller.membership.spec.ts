/**
 * Load the entity graph FIRST, as the application does: the controller reaches EmployeeService, whose
 * import through the validators otherwise leaves an entity decorator undefined.
 */
import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import {
	AggregatedEmployeeStatisticQuery,
	EmployeeStatisticsHistoryQuery,
	MonthAggregatedEmployeeStatisticsQuery
} from './queries';

/**
 * #10746: `/employee-statistics/aggregate` and `/history` took the organization from the `data` JSON,
 * which no DTO validates, and read it without checking that the user belongs to it. They now answer 403
 * for an organization the user is not a member of and 400 for an id that is not a UUID. `/history`
 * without an organization reaches the employee in whichever organization it is, so it needs an
 * employee and checks that employee's organization.
 */
describe('EmployeeStatisticsController — organization membership', () => {
	const MINE = '11111111-1111-4111-8111-111111111111';
	const THEIRS = '22222222-2222-4222-8222-222222222222';
	const MY_EMPLOYEE = '33333333-3333-4333-8333-333333333333';
	const THEIR_EMPLOYEE = '44444444-4444-4444-8444-444444444444';

	let execute: jest.Mock;
	let findOneByIdString: jest.Mock;
	let getStatisticsByEmployeeId: jest.Mock;
	let controller: EmployeeStatisticsController;

	beforeEach(() => {
		execute = jest.fn().mockResolvedValue([]);
		getStatisticsByEmployeeId = jest.fn().mockResolvedValue({});
		findOneByIdString = jest.fn(async (id: string) => ({
			id,
			organizationId: id === MY_EMPLOYEE ? MINE : THEIRS
		}));
		// The membership lookup: a `user_organization` row exists for the caller's own organization only.
		const manager = {
			count: jest.fn(async (_entity, { where }) => (where.organizationId === MINE ? 1 : 0))
		};
		controller = new EmployeeStatisticsController(
			{ getStatisticsByEmployeeId } as any,
			{ execute } as any,
			{ findOneByIdString } as any,
			{ manager } as any
		);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		// A caller who may choose any employee: the own-employee rule has its own spec (employee-statistics.own-employee.spec.ts).
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		// The user's token names their own organization: the only one the organization boundary lets them name.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(MINE);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('GET /employee-statistics/aggregate', () => {
		const aggregate = (findInput: Record<string, unknown>) =>
			controller.findAggregatedByOrganizationId({ findInput });

		it('answers 403 for an organization the user is not a member of, before reading', async () => {
			await expect(aggregate({ organizationId: THEIRS })).rejects.toBeInstanceOf(ForbiddenException);
			expect(execute).not.toHaveBeenCalled();
		});

		it.each([[{ $ne: MINE }], [[MINE, THEIRS]], ['not-a-uuid']])(
			'answers 400 for an organization id %j that is not a UUID',
			async (organizationId) => {
				await expect(aggregate({ organizationId })).rejects.toBeInstanceOf(BadRequestException);
				expect(execute).not.toHaveBeenCalled();
			}
		);

		it("reads one of the user's own organizations", async () => {
			await aggregate({ organizationId: MINE });

			expect(execute).toHaveBeenCalledWith(new AggregatedEmployeeStatisticQuery({ organizationId: MINE } as any));
		});
	});

	describe('GET /employee-statistics/history', () => {
		const history = (findInput: Record<string, unknown>) => controller.findEmployeeStatisticsHistory({ findInput });

		it('answers 403 for an organization the user is not a member of', async () => {
			await expect(history({ organizationId: THEIRS, employeeId: MY_EMPLOYEE })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(execute).not.toHaveBeenCalled();
		});

		it('without an organization, answers 403 for an employee of another organization', async () => {
			await expect(history({ employeeId: THEIR_EMPLOYEE })).rejects.toBeInstanceOf(ForbiddenException);
			expect(findOneByIdString).toHaveBeenCalledWith(THEIR_EMPLOYEE);
			expect(execute).not.toHaveBeenCalled();
		});

		it.each([[{}], [{ employeeId: 'not-a-uuid' }], [{ employeeId: { $ne: MY_EMPLOYEE } }]])(
			'without an organization, answers 400 without a valid employee: %j',
			async (findInput) => {
				await expect(history({ type: 'EXPENSES', ...findInput })).rejects.toBeInstanceOf(BadRequestException);
				expect(findOneByIdString).not.toHaveBeenCalled();
				expect(execute).not.toHaveBeenCalled();
			}
		);

		it("without an organization, reads an employee of the user's own organization", async () => {
			await history({ employeeId: MY_EMPLOYEE });

			expect(execute).toHaveBeenCalledWith(
				new EmployeeStatisticsHistoryQuery({ employeeId: MY_EMPLOYEE } as any)
			);
		});

		it("reads one of the user's own organizations", async () => {
			await history({ organizationId: MINE, employeeId: MY_EMPLOYEE });

			expect(findOneByIdString).not.toHaveBeenCalled();
			expect(execute).toHaveBeenCalledTimes(1);
		});
	});

	describe('GET /employee-statistics/months and /months/:id', () => {
		// Neither states an organization, so the reads reach the employee in whichever organization it belongs to;
		// unlike `/history`, they used to read an employee of another organization of the tenant as asked.
		it('answers 403 for an employee of another organization, before reading', async () => {
			await expect(
				controller.findAggregatedStatisticsByEmployeeId({ employeeId: THEIR_EMPLOYEE } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			await expect(
				controller.findAllByEmployeeId(THEIR_EMPLOYEE, { findInput: undefined })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(execute).not.toHaveBeenCalled();
			expect(getStatisticsByEmployeeId).not.toHaveBeenCalled();
		});

		it("reads an employee of the user's own organization", async () => {
			await controller.findAggregatedStatisticsByEmployeeId({ employeeId: MY_EMPLOYEE } as any);
			await controller.findAllByEmployeeId(MY_EMPLOYEE, { findInput: undefined });

			expect(execute).toHaveBeenCalledWith(
				new MonthAggregatedEmployeeStatisticsQuery({ employeeId: MY_EMPLOYEE } as any)
			);
			expect(getStatisticsByEmployeeId).toHaveBeenCalledWith(MY_EMPLOYEE, undefined);
		});
	});
});
