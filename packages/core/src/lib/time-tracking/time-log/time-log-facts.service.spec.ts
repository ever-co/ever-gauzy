import * as utils from '../../core/utils';
import {
	factOfCreatedLog,
	factOfUpdatedLog,
	TIME_LOG_AGGREGATE_TYPE,
	TIME_LOG_STREAMED_EVENTS,
	TimeLogFactsService
} from './time-log-facts.service';

/**
 * ever-co/ever-gauzy#12071: time entries write their facts to the event outbox, which the signed webhooks deliver. The
 * facts are appended right after the entry's write, in a transaction of their own, and never fail that write.
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
