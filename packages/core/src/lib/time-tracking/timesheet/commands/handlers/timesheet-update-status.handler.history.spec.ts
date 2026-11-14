// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ActionTypeEnum, PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { recordTimeLogHistory } from '../../../time-log/time-log-history.writer';
import { Timesheet } from '../../timesheet.entity';
import { TimesheetUpdateStatusCommand } from '../timesheet-update-status.command';
import { TimesheetUpdateStatusHandler } from './timesheet-update-status.handler';

// A database that takes row locks, as PostgreSQL and MySQL do.
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isBetterSqlite3: jest.fn(() => false),
	isSqlite: jest.fn(() => false)
}));
// The history rows themselves have their own spec (time-log-history.writer.spec.ts).
jest.mock('../../../time-log/time-log-history.writer', () => ({
	...jest.requireActual('../../../time-log/time-log-history.writer'),
	recordTimeLogHistory: jest.fn(async () => undefined)
}));

/**
 * A status change (approve, deny, ...) is recorded in the history of every entry of the timesheet
 * (ever-co/ever-gauzy#11922), with the status before and after and the reason of a denial, in the transaction that
 * writes the status.
 */
describe('TimesheetUpdateStatusHandler: history of a status change', () => {
	const ENTRIES = [
		{
			id: 'log-1',
			employeeId: 'employee-paul',
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			timesheetId: 'ts-1'
		},
		{ id: 'log-2', employeeId: 'employee-paul', organizationId: 'org-1', tenantId: 'tenant-1', timesheetId: 'ts-1' }
	];

	function setup(storedStatus: TimesheetStatus) {
		const transactionManager = {
			find: jest.fn<Promise<unknown[]>, [unknown, unknown?]>(async (entity) =>
				entity === Timesheet ? [{ id: 'ts-1', status: storedStatus }] : ENTRIES
			),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => unknown) => work(transactionManager))
		};
		const timeSheetService = { update: jest.fn(), find: jest.fn().mockResolvedValue([]) };
		const handler = new TimesheetUpdateStatusHandler(timeSheetService as never, {} as never, dataSource as never);
		const record = recordTimeLogHistory as jest.Mock;
		record.mockClear();
		const update = (status: TimesheetStatus, reason?: string) =>
			handler.execute(
				new TimesheetUpdateStatusCommand({ ids: ['ts-1'], status, reason, organizationId: 'org-1' } as never)
			);
		return { dataSource, transactionManager, timeSheetService, record, update };
	}

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('approver-1');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => permission === PermissionsEnum.CAN_APPROVE_TIMESHEET
		);
	});
	afterEach(() => jest.restoreAllMocks());

	it('records the status before and after, with the reason, for each entry of the timesheet', async () => {
		const { transactionManager, record, update } = setup(TimesheetStatus.PENDING);

		await update(TimesheetStatus.DENIED, 'Overlaps the client meeting');

		const [manager, records] = record.mock.calls[0];
		expect(manager).toBe(transactionManager);
		expect(records.map((it) => it.subject.id)).toEqual(['log-1', 'log-2']);
		expect(records[0].reason).toBe('Overlaps the client meeting');
		expect(records[0].change).toEqual({
			action: ActionTypeEnum.Updated,
			updatedFields: ['status'],
			previousValues: [{ status: TimesheetStatus.PENDING }],
			updatedValues: [{ status: TimesheetStatus.DENIED }]
		});
	});

	it('writes the status in the same transaction, from the status read under lock in it', async () => {
		const { transactionManager, timeSheetService, record, update } = setup(TimesheetStatus.PENDING);

		await update(TimesheetStatus.APPROVED);

		expect(timeSheetService.update).not.toHaveBeenCalled();
		expect(transactionManager.find).toHaveBeenCalledWith(
			Timesheet,
			expect.objectContaining({ lock: { mode: 'pessimistic_write' } })
		);
		expect(transactionManager.update).toHaveBeenCalledWith(
			Timesheet,
			expect.objectContaining({ organizationId: 'org-1', tenantId: 'tenant-1' }),
			expect.objectContaining({ status: TimesheetStatus.APPROVED })
		);
		expect(record.mock.calls[0][0]).toBe(transactionManager);
	});

	it('records nothing when the status does not change', async () => {
		const { record, update } = setup(TimesheetStatus.APPROVED);

		await update(TimesheetStatus.APPROVED);

		expect(record).not.toHaveBeenCalled();
	});

	it('fails the status change, written in the same transaction, when its history cannot be written', async () => {
		const { record, update } = setup(TimesheetStatus.PENDING);
		record.mockRejectedValueOnce(new Error('activity_log is not reachable'));

		await expect(update(TimesheetStatus.APPROVED)).rejects.toThrow('activity_log is not reachable');
	});
});
