import * as utils from '../../core/utils';
import * as historyWriter from './time-log-history.writer';
import {
	endsTransaction,
	factOfCreatedLog,
	factOfUpdatedLog,
	TIME_LOG_AGGREGATE_TYPE,
	TIME_LOG_STREAMED_EVENTS,
	TimeLogFactsService
} from './time-log-facts.service';

/**
 * ever-co/ever-gauzy#12071: time entries write their facts to the event outbox, which the signed webhooks deliver. A
 * fact commits with its write, in that write's transaction, where the outbox can share it; otherwise it is appended right
 * after the write, in a transaction of its own. It never fails the write.
 */

const ENTRY = {
	id: 'log-1',
	tenantId: 'tenant-a',
	organizationId: 'org-a',
	employeeId: 'employee-a',
	projectId: 'project-a',
	taskId: null,
	startedAt: new Date('2026-01-05T09:00:00.000Z'),
	stoppedAt: new Date('2026-01-05T09:30:00.000Z'),
	isRunning: false,
	isBillable: true,
	source: 'WEB_TIMER',
	logType: 'TRACKED',
	description: 'A note the person wrote',
	reason: 'A reason for an edit'
};

function createService({ failing = false } = {}) {
	const appended: any[] = [];
	const manager = { name: 'typeorm manager' };
	const outbox = {
		append: jest.fn(async (usedManager: unknown, input: unknown) => {
			if (failing) {
				throw new Error('The outbox refused the row');
			}
			appended.push({ manager: usedManager, input });
		}),
		mikroOrmEventOutboxRepository: undefined as any
	};
	const dataSource = { manager: { transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)) } };
	const declared: string[] = [];
	const catalogue = { declare: jest.fn((...names: string[]) => declared.push(...names)), names: () => declared };
	const service = new TimeLogFactsService(outbox as any, catalogue as any, undefined, dataSource as any);
	return { service, outbox, dataSource, appended, manager, declared };
}

