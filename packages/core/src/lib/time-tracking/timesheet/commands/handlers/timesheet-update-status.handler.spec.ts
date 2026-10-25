// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { In } from 'typeorm';
import { PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { TimesheetUpdateStatusHandler } from './timesheet-update-status.handler';

/**
 * Moving a timesheet away from APPROVED cleared `approvedAt` but sent `approvedById: undefined`, which the
 * update leaves out: a denied timesheet still named the user who had approved it.
 */
describe('TimesheetUpdateStatusHandler approver', () => {
	const setup = () => {
		const timeSheetService = { update: jest.fn(), find: jest.fn().mockResolvedValue([]) };
		const handler = new TimesheetUpdateStatusHandler(timeSheetService as never, {} as never);
		const update = (status: TimesheetStatus) =>
			handler.execute(
				new TimesheetUpdateStatusCommand({ ids: ['timesheet-1'], status, organizationId: 'org-1' } as never)
			);
		return { timeSheetService, update };
	};

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('approver-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('records the approver on approval', async () => {
		const { timeSheetService, update } = setup();

		await update(TimesheetStatus.APPROVED);

		expect(timeSheetService.update.mock.calls[0][1]).toMatchObject({ approvedById: 'approver-1' });
	});

	it('clears the approver when the timesheet is denied after its approval', async () => {
		const { timeSheetService, update } = setup();

		await update(TimesheetStatus.DENIED);

		expect(timeSheetService.update.mock.calls[0][1]).toMatchObject({ approvedById: null, approvedAt: null });
	});
});

/**
 * A signed-in caller without CAN_APPROVE_TIMESHEET reaches the status change as a team manager: it runs only
 * through the team manager check. An approver keeps the direct change, any status.
 */
describe('TimesheetUpdateStatusHandler team manager path', () => {
	const setup = (granted: PermissionsEnum[]) => {
		const timeSheetService = {
			update: jest.fn(),
			find: jest.fn().mockResolvedValue([]),
			// Answers without running the change it is handed.
			forManagedEmployeeTimesheets: jest.fn().mockResolvedValue([])
		};
		const handler = new TimesheetUpdateStatusHandler(timeSheetService as never, {} as never);
		const holdsPermission = (permission: PermissionsEnum) => granted.includes(permission);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(holdsPermission);
		const update = (status: TimesheetStatus) => {
			const input = { ids: ['timesheet-1'], status, organizationId: 'org-1' };
			const command = new TimesheetUpdateStatusCommand(input as never);
			return handler.execute(command);
		};
		return { timeSheetService, update };
	};

	beforeEach(() => {
		const user = { id: 'user-1', tenantId: 'tenant-1', employeeId: 'employee-1' };
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([TimesheetStatus.APPROVED, TimesheetStatus.DENIED])(
		'sends %s from a caller without CAN_APPROVE_TIMESHEET through the team manager check',
		async (status) => {
			const { timeSheetService, update } = setup([PermissionsEnum.TIME_TRACKER]);

			await update(status);

			expect(timeSheetService.forManagedEmployeeTimesheets).toHaveBeenCalledWith(
				['timesheet-1'],
				'org-1',
				expect.any(Function)
			);
			expect(timeSheetService.update).not.toHaveBeenCalled();
			expect(timeSheetService.find).not.toHaveBeenCalled();
		}
	);

	it.each(Object.values(TimesheetStatus))(
		'keeps the direct change for a CAN_APPROVE_TIMESHEET holder moving a timesheet to %s',
		async (status) => {
			const { timeSheetService, update } = setup([PermissionsEnum.CAN_APPROVE_TIMESHEET]);
			const criteria = { id: In(['timesheet-1']), organizationId: 'org-1', tenantId: 'tenant-1' };

			await update(status);

			expect(timeSheetService.update).toHaveBeenCalledWith(criteria, expect.objectContaining({ status }));
			expect(timeSheetService.find).toHaveBeenCalledTimes(1);
			expect(timeSheetService.forManagedEmployeeTimesheets).not.toHaveBeenCalled();
		}
	);
});
