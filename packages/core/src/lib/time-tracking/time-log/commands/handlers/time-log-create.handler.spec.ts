// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ITimeLog, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { IntegrationMapSyncTimeLogCommand } from '../../../../integration-map/commands/integration-map.sync-time-log.command';
import { IntegrationMapSyncTimeLogHandler } from '../../../../integration-map/commands/handlers/integration-map.sync-time-log.handler';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { lockedForChange, recordTimeLogHistory } from '../../time-log-history.writer';
import { Employee } from '../../../../core/entities/internal';
import { isRunningTimeLogInput, TimeLogCreateHandler, withRunningLogStoppedAt } from './time-log-create.handler';

// The tenant check on project / task / client / team has its own spec (time-log-references.spec.ts).
jest.mock('../../time-log-references', () => ({ assertTimeLogReferencesOfTenant: jest.fn(async () => undefined) }));
// The history rows themselves have their own spec (time-log-history.writer.spec.ts).
jest.mock('../../time-log-history.writer', () => ({
	...jest.requireActual('../../time-log-history.writer'),
	recordTimeLogHistory: jest.fn(async () => undefined)
}));

/**
 * A running time log could be stored with a null `stoppedAt`: `TimeLogCreateHandler` gives a desktop-source log
 * `isRunning: true` when the input does not say, and wrote `stoppedAt` only when the input named one, and
 * `IntegrationMapSyncTimeLogHandler` passes its entity straight in. The timer status and stop / toggle reads look
 * for a running log with `stoppedAt IS NOT NULL`, so such a row ran unseen. The handler now writes a running log
 * with `stoppedAt = startedAt`, the shape `TimerService.startTimer` gives it; the reads are covered in
 * timer.service.running-log.spec.ts.
 */

const TENANT_ID = 'tenant-1';
const ORGANIZATION_ID = 'organization-1';
const EMPLOYEE_ID = 'employee-1';
const STARTED_AT = new Date('2026-10-24T09:00:00.000Z');
const STOPPED_AT = new Date('2026-10-24T09:30:00.000Z');

function createHandler(dataSource?: unknown, facts?: unknown) {
	const saved: TimeLog[] = [];
	const typeOrmTimeLogRepository = {
		save: jest.fn(async (timeLog: TimeLog) => {
			timeLog.id = timeLog.id ?? `log-${saved.length + 1}`;
			saved.push(timeLog);
			return timeLog;
		})
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown) =>
			command instanceof TimesheetFirstOrCreateCommand ? { id: 'timesheet-1' } : undefined
		)
	};
	const timeSlotService = {
		generateTimeSlots: jest.fn((start: Date, end: Date) => generateTimeSlots(start, end)),
		bulkCreate: jest.fn(async (slots: unknown[]) => slots)
	};
	const timeLogService = {
		findOneByIdString: jest.fn(async (id: string) => saved.find((timeLog) => timeLog.id === id) ?? null)
	};
	const handler = new TimeLogCreateHandler(
		typeOrmTimeLogRepository as any,
		{} as any,
		commandBus as any,
		timeSlotService as any,
		timeLogService as any,
		dataSource as never,
		facts as never
	);
	return { handler, saved, timeSlotService };
}

const input = (overrides: Partial<TimeLog>): Partial<TimeLog> => ({
	employeeId: EMPLOYEE_ID,
	organizationId: ORGANIZATION_ID,
	tenantId: TENANT_ID,
	startedAt: STARTED_AT,
	...overrides
});

