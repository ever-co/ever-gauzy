// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../../core/utils';
import { assertSensitiveRelationsAllowed } from '../../core/util/sensitive-relations.helper';
import { TimerService } from './timer.service';

// The relation walk needs the real entity metadata; these specs check what reaches the last-log lookup instead.
jest.mock('../../core/util/sensitive-relations.helper', () => ({ assertSensitiveRelationsAllowed: jest.fn() }));

/**
 * `GET /timesheet/timer/status?employeeId=` read the named employee only for a caller holding CHANGE_SELECTED_EMPLOYEE.
 * Anyone else silently got their own status back, labelled as the colleague's. A manager of the employee now reads
 * them, anyone else is refused, and a request naming the caller (or nobody) is unchanged.
 *
 * The employee lookup answers nothing, so each call ends on "employee not found" right after it: the specs check
 * which employee was looked up, or that the refusal came before any lookup.
 */
describe('TimerService.getTimerStatus for another employee', () => {
	const caller = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const { tenantId, organizationId } = caller;

	let restore: () => void;
	let fetchEmployee: jest.Mock;
	let canManageEmployee: jest.Mock;
	let service: TimerService;

	const statusOf = (employeeId?: string) => service.getTimerStatus({ tenantId, organizationId, employeeId });

	const signInAs = (permissions: PermissionsEnum[] = []) => {
		({ restore } = asTenantUser(caller, { permissions }));
	};

	beforeEach(() => {
		fetchEmployee = jest.fn().mockResolvedValue(null);
		canManageEmployee = jest.fn();
		service = Object.assign(Object.create(TimerService.prototype), {
			typeOrmTimeLogRepository: { metadata: {} },
			_managedEmployeeService: { canManageEmployee },
			fetchEmployee
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('reads the named employee for a caller who may act for every employee, as before', async () => {
		signInAs([PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(statusOf('member-employee')).rejects.toThrow(NotFoundException);

		expect(fetchEmployee).toHaveBeenCalledWith({ id: 'member-employee', tenantId, organizationId });
		expect(canManageEmployee).not.toHaveBeenCalled();
	});

	it("reads a member's status for a manager of that member", async () => {
		signInAs();
		canManageEmployee.mockResolvedValue(true);

		await expect(statusOf('member-employee')).rejects.toThrow(NotFoundException);

		expect(canManageEmployee).toHaveBeenCalledWith('member-employee', undefined, organizationId);
		expect(fetchEmployee).toHaveBeenCalledWith({ id: 'member-employee', tenantId, organizationId });
	});

	it("refuses a colleague who does not manage the member, before reading anyone's status", async () => {
		signInAs();
		canManageEmployee.mockResolvedValue(false);

		await expect(statusOf('member-employee')).rejects.toThrow(ForbiddenException);

		expect(fetchEmployee).not.toHaveBeenCalled();
	});

	it("reads the caller's own status when the request names the caller, or nobody", async () => {
		signInAs();

		await expect(statusOf('caller-employee')).rejects.toThrow(NotFoundException);
		await expect(statusOf()).rejects.toThrow(NotFoundException);

		expect(canManageEmployee).not.toHaveBeenCalled();
		expect(fetchEmployee).toHaveBeenNthCalledWith(1, { userId: caller.user.id, tenantId, organizationId });
		expect(fetchEmployee).toHaveBeenNthCalledWith(2, { userId: caller.user.id, tenantId, organizationId });
	});

	describe('relations loaded on the last log', () => {
		const RELATIONS = ['task', 'timeSlots.screenshots', 'timesheet'];
		let findLastTimeLog: jest.Mock;

		const relationsReadFor = async (employeeId?: string) => {
			await service.getTimerStatus({ tenantId, organizationId, employeeId, relations: RELATIONS });
			const [, request] = findLastTimeLog.mock.calls[0];
			return request.relations;
		};

		beforeEach(() => {
			findLastTimeLog = jest.fn().mockResolvedValue(null);
			fetchEmployee.mockImplementation(async (query: { id?: string }) => ({ id: query.id ?? 'caller-employee' }));
			const queryBuilder = {
				setFindOptions: () => queryBuilder,
				innerJoin: () => queryBuilder,
				getMany: async () => []
			};
			Object.assign(service, {
				ormType: MultiORMEnum.TypeORM,
				typeOrmTimeLogRepository: { metadata: {}, createQueryBuilder: () => queryBuilder },
				findLastTimeLog
			});
		});

		it("leaves the tracked data out of a managed member's log", async () => {
			signInAs();
			canManageEmployee.mockResolvedValue(true);

			expect(await relationsReadFor('member-employee')).toEqual(['task']);
			expect(assertSensitiveRelationsAllowed).toHaveBeenCalledWith({}, RELATIONS);
			const [lookup] = findLastTimeLog.mock.calls[0];
			expect(lookup.where).toEqual(expect.objectContaining({ employeeId: 'member-employee' }));
		});

		it('keeps every relation for a caller who may act for every employee, and on the caller own log', async () => {
			signInAs([PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			expect(await relationsReadFor('member-employee')).toEqual(RELATIONS);

			restore();
			findLastTimeLog.mockClear();
			signInAs();
			expect(await relationsReadFor()).toEqual(RELATIONS);
		});
	});
});
