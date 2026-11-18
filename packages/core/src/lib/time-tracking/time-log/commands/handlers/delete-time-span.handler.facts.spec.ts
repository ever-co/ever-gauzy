// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimeLog } from '../../time-log.entity';
import { DeleteTimeSpanHandler } from './delete-time-span.handler';

/** The log a span is deleted from the middle of, as stored. */
const LOG = Object.assign(new TimeLog(), {
	id: 'log-1',
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	employeeId: 'marie',
	timesheetId: 'timesheet-1',
	startedAt: new Date('2026-10-12T09:00:00.000Z'),
	stoppedAt: new Date('2026-10-12T13:00:00.000Z'),
	timeSlots: []
});
const SPLIT_AT = new Date('2026-10-12T11:00:00.000Z');

/**
 * ever-co/ever-gauzy#12071: a span deleted from the middle of a time entry splits it, and the part after the span is a
 * new time entry. Its `time_log.created` fact, for the webhooks, commits with it where the outbox can share its
 * transaction, and is written right after it otherwise; a split taken back tells of the part's deletion.
 */
describe('DeleteTimeSpanHandler: the facts of a split second part', () => {
	function setup(appendsWithinWrites: boolean) {
		// A save gives the part its id, as the database does
		const saveOf = () =>
			jest.fn(async (timeLog: TimeLog) => Object.assign(timeLog, { id: timeLog.id ?? 'second-part' }));
		const transactionManager = { save: saveOf() };
		const timeLogRepository = {
			findOne: jest.fn(async () => ({ id: LOG.id })),
			save: saveOf(),
			delete: jest.fn(async () => ({ affected: 1 })),
			manager: { transaction: jest.fn(async (work: (manager: unknown) => unknown) => work(transactionManager)) }
		};
		// The id each fact was written with, read when it was written: a fact written before the save has none
		const idsWhenWritten: unknown[] = [];
		const facts = {
			appendsWithinWrites: () => appendsWithinWrites,
			record: jest.fn(async (_name: string, timeLog: TimeLog) => {
				idsWhenWritten.push(timeLog?.id);
			}),
			recordWithin: jest.fn(async (_manager: unknown, _name: string, timeLog: TimeLog) => {
				idsWhenWritten.push(timeLog?.id);
			})
		};
		const handler = new DeleteTimeSpanHandler(
			timeLogRepository as any,
			{} as any,
			{ execute: jest.fn() } as any,
			undefined,
			facts as any
		);
		const split = (): Promise<TimeLog> => (handler as any).createSecondPart(LOG, SPLIT_AT, LOG.stoppedAt);
		return { handler, timeLogRepository, transactionManager, facts, idsWhenWritten, split };
	}

	afterEach(() => jest.restoreAllMocks());

	it('writes time_log.created for the second part in the transaction that saves it', async () => {
		const { timeLogRepository, transactionManager, facts, idsWhenWritten, split } = setup(true);

		const secondPart = await split();

		expect(timeLogRepository.manager.transaction).toHaveBeenCalledTimes(1);
		expect(transactionManager.save).toHaveBeenCalledTimes(1);
		expect(timeLogRepository.save).not.toHaveBeenCalled();
		expect(facts.recordWithin).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).toHaveBeenCalledWith(
			transactionManager,
			'time_log.created',
			expect.objectContaining({
				id: 'second-part',
				tenantId: 'tenant-1',
				organizationId: 'organization-1',
				employeeId: 'marie',
				startedAt: SPLIT_AT,
				stoppedAt: LOG.stoppedAt,
				splitFromTimeLogId: LOG.id
			})
		);
		expect(idsWhenWritten).toEqual(['second-part']);
		expect(facts.record).not.toHaveBeenCalled();
		expect(secondPart.id).toBe('second-part');
	});

	it('writes it right after the save where the outbox cannot share its transaction', async () => {
		const { timeLogRepository, facts, idsWhenWritten, split } = setup(false);

		await split();

		expect(timeLogRepository.manager.transaction).not.toHaveBeenCalled();
		expect(timeLogRepository.save).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledWith(
			'time_log.created',
			expect.objectContaining({ id: 'second-part', startedAt: SPLIT_AT })
		);
		expect(idsWhenWritten).toEqual(['second-part']);
		expect(facts.recordWithin).not.toHaveBeenCalled();
	});

	it('writes time_log.deleted when a split refused under the lock takes its second part back', async () => {
		const { handler, timeLogRepository, facts, split } = setup(false);
		const secondPart = await split();
		facts.record.mockClear();

		await (handler as any).takeBackSecondPart(LOG, secondPart, undefined);

		expect(timeLogRepository.delete).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledWith('time_log.deleted', secondPart);
	});

	it('writes no deletion for a second part billed or moved meanwhile, which is kept', async () => {
		const { handler, timeLogRepository, facts, split } = setup(false);
		const secondPart = await split();
		facts.record.mockClear();
		timeLogRepository.delete.mockResolvedValueOnce({ affected: 0 });
		jest.spyOn((handler as any).logger, 'error').mockImplementation(() => undefined);

		await (handler as any).takeBackSecondPart(LOG, secondPart, undefined);

		expect(facts.record).not.toHaveBeenCalled();
	});
});