describe('TimeLogCreateHandler: a running log is written with stoppedAt = startedAt', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});
	afterEach(() => jest.restoreAllMocks());

	describe('isRunningTimeLogInput', () => {
		it('follows the input when it says', () => {
			expect(isRunningTimeLogInput({ isRunning: true })).toBe(true);
			expect(isRunningTimeLogInput({ isRunning: false, source: TimeLogSourceEnum.DESKTOP })).toBe(false);
		});

		it('defaults to running for a desktop log only, as the entity default does', () => {
			expect(isRunningTimeLogInput({ source: TimeLogSourceEnum.DESKTOP })).toBe(true);
			expect(isRunningTimeLogInput({ source: TimeLogSourceEnum.WEB_TIMER })).toBe(false);
			expect(isRunningTimeLogInput({ source: TimeLogSourceEnum.HUBSTAFF })).toBe(false);
			expect(isRunningTimeLogInput({})).toBe(false);
		});
	});

	describe('withRunningLogStoppedAt', () => {
		it('stamps stoppedAt = startedAt on a running log that names no end', () => {
			expect(withRunningLogStoppedAt(input({ isRunning: true }))).toMatchObject({
				isRunning: true,
				startedAt: STARTED_AT,
				stoppedAt: STARTED_AT
			});
			const desktopWithNullEnd = input({ source: TimeLogSourceEnum.DESKTOP, stoppedAt: null });
			expect(withRunningLogStoppedAt(desktopWithNullEnd)).toMatchObject({ stoppedAt: STARTED_AT });
		});

		it('keeps a stoppedAt the input names', () => {
			expect(withRunningLogStoppedAt(input({ isRunning: true, stoppedAt: STOPPED_AT })).stoppedAt).toBe(
				STOPPED_AT
			);
		});

		it('leaves a log that is not running as it is', () => {
			const notRunning = input({ source: TimeLogSourceEnum.WEB_TIMER });
			expect(withRunningLogStoppedAt(notRunning)).toBe(notRunning);
			expect(withRunningLogStoppedAt(notRunning).stoppedAt).toBeUndefined();
		});

		it('does not change the caller object', () => {
			const running = input({ isRunning: true });
			withRunningLogStoppedAt(running);
			expect(running.stoppedAt).toBeUndefined();
		});
	});

	describe('execute', () => {
		it('CONTROL: the timer start path already sends stoppedAt = startedAt, and gets no blank slots for it', () => {
			expect(generateTimeSlots(STARTED_AT, STARTED_AT)).toEqual([]);
		});

		it('writes a running log with no stoppedAt as the timer start path does', async () => {
			const { handler, saved } = createHandler();

			await handler.execute(new TimeLogCreateCommand(input({ isRunning: true })));

			expect(saved).toHaveLength(1);
			expect(saved[0]).toMatchObject({ isRunning: true, startedAt: STARTED_AT, stoppedAt: STARTED_AT });
			expect(saved[0].timeSlots).toEqual([]);
		});

		it('writes a desktop log that names no end (running by default) with stoppedAt = startedAt', async () => {
			const { handler, saved } = createHandler();

			await handler.execute(new TimeLogCreateCommand(input({ source: TimeLogSourceEnum.DESKTOP })));

			expect(saved[0]).toMatchObject({ isRunning: true, stoppedAt: STARTED_AT });
		});

		it('keeps a completed log as before: its stoppedAt, and the blank slots between', async () => {
			const { handler, saved, timeSlotService } = createHandler();

			await handler.execute(
				new TimeLogCreateCommand(input({ source: TimeLogSourceEnum.WEB_TIMER, stoppedAt: STOPPED_AT }))
			);

			expect(saved[0]).toMatchObject({ isRunning: false, stoppedAt: STOPPED_AT });
			expect(timeSlotService.generateTimeSlots).toHaveBeenCalledWith(STARTED_AT, STOPPED_AT);
			expect(saved[0].timeSlots).toHaveLength(3);
		});
	});

	describe('IntegrationMapSyncTimeLogHandler, which passes its entity straight to the create', () => {
		it('stores a running synced log with stoppedAt = startedAt', async () => {
			const { handler: createHandlerInstance, saved } = createHandler();
			const commandBus = {
				execute: jest.fn(async (command: unknown) =>
					command instanceof TimeLogCreateCommand
						? createHandlerInstance.execute(command)
						: { id: 'integration-map-1' }
				)
			};
			const integrationMapService = {
				// Not mapped yet: the handler creates the log
				findOneByWhereOptions: jest.fn(async () => {
					throw new Error('not found');
				})
			};
			const syncHandler = new IntegrationMapSyncTimeLogHandler(commandBus as any, integrationMapService as any);

			await syncHandler.execute(
				new IntegrationMapSyncTimeLogCommand({
					sourceId: 'source-1',
					integrationId: 'integration-1',
					organizationId: ORGANIZATION_ID,
					entity: input({ isRunning: true, source: TimeLogSourceEnum.HUBSTAFF }) as Partial<ITimeLog>
				})
			);

			expect(saved).toHaveLength(1);
			expect(saved[0]).toMatchObject({ isRunning: true, stoppedAt: STARTED_AT });
		});
	});
});

