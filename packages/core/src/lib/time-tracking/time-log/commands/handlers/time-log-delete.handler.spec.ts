// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { TimeLog } from '../../time-log.entity';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { TimeLogDeleteHandler } from './time-log-delete.handler';

/**
 * A time log read with its slots and holding none has none to delete. The slot delete used to run for it anyway, with
 * no slot id, and the bulk delete then read every slot of the employee in the organization (with their screenshots,
 * activities and minutes) to find none of this log's. A log whose slots were not read still goes through it, since
 * that read is how the bulk delete finds them.
 */

const TENANT_ID = '11923000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '11923000-0000-4000-8000-0000000000bb';
const EMPLOYEE_ID = '11923000-0000-4000-8000-0000000000cc';

const timeLog = (id: string, timeSlots?: Array<{ id: string }>): TimeLog =>
	({
		id,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		timesheetId: 'timesheet-1',
		...(timeSlots ? { timeSlots } : {})
	}) as unknown as TimeLog;

function createHandler() {
	const typeOrmTimeLogRepository = {
		findBy: jest.fn(async () => [] as TimeLog[]),
		delete: jest.fn(async () => ({ affected: 1, raw: [] })),
		softDelete: jest.fn(async () => ({ affected: 1, raw: [], generatedMaps: [] }))
	};
	const execute = jest.fn<Promise<unknown[]>, [object]>(async () => []);
	const handler = new TimeLogDeleteHandler(
		typeOrmTimeLogRepository as never,
		undefined as never,
		{
			execute
		} as never
	);
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
	return { handler, execute, typeOrmTimeLogRepository };
}

const slotDeletes = (execute: jest.Mock<Promise<unknown[]>, [object]>): TimeSlotBulkDeleteCommand[] =>
	execute.mock.calls
		.map(([command]) => command)
		.filter((command): command is TimeSlotBulkDeleteCommand => command instanceof TimeSlotBulkDeleteCommand);

describe('TimeLogDeleteHandler slot deletion', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('sends no slot delete for a log read with its slots and holding none, and still deletes the log', async () => {
		const { handler, execute, typeOrmTimeLogRepository } = createHandler();

		await handler.execute(new TimeLogDeleteCommand([timeLog('log-without-slots', [])], true));

		expect(slotDeletes(execute)).toEqual([]);
		expect(typeOrmTimeLogRepository.delete).toHaveBeenCalledTimes(1);
		const recalculations = execute.mock.calls.map(([command]) => command.constructor);
		expect(recalculations).toEqual([TimesheetRecalculateCommand, UpdateEmployeeTotalWorkedHoursCommand]);
	});

	it('sends the slot ids of a log that holds slots', async () => {
		const { handler, execute } = createHandler();
		const log = timeLog('log-with-slots', [{ id: 'slot-1' }, { id: 'slot-2' }]);

		await handler.execute(new TimeLogDeleteCommand([log], true));

		const [slotDelete] = slotDeletes(execute);
		expect(slotDelete.input).toMatchObject({
			employeeId: EMPLOYEE_ID,
			timeLog: log,
			timeSlotsIds: ['slot-1', 'slot-2']
		});
		expect(slotDelete.forceDelete).toBe(true);
	});

	it('still sends the slot delete for a log whose slots were not read, which is how its slots are found', async () => {
		const { handler, execute, typeOrmTimeLogRepository } = createHandler();
		typeOrmTimeLogRepository.findBy.mockResolvedValue([timeLog('log-read-by-id')]);

		await handler.execute(new TimeLogDeleteCommand('log-read-by-id'));

		const [slotDelete] = slotDeletes(execute);
		expect(slotDelete.input).toMatchObject({ timeSlotsIds: [] });
		expect(typeOrmTimeLogRepository.softDelete).toHaveBeenCalledTimes(1);
	});
});
