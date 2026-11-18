// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimeLog } from '../../time-log.entity';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { TimeLogDeleteHandler } from './time-log-delete.handler';

/**
 * ever-co/ever-gauzy#12071: a deleted entry's fact, for the webhooks, commits with the deletion where the outbox can
 * share its transaction, and is written right after it otherwise; either way with the ids read as stored.
 */
describe('TimeLogDeleteHandler: the facts of a deletion', () => {
	const stored = new TimeLog({
		id: 'log-1',
		tenantId: 'tenant-1',
		organizationId: 'organization-1',
		employeeId: 'employee-paul',
		startedAt: new Date('2026-11-10T09:00:00.000Z'),
		stoppedAt: new Date('2026-11-10T11:00:00.000Z'),
		timeSlots: []
	});
	// The log as a MikroORM read hands it: without its scalar ids
	const handed = [{ id: 'log-1', timeSlots: [] }] as unknown as TimeLog[];

	function setup(appendsWithinWrites: boolean) {
		const transactionRepository = {
			softDelete: jest.fn(async () => ({ affected: 1 })),
			find: jest.fn(async () => [stored])
		};
		const transactionManager = { getRepository: jest.fn(() => transactionRepository) };
		const repository = {
			softDelete: jest.fn(async () => ({ affected: 1 })),
			find: jest.fn(async () => [stored])
		};
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => unknown) => work(transactionManager))
		};
		const facts = {
			appendsWithinWrites: () => appendsWithinWrites,
			record: jest.fn(async () => undefined),
			recordWithin: jest.fn(async () => undefined)
		};
		const commandBus = { execute: jest.fn(async () => undefined) };
		const handler = new TimeLogDeleteHandler(
			repository as never,
			{} as never,
			commandBus as never,
			dataSource as never,
			facts as never
		);
		return { handler, repository, dataSource, transactionManager, transactionRepository, facts };
	}

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('writes time_log.deleted in the transaction of the deletion, with the ids read as stored', async () => {
		const { handler, repository, dataSource, transactionManager, transactionRepository, facts } = setup(true);

		await handler.execute(new TimeLogDeleteCommand(handed, false));

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(repository.softDelete).not.toHaveBeenCalled();
		expect(transactionRepository.softDelete).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).toHaveBeenCalledWith(transactionManager, 'time_log.deleted', stored);
		expect(facts.record).not.toHaveBeenCalled();
	});

	it('writes it right after the deletion where the outbox cannot share its transaction, with the ids read as stored', async () => {
		const { handler, repository, dataSource, facts } = setup(false);

		await handler.execute(new TimeLogDeleteCommand(handed, false));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(repository.softDelete).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledWith('time_log.deleted', stored);
		expect(facts.recordWithin).not.toHaveBeenCalled();
	});
});