describe('TimeLogCreateHandler: a break holds no time slots', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});
	afterEach(() => jest.restoreAllMocks());

	it('writes a break without the blank slots a manual entry of the same range gets', async () => {
		const { handler, saved } = createHandler();

		await handler.execute(new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT, logType: TimeLogType.MANUAL })));
		await handler.execute(new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT, logType: TimeLogType.BREAK })));

		expect(saved[0].timeSlots.length).toBe(3);
		expect(saved[1]).toMatchObject({ logType: TimeLogType.BREAK, timeSlots: [] });
	});

	it('drops the slots a break is sent with', async () => {
		const { handler, saved } = createHandler();
		const sentSlot = { startedAt: STARTED_AT, duration: 600, keyboard: 5, mouse: 5, overall: 300 };

		await handler.execute(
			new TimeLogCreateCommand(
				input({ stoppedAt: STOPPED_AT, logType: TimeLogType.BREAK, timeSlots: [sentSlot] as any })
			)
		);

		expect(saved[0].timeSlots).toEqual([]);
	});
});

/**
 * Time added by a person is recorded in the entry's history (ever-co/ever-gauzy#11922), written in the same
 * transaction as the entry. What the timer, a tracker or an integration writes records nothing.
 */
describe('TimeLogCreateHandler: history of time added by hand', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});
	afterEach(() => jest.restoreAllMocks());

	function createHandlerWithTransaction() {
		const transactionRepository = { save: jest.fn(async (timeLog: TimeLog) => timeLog) };
		const transactionManager = { getRepository: jest.fn(() => transactionRepository) };
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => Promise<void>) => work(transactionManager))
		};
		const { handler } = createHandler(dataSource);
		const repository = (handler as unknown as { typeOrmTimeLogRepository: { save: jest.Mock } })
			.typeOrmTimeLogRepository;
		const record = recordTimeLogHistory as jest.Mock;
		record.mockClear();
		return { handler, repository, dataSource, transactionManager, transactionRepository, record };
	}

	it('writes the entry and its "created" row in one transaction, with the reason given', async () => {
		const { handler, repository, dataSource, transactionManager, transactionRepository, record } =
			createHandlerWithTransaction();

		await handler.execute(
			new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT, reason: 'Forgot to start timer' }), {
				reason: 'Forgot to start timer'
			})
		);

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(repository.save).not.toHaveBeenCalled();
		expect(transactionRepository.save).toHaveBeenCalledTimes(1);
		const [manager, [entry]] = record.mock.calls[0];
		expect(manager).toBe(transactionManager);
		expect(entry.reason).toBe('Forgot to start timer');
		expect(entry.change.action).toBe('Created');
		expect(entry.change.updatedValues).toContainEqual({ stoppedAt: STOPPED_AT.toISOString() });
	});

	it('records nothing, and opens no transaction, for a log written without a history option', async () => {
		const { handler, repository, dataSource, record } = createHandlerWithTransaction();

		await handler.execute(new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT })));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(repository.save).toHaveBeenCalledTimes(1);
		expect(record).not.toHaveBeenCalled();
	});
});

/** The mocked history writer itself, whose dialect answer a case sets (the handler reads it through this module). */
const historyWriter: { locksRowsForChange: () => boolean } = jest.requireMock('../../time-log-history.writer');

/**
 * A timer start closed the employee's runs going, then wrote its own run through other connections: a close that
 * failed, or a run written between the two, left the employee with two runs going (ever-co/ever-gauzy#11826). A
 * start's run is now written in one transaction with the check, under the employee's row lock, that no other run of a
 * timer client is still going, where the database locks rows (PostgreSQL, MySQL).
 */
