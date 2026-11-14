// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { ActionTypeEnum } from '@gauzy/contracts';
import { TimeLog } from '../../time-log.entity';
import { recordTimeLogHistory } from '../../time-log-history.writer';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogUpdateHandler } from './time-log-update.handler';

// The tenant check on project / task / client / team has its own spec (time-log-references.spec.ts).
jest.mock('../../time-log-references', () => ({ assertTimeLogReferencesOfTenant: jest.fn(async () => undefined) }));
// A database that takes row locks, as PostgreSQL and MySQL do.
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isBetterSqlite3: jest.fn(() => false),
	isSqlite: jest.fn(() => false)
}));
// The history rows themselves have their own spec (time-log-history.writer.spec.ts).
jest.mock('../../time-log-history.writer', () => ({
	...jest.requireActual('../../time-log-history.writer'),
	recordTimeLogHistory: jest.fn(async () => undefined)
}));

/**
 * An edit a person makes is recorded in the entry's history (ever-co/ever-gauzy#11922), in the same transaction
 * as the edit. The timer's own updates (stop, heartbeat, the cut of an overlapped entry) pass no history option and
 * record nothing.
 */
describe('TimeLogUpdateHandler: history of an edit', () => {
	const storedLog = () =>
		new TimeLog({
			id: 'log-1',
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			employeeId: 'employee-paul',
			startedAt: new Date('2026-11-10T09:00:00.000Z'),
			stoppedAt: new Date('2026-11-10T11:00:00.000Z'),
			description: null,
			isBillable: true,
			timesheetId: 'timesheet-1'
		});

	function setup() {
		const transactionRepository = {
			update: jest.fn(async () => ({ affected: 1 })),
			save: jest.fn(async (log: unknown) => log)
		};
		const transactionManager = {
			getRepository: jest.fn(() => transactionRepository),
			findOne: jest.fn(async () => storedLog())
		};
		const repository = {
			update: jest.fn(async () => ({ affected: 1 })),
			findOneBy: jest.fn(async () => storedLog())
		};
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => unknown) => work(transactionManager))
		};
		const handler = new TimeLogUpdateHandler(
			{ execute: jest.fn() } as never,
			repository as never,
			{} as never,
			{} as never,
			{ generateTimeSlots: jest.fn(() => []) } as never,
			dataSource as never
		);
		const record = recordTimeLogHistory as jest.Mock;
		record.mockClear();
		return { handler, repository, dataSource, transactionManager, transactionRepository, record };
	}

	it('writes the edit and its row in one transaction, with what changed and the reason', async () => {
		const { handler, repository, dataSource, transactionManager, transactionRepository, record } = setup();

		await handler.execute(
			new TimeLogUpdateCommand(
				{ description: 'Pairing with Amina', isBillable: false },
				storedLog(),
				null,
				false,
				{
					reason: 'Wrong billable'
				}
			)
		);

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(repository.update).not.toHaveBeenCalled();
		expect(transactionRepository.update).toHaveBeenCalledWith(
			{ id: 'log-1', tenantId: 'tenant-1' },
			{ description: 'Pairing with Amina', isBillable: false }
		);
		const [manager, [entry]] = record.mock.calls[0];
		expect(manager).toBe(transactionManager);
		expect(entry.reason).toBe('Wrong billable');
		expect(entry.subject).toMatchObject({ id: 'log-1', employeeId: 'employee-paul', tenantId: 'tenant-1' });
		expect(entry.change).toEqual({
			action: ActionTypeEnum.Updated,
			updatedFields: ['description', 'isBillable'],
			previousValues: [{ description: null }, { isBillable: true }],
			updatedValues: [{ description: 'Pairing with Amina' }, { isBillable: false }]
		});
	});

	it('takes the values before from the entry read under lock in the transaction, an edit saved meanwhile included', async () => {
		const { handler, transactionManager, record } = setup();
		// Another edit saved "Alpha" after this one first read the entry, which had no description then.
		transactionManager.findOne.mockResolvedValue(new TimeLog({ ...storedLog(), description: 'Alpha' }));

		await handler.execute(new TimeLogUpdateCommand({ description: 'Beta' }, storedLog(), null, false, {}));

		expect(transactionManager.findOne).toHaveBeenCalledWith(
			TimeLog,
			expect.objectContaining({
				where: { id: 'log-1', tenantId: 'tenant-1' },
				lock: { mode: 'pessimistic_write' }
			})
		);
		const [, [entry]] = record.mock.calls[0];
		expect(entry.change).toEqual({
			action: ActionTypeEnum.Updated,
			updatedFields: ['description'],
			previousValues: [{ description: 'Alpha' }],
			updatedValues: [{ description: 'Beta' }]
		});
	});

	it('records no row for an edit that changes nothing it tracks', async () => {
		const { handler, record } = setup();

		await handler.execute(new TimeLogUpdateCommand({ description: '' }, storedLog(), null, false, {}));

		expect(record).not.toHaveBeenCalled();
	});

	it('skips an update, with no row, when the entry was deleted for good since it was first read', async () => {
		const { handler, transactionManager, transactionRepository, record } = setup();
		transactionManager.findOne.mockResolvedValue(null);

		await handler.execute(new TimeLogUpdateCommand({ description: 'Beta' }, storedLog(), null, false, {}));

		expect(transactionRepository.update).not.toHaveBeenCalled();
		expect(record).not.toHaveBeenCalled();
	});

	it('stops a move before its save when the entry was deleted for good since it was first read', async () => {
		const { handler, transactionManager, transactionRepository, record } = setup();
		transactionManager.findOne.mockResolvedValue(null);
		const applyRelease = jest.fn(async () => undefined);
		Object.assign(handler, {
			commandBus: { execute: jest.fn(async () => ({ id: 'timesheet-amina' })) },
			planRelease: jest.fn(async () => undefined),
			bulkCreateTimeSlots: jest.fn(async () => []),
			applyRelease
		});

		const refusal = handler.execute(
			new TimeLogUpdateCommand({ employeeId: 'employee-amina' }, storedLog(), null, false, {})
		);

		await expect(refusal).rejects.toThrow(NotFoundException);
		// A save would have inserted the deleted row again
		expect(transactionRepository.save).not.toHaveBeenCalled();
		expect(applyRelease).not.toHaveBeenCalled();
		expect(record).not.toHaveBeenCalled();
	});

	it('writes alone, without a transaction or a row, when no history option is given', async () => {
		const { handler, repository, dataSource, record } = setup();

		await handler.execute(new TimeLogUpdateCommand({ description: 'Pairing with Amina' }, storedLog()));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(repository.update).toHaveBeenCalledTimes(1);
		expect(record).not.toHaveBeenCalled();
	});
});
