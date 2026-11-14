// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ActionTypeEnum } from '@gauzy/contracts';
import { TimeLog } from '../../time-log.entity';
import { recordTimeLogHistory } from '../../time-log-history.writer';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { TimeLogDeleteHandler } from './time-log-delete.handler';

// The history rows themselves have their own spec (time-log-history.writer.spec.ts).
jest.mock('../../time-log-history.writer', () => ({
	...jest.requireActual('../../time-log-history.writer'),
	recordTimeLogHistory: jest.fn(async () => undefined)
}));

/**
 * Entries a person deletes keep what they held in their history (ever-co/ever-gauzy#11922), written in the same
 * transaction as the deletion. A deletion the API makes on its own (the cut of an overlapped entry) records nothing.
 */
describe('TimeLogDeleteHandler: history of a deletion', () => {
	const entry = (id: string, taskId: string) =>
		new TimeLog({
			id,
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			employeeId: 'employee-paul',
			taskId,
			startedAt: new Date('2026-11-10T09:00:00.000Z'),
			stoppedAt: new Date('2026-11-10T11:00:00.000Z'),
			timeSlots: [],
			timesheetId: 'timesheet-1'
		});

	function setup(stored: TimeLog[] = [entry('log-1', 'task-login'), entry('log-2', 'task-signup')]) {
		const transactionRepository = {
			softDelete: jest.fn(async () => ({ affected: 2 })),
			find: jest.fn(async () => stored)
		};
		const transactionManager = { getRepository: jest.fn(() => transactionRepository) };
		const repository = {
			softDelete: jest.fn(async () => ({ affected: 2 }))
		};
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => unknown) => work(transactionManager))
		};
		const commandBus = { execute: jest.fn(async () => undefined) };
		const handler = new TimeLogDeleteHandler(
			repository as never,
			{} as never,
			commandBus as never,
			dataSource as never
		);
		const record = recordTimeLogHistory as jest.Mock;
		record.mockClear();
		return { handler, repository, dataSource, transactionManager, transactionRepository, record };
	}

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

	it('records the entries as stored, when the logs it is handed lack their scope (a MikroORM read)', async () => {
		const { handler, record } = setup([entry('log-1', 'task-login')]);
		const serialized = [{ id: 'log-1', startedAt: new Date('2026-11-10T09:00:00.000Z'), timeSlots: [] }];

		await handler.execute(new TimeLogDeleteCommand(serialized as unknown as TimeLog[], false, {}));

		const [, records] = record.mock.calls[0];
		expect(records[0].subject).toMatchObject({ id: 'log-1', tenantId: 'tenant-1', employeeId: 'employee-paul' });
		expect(records[0].change.previousValues).toContainEqual({ employeeId: 'employee-paul' });
	});
	afterEach(() => jest.restoreAllMocks());

	it('deletes the entries and records what each held, in one transaction', async () => {
		const { handler, repository, dataSource, transactionManager, transactionRepository, record } = setup();

		await handler.execute(
			new TimeLogDeleteCommand([entry('log-1', 'task-login'), entry('log-2', 'task-signup')], false, {})
		);

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(repository.softDelete).not.toHaveBeenCalled();
		expect(transactionRepository.softDelete).toHaveBeenCalledTimes(1);
		const [manager, records] = record.mock.calls[0];
		expect(manager).toBe(transactionManager);
		expect(records.map((it) => it.subject.id)).toEqual(['log-1', 'log-2']);
		expect(records[0].change.action).toBe(ActionTypeEnum.Deleted);
		expect(records[0].change.previousValues).toContainEqual({ taskId: 'task-login' });
		expect(records[0].change.previousValues).toContainEqual({ stoppedAt: '2026-11-10T11:00:00.000Z' });
	});

	it('deletes alone, without a transaction or rows, when no history option is given', async () => {
		const { handler, repository, dataSource, record } = setup();

		await handler.execute(new TimeLogDeleteCommand([entry('log-1', 'task-login')], false));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(repository.softDelete).toHaveBeenCalledTimes(1);
		expect(record).not.toHaveBeenCalled();
	});
});