describe("TimeLogCreateHandler: a timer start's run is the only run going", () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(historyWriter, 'locksRowsForChange').mockReturnValue(true);
	});
	afterEach(() => jest.restoreAllMocks());

	/** A handler whose transaction finds `going` runs of the employee still going. */
	function createStart(going: number, failsInsert?: Error) {
		const transactionRepository = {
			save: jest.fn(async (timeLog: TimeLog) => {
				if (failsInsert) {
					throw failsInsert;
				}
				return timeLog;
			})
		};
		const transactionManager = {
			getRepository: jest.fn(() => transactionRepository),
			findOne: jest.fn(async () => ({ id: EMPLOYEE_ID })),
			count: jest.fn(async () => going)
		};
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => Promise<void>) => work(transactionManager))
		};
		const { handler } = createHandler(dataSource);
		const repository = (handler as unknown as { typeOrmTimeLogRepository: { save: jest.Mock } })
			.typeOrmTimeLogRepository;
		return { handler, repository, dataSource, transactionManager, transactionRepository };
	}

	const startRun = (source = TimeLogSourceEnum.WEB_TIMER) =>
		new TimeLogCreateCommand(input({ source, isRunning: true, stoppedAt: STARTED_AT }), undefined, {
			isOnlyRun: true
		});

	/** The refusal's code, or undefined when the run was written. */
	const refusalCodeOf = (work: Promise<unknown>) =>
		work.then(
			() => undefined,
			(error: { getResponse?: () => { code?: string } }) => error?.getResponse?.()?.code ?? String(error)
		);

	it('writes nothing and refuses the start while another run of the employee is still going', async () => {
		const { handler, repository, transactionManager, transactionRepository } = createStart(1);

		expect(await refusalCodeOf(handler.execute(startRun()))).toBe('TIMER_STILL_RUNNING');

		expect(transactionRepository.save).not.toHaveBeenCalled();
		expect(repository.save).not.toHaveBeenCalled();
		// Checked after the employee's row was read for the lock, in the same transaction: this employee, in their
		// tenant, with the lock the dialect takes (none on SQLite, whose single writer serializes)
		expect(transactionManager.findOne).toHaveBeenCalledTimes(1);
		expect(transactionManager.findOne).toHaveBeenCalledWith(Employee, {
			where: { id: EMPLOYEE_ID, tenantId: TENANT_ID },
			...lockedForChange()
		});
		expect(transactionManager.findOne.mock.invocationCallOrder[0]).toBeLessThan(
			transactionManager.count.mock.invocationCallOrder[0]
		);
	});

	it("counts the employee's running rows of timer clients only, not a tracker's uploads", async () => {
		const { handler, transactionManager } = createStart(0);

		await handler.execute(startRun(TimeLogSourceEnum.DESKTOP));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const options = (transactionManager.count.mock.calls[0] as unknown[])[1] as { where: Record<string, any> };
		expect(options.where).toMatchObject({ employeeId: EMPLOYEE_ID, tenantId: TENANT_ID, isRunning: true });
		expect(JSON.stringify(options.where.source)).toContain(TimeLogSourceEnum.DESKTOP);
		expect(options.where.source.type).toBe('not');
	});

	it('writes the run in the transaction of the check when no other run is going', async () => {
		const { handler, repository, dataSource, transactionRepository } = createStart(0);

		await handler.execute(startRun());

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(transactionRepository.save).toHaveBeenCalledTimes(1);
		expect(repository.save).not.toHaveBeenCalled();
	});

	it("refuses the start when the running-log key refuses its run, written past another start's check", async () => {
		const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
		const { handler } = createStart(0, duplicate);

		expect(await refusalCodeOf(handler.execute(startRun()))).toBe('TIMER_STILL_RUNNING');
	});

	it('leaves a log written without the option as before: no transaction, no check', async () => {
		const { handler, repository, dataSource, transactionManager } = createStart(1);

		await handler.execute(new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT })));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(transactionManager.count).not.toHaveBeenCalled();
		expect(repository.save).toHaveBeenCalledTimes(1);
	});
});

/**
 * SQLite takes no row lock and runs every write on its one connection, where a transaction begun beside another nests
 * into it, and the refusal's rollback would take the other request's writes with it (as `PublicInvoiceService` notes).
 * There a start's run is checked and written without a transaction, and the running-log key refuses a run written
 * between the two.
 */