describe('TimeLogFactsService (#12071)', () => {
	afterEach(() => jest.restoreAllMocks());

	it('appends the fact under the entry, with its ids and times and without its description', async () => {
		const { service, appended, manager, dataSource } = createService();

		await service.record('time_log.stopped', ENTRY as any);

		expect(dataSource.manager.transaction).toHaveBeenCalledTimes(1);
		expect(appended).toHaveLength(1);
		expect(appended[0].manager).toBe(manager);
		expect(appended[0].input).toMatchObject({
			name: 'time_log.stopped',
			aggregateType: TIME_LOG_AGGREGATE_TYPE,
			aggregateId: 'log-1',
			tenantId: 'tenant-a',
			organizationId: 'org-a'
		});
		expect(appended[0].input.data).toEqual({
			timeLogId: 'log-1',
			employeeId: 'employee-a',
			projectId: 'project-a',
			taskId: null,
			organizationContactId: null,
			organizationTeamId: null,
			startedAt: ENTRY.startedAt,
			stoppedAt: ENTRY.stoppedAt,
			isRunning: false,
			isBillable: true,
			source: 'WEB_TIMER',
			logType: 'TRACKED'
		});
	});

	it('never fails the entry write when the outbox refuses the fact', async () => {
		const { service } = createService({ failing: true });
		jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

		await expect(service.record('time_log.created', ENTRY as any)).resolves.toBeUndefined();
	});

	it('writes nothing for an entry without an id', async () => {
		const { service, outbox } = createService();

		await service.record('time_log.deleted', null);
		await service.record('time_log.deleted', {} as any);

		expect(outbox.append).not.toHaveBeenCalled();
	});

	it('writes nothing for an entry that states no tenant or organization, which the outbox would take from the request', async () => {
		const { service, outbox } = createService();
		const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		const writeTransaction = { transaction: jest.fn(async (work: (m: unknown) => unknown) => work({})) };

		await service.record('time_log.stopped', { ...ENTRY, organizationId: undefined } as any);
		await service.record('time_log.stopped', { ...ENTRY, tenantId: undefined } as any);
		const orphan = { ...ENTRY, organizationId: null } as any;
		await service.recordWithin(writeTransaction as any, 'time_log.stopped', orphan);

		expect(outbox.append).not.toHaveBeenCalled();
		expect(writeTransaction.transaction).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledTimes(3);
	});

	it('appends through MikroORM under MikroORM', async () => {
		const { service, outbox, dataSource } = createService();
		const transactionManager = { name: 'mikro-orm transaction' };
		const fork = { transactional: jest.fn(async (work: (em: unknown) => unknown) => work(transactionManager)) };
		outbox.mikroOrmEventOutboxRepository = { getEntityManager: () => ({ fork: () => fork }) };
		jest.spyOn(utils, 'getORMType').mockReturnValue(utils.MultiORMEnum.MikroORM);

		await service.record('time_log.started', ENTRY as any);

		expect(fork.transactional).toHaveBeenCalledTimes(1);
		expect(outbox.append.mock.calls[0][0]).toBe(transactionManager);
		expect(dataSource.manager.transaction).not.toHaveBeenCalled();
	});

	it('appends the fact in the transaction of its write, through a savepoint', async () => {
		const { service, appended, dataSource } = createService();
		const savepoint = { name: 'savepoint' };
		const writeTransaction = { transaction: jest.fn(async (work: (m: unknown) => unknown) => work(savepoint)) };

		await service.recordWithin(writeTransaction as any, 'time_log.started', ENTRY as any);

		expect(writeTransaction.transaction).toHaveBeenCalledTimes(1);
		expect(appended).toHaveLength(1);
		expect(appended[0].manager).toBe(savepoint);
		expect(appended[0].input).toMatchObject({
			name: 'time_log.started',
			aggregateId: 'log-1',
			tenantId: 'tenant-a'
		});
		expect(dataSource.manager.transaction).not.toHaveBeenCalled();
	});

	it('reads the entry inside the savepoint when handed a read, and a read that fails never fails the write', async () => {
		const { service, appended, outbox } = createService();
		const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		const savepoint = { name: 'savepoint' };
		// Which savepoint invocation is open, so that the read and the append are seen to run inside the same one
		let invocation = 0;
		let open: number | null = null;
		const writeTransaction = {
			transaction: jest.fn(async (work: (m: unknown) => unknown) => {
				open = ++invocation;
				try {
					return await work(savepoint);
				} finally {
					open = null;
				}
			})
		};
		const during: string[] = [];
		const read = jest.fn(async (manager: unknown) => {
			during.push(`read in ${open}`);
			return manager === savepoint ? ENTRY : null;
		});
		const append = outbox.append.getMockImplementation();
		outbox.append.mockImplementationOnce(async (usedManager: unknown, input: unknown) => {
			during.push(`append in ${open}`);
			return append(usedManager, input);
		});

		await service.recordWithin(writeTransaction as any, 'time_log.updated', read as any);

		expect(read).toHaveBeenCalledWith(savepoint);
		expect(during).toEqual(['read in 1', 'append in 1']);
		expect(appended).toHaveLength(1);
		expect(appended[0].input).toMatchObject({ name: 'time_log.updated', aggregateId: 'log-1' });

		const failing = jest.fn(async () => {
			throw new Error('The read failed');
		});
		await expect(
			service.recordWithin(writeTransaction as any, 'time_log.updated', failing as any)
		).resolves.toBeUndefined();
		expect(appended).toHaveLength(1);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('tells of the entry as its write states it when the read fails, in a savepoint of its own', async () => {
		const { service, appended, outbox } = createService();
		jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		// Each savepoint invocation, as it opens and closes, and the append within them
		const steps: string[] = [];
		let invocation = 0;
		let open: number | null = null;
		const writeTransaction = {
			transaction: jest.fn(async (work: (m: unknown) => unknown) => {
				const current = ++invocation;
				open = current;
				steps.push(`open ${current}`);
				try {
					return await work({});
				} finally {
					steps.push(`close ${current}`);
					open = null;
				}
			})
		};
		const append = outbox.append.getMockImplementation();
		outbox.append.mockImplementation(async (usedManager: unknown, input: unknown) => {
			steps.push(`append in ${open}`);
			return append(usedManager, input);
		});
		const failing = jest.fn(async () => {
			throw new Error('The read failed');
		});

		await service.recordWithin(writeTransaction as any, 'time_log.stopped', failing as any, ENTRY as any);

		// The failed read's savepoint closes before the fallback's opens, and the fallback appends in its own
		expect(steps).toEqual(['open 1', 'close 1', 'open 2', 'append in 2', 'close 2']);
		expect(appended).toHaveLength(1);
		expect(appended[0].input).toMatchObject({ name: 'time_log.stopped', aggregateId: 'log-1' });
	});

	it('throws an error that ended the write transaction itself, a MySQL deadlock, and no fallback is written', async () => {
		const { service, appended } = createService();
		const deadlock = Object.assign(new Error('Deadlock found when trying to get lock'), {
			driverError: { code: 'ER_LOCK_DEADLOCK', errno: 1213 }
		});
		const writeTransaction = {
			transaction: jest.fn(async () => {
				throw deadlock;
			})
		};

		await expect(service.recordWithin(writeTransaction as any, 'time_log.deleted', ENTRY as any)).rejects.toBe(
			deadlock
		);
		const read = jest.fn(async () => ENTRY);
		await expect(
			service.recordWithin(writeTransaction as any, 'time_log.deleted', read as any, ENTRY as any)
		).rejects.toBe(deadlock);
		expect(writeTransaction.transaction).toHaveBeenCalledTimes(2);
		expect(appended).toHaveLength(0);
		expect(endsTransaction(new Error('duplicate key value violates unique constraint'))).toBe(false);
		expect(endsTransaction({ code: '40P01' })).toBe(false);
	});

	it('never fails the write when the outbox refuses the fact inside its transaction', async () => {
		const { service } = createService({ failing: true });
		const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		const writeTransaction = { transaction: jest.fn(async (work: (m: unknown) => unknown) => work({})) };

		await expect(
			service.recordWithin(writeTransaction as any, 'time_log.stopped', ENTRY as any)
		).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('appends in the transaction of the write under TypeORM on a database that locks rows, after it otherwise', () => {
		const { service } = createService();
		const orm = jest.spyOn(utils, 'getORMType').mockReturnValue(utils.MultiORMEnum.TypeORM);
		const locks = jest.spyOn(historyWriter, 'locksRowsForChange').mockReturnValue(true);
		expect(service.appendsWithinWrites()).toBe(true);

		locks.mockReturnValue(false);
		expect(service.appendsWithinWrites()).toBe(false);

		locks.mockReturnValue(true);
		orm.mockReturnValue(utils.MultiORMEnum.MikroORM);
		expect(service.appendsWithinWrites()).toBe(false);
	});

	it('declares the five names so that a webhook subscribed to time_log.* receives them', () => {
		const { service, declared } = createService();

		service.onModuleInit();

		expect(declared).toEqual([...TIME_LOG_STREAMED_EVENTS]);
		expect(declared).toEqual([
			'time_log.started',
			'time_log.stopped',
			'time_log.created',
			'time_log.updated',
			'time_log.deleted'
		]);
	});

	it('names a new running entry started, a finished one created, a stop stopped and any other change updated', () => {
		expect(factOfCreatedLog({ isRunning: true })).toBe('time_log.started');
		expect(factOfCreatedLog({ isRunning: false })).toBe('time_log.created');
		expect(factOfUpdatedLog(true)).toBe('time_log.stopped');
		expect(factOfUpdatedLog(false)).toBe('time_log.updated');
	});
});
