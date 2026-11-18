// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimeLog } from '../../time-log.entity';
import * as historyWriter from '../../time-log-history.writer';
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
		const transactionManager: Record<string, jest.Mock> = { getRepository: jest.fn(() => transactionRepository) };
		// A savepoint of it, on the same rows
		transactionManager.transaction = jest.fn(async (work: (manager: unknown) => unknown) => work(transactionManager));
		// The deletion's transaction: its work, then its commit
		const repository = {
			softDelete: jest.fn(async () => ({ affected: 1 })),
			find: jest.fn(async () => [stored])
		};
		const committed = jest.fn();
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => unknown) => {
				const result = await work(transactionManager);
				committed();
				return result;
			})
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
		return { handler, repository, dataSource, transactionManager, transactionRepository, facts, committed };
	}
	/** When the first call of a mock was made, among every mock's calls. */
	const calledAt = (mock: jest.Mock) => mock.mock.invocationCallOrder[0];

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('writes time_log.deleted in the transaction of the deletion, with the ids read as stored', async () => {
		const { handler, repository, dataSource, transactionManager, transactionRepository, facts } = setup(true);

		await handler.execute(new TimeLogDeleteCommand(handed, false));

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(repository.softDelete).not.toHaveBeenCalled();
		expect(transactionRepository.softDelete).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).toHaveBeenCalledWith(transactionManager, 'time_log.deleted', stored);
		expect(calledAt(facts.recordWithin)).toBeGreaterThan(calledAt(transactionRepository.softDelete));
		expect(facts.record).not.toHaveBeenCalled();
		// Read under the rows' locks, in one order: a deletion of the same entries that went through meanwhile is
		// waited for, and what it took is not told of again
		expect(transactionRepository.find).toHaveBeenCalledWith(expect.objectContaining({ order: { id: 'ASC' } }));
	});

	it('writes it right after the deletion where the outbox cannot share its transaction, with the ids read as stored', async () => {
		const { handler, repository, dataSource, facts } = setup(false);

		await handler.execute(new TimeLogDeleteCommand(handed, false));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(repository.softDelete).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledWith('time_log.deleted', stored);
		expect(calledAt(facts.record)).toBeGreaterThan(calledAt(repository.softDelete));
		expect(facts.recordWithin).not.toHaveBeenCalled();
	});

	it('writes it after the commit of the history, for a deletion by a person where the outbox cannot share it', async () => {
		const record = jest.spyOn(historyWriter, 'recordTimeLogHistory').mockResolvedValue(undefined);
		const { handler, dataSource, transactionRepository, facts, committed } = setup(false);

		await handler.execute(new TimeLogDeleteCommand(handed, false, { reason: 'Logged twice' }));

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(transactionRepository.softDelete).toHaveBeenCalledTimes(1);
		expect(record).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).not.toHaveBeenCalled();
		expect(facts.record).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledWith('time_log.deleted', stored);
		expect(calledAt(facts.record)).toBeGreaterThan(calledAt(committed));
	});

	it('tells of nothing when the deletion by a person rolls back', async () => {
		jest.spyOn(historyWriter, 'recordTimeLogHistory').mockRejectedValue(new Error('The history was refused'));
		const { handler, facts } = setup(false);

		await expect(
			handler.execute(new TimeLogDeleteCommand(handed, false, { reason: 'Logged twice' }))
		).rejects.toThrow('The history was refused');

		expect(facts.record).not.toHaveBeenCalled();
		expect(facts.recordWithin).not.toHaveBeenCalled();
	});

	it('fails with nothing deleted when the locked read of its transaction fails, as its delete would', async () => {
		const { handler, transactionRepository, facts } = setup(true);
		transactionRepository.find.mockRejectedValueOnce(new Error('Deadlock found when trying to get lock'));

		await expect(handler.execute(new TimeLogDeleteCommand(handed, false))).rejects.toThrow('Deadlock found');

		expect(transactionRepository.softDelete).not.toHaveBeenCalled();
		expect(facts.recordWithin).not.toHaveBeenCalled();
		expect(facts.record).not.toHaveBeenCalled();
	});

	it('still deletes when the entries cannot be read for their facts', async () => {
		const { handler, repository, facts } = setup(false);
		repository.find.mockRejectedValueOnce(new Error('The read failed'));
		jest.spyOn((handler as any).logger, 'warn').mockImplementation(() => undefined);

		await expect(handler.execute(new TimeLogDeleteCommand(handed, false))).resolves.toEqual({ affected: 1 });

		expect(repository.softDelete).toHaveBeenCalledTimes(1);
		expect(facts.record).not.toHaveBeenCalled();
	});
});