describe("TimeLogCreateHandler: a timer start's run is the only run going, on SQLite", () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(historyWriter, 'locksRowsForChange').mockReturnValue(false);
	});
	afterEach(() => jest.restoreAllMocks());

	/** A handler whose repository's manager finds `going` runs of the employee still going. */
	function createStart(going: number) {
		const dataSource = { transaction: jest.fn() };
		const { handler } = createHandler(dataSource);
		const repository = (
			handler as unknown as { typeOrmTimeLogRepository: { save: jest.Mock; manager?: unknown } }
		).typeOrmTimeLogRepository;
		const manager = {
			findOne: jest.fn(async () => ({ id: EMPLOYEE_ID })),
			count: jest.fn(async () => going)
		};
		repository.manager = manager;
		return { handler, repository, dataSource, manager };
	}

	const startRun = () =>
		new TimeLogCreateCommand(
			input({ source: TimeLogSourceEnum.WEB_TIMER, isRunning: true, stoppedAt: STARTED_AT }),
			undefined,
			{ isOnlyRun: true }
		);

	/** The refusal's code, or undefined when the run was written. */
	const refusalCodeOf = (work: Promise<unknown>) =>
		work.then(
			() => undefined,
			(error: { getResponse?: () => { code?: string } }) => error?.getResponse?.()?.code ?? String(error)
		);

	it('checks that no other run is going, then writes the run, without a transaction', async () => {
		const { handler, repository, dataSource, manager } = createStart(0);

		await handler.execute(startRun());

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(manager.count).toHaveBeenCalledTimes(1);
		expect(repository.save).toHaveBeenCalledTimes(1);
		expect(manager.count.mock.invocationCallOrder[0]).toBeLessThan(repository.save.mock.invocationCallOrder[0]);
	});

	it('writes nothing and refuses the start while another run of the employee is still going', async () => {
		const { handler, repository, dataSource } = createStart(1);

		expect(await refusalCodeOf(handler.execute(startRun()))).toBe('TIMER_STILL_RUNNING');

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(repository.save).not.toHaveBeenCalled();
	});

	it('refuses the start when the running-log key refuses a run written between the check and the insert', async () => {
		const { handler, repository } = createStart(0);
		const duplicate = Object.assign(new Error('UNIQUE constraint failed: time_log.employeeId'), {
			code: 'SQLITE_CONSTRAINT_UNIQUE'
		});
		repository.save.mockRejectedValueOnce(duplicate);

		expect(await refusalCodeOf(handler.execute(startRun()))).toBe('TIMER_STILL_RUNNING');
	});
});

/**
 * ever-co/ever-gauzy#12071: a new entry's fact, for the webhooks, commits with it where the outbox can share its
 * transaction, and is written right after it otherwise.
 */
describe('TimeLogCreateHandler: the fact of a new entry', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});
	afterEach(() => jest.restoreAllMocks());

	function createHandlerWithFacts(appendsWithinWrites: boolean) {
		// The transaction's save gives the entry its id, as the database does
		const transactionRepository = {
			save: jest.fn(async (timeLog: TimeLog) => {
				timeLog.id = timeLog.id ?? 'log-in-transaction';
				return timeLog;
			})
		};
		const transactionManager = { getRepository: jest.fn(() => transactionRepository) };
		const dataSource = {
			transaction: jest.fn(async (work: (manager: unknown) => Promise<void>) => work(transactionManager))
		};
		// The id each fact was written with, read when it was written: a fact written before the save has none
		const idsWhenWritten: unknown[] = [];
		const facts = {
			appendsWithinWrites: () => appendsWithinWrites,
			record: jest.fn(async (_name: string, timeLog: TimeLog) => {
				idsWhenWritten.push(timeLog.id);
			}),
			recordWithin: jest.fn(async (_manager: unknown, _name: string, timeLog: TimeLog) => {
				idsWhenWritten.push(timeLog.id);
			})
		};
		const { handler } = createHandler(dataSource, facts);
		return { handler, dataSource, transactionManager, facts, idsWhenWritten };
	}

	it('writes time_log.created in the transaction of the entry, once it is saved', async () => {
		const { handler, dataSource, transactionManager, facts, idsWhenWritten } = createHandlerWithFacts(true);

		await handler.execute(new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT })));

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).toHaveBeenCalledTimes(1);
		expect(facts.recordWithin).toHaveBeenCalledWith(
			transactionManager,
			'time_log.created',
			expect.objectContaining({ id: 'log-in-transaction', employeeId: EMPLOYEE_ID })
		);
		expect(idsWhenWritten).toEqual(['log-in-transaction']);
		expect(facts.record).not.toHaveBeenCalled();
	});

	it('writes it right after the entry, opening no transaction, where the outbox cannot share one', async () => {
		const { handler, dataSource, facts, idsWhenWritten } = createHandlerWithFacts(false);

		await handler.execute(new TimeLogCreateCommand(input({ stoppedAt: STOPPED_AT })));

		expect(dataSource.transaction).not.toHaveBeenCalled();
		expect(facts.record).toHaveBeenCalledTimes(1);
		expect(facts.record).toHaveBeenCalledWith(
			'time_log.created',
			expect.objectContaining({ id: 'log-1', employeeId: EMPLOYEE_ID })
		);
		expect(idsWhenWritten).toEqual(['log-1']);
		expect(facts.recordWithin).not.toHaveBeenCalled();
	});
});
