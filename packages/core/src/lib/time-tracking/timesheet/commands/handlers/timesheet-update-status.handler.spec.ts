// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimesheetStatus } from '@gauzy/contracts';
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
