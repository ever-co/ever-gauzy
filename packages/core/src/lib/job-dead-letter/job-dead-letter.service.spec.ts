/**
 * The inspectable dead-letter store (schema chapter §3.22).
 *
 * Five rules, and the suite walks each of them: a row enters `NEW` and leaves as `REPLAYED` or
 * `DISCARDED` and never as an absence, one failure is one row, a replay records something that
 * already happened and happens once, a discard says why, and the tenancy a row is filed under comes
 * from the payload when the queue consumer has no request context of its own.
 *
 * The base CRUD class is doubled, for the reason the ledger's suite states. The service under test is
 * the real one, over an in-memory table whose `where` matching applies equality, the operators the
 * service states, and the ordering and paging its reads ask for.
 */
jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async count(options: any = {}): Promise<any> {
			return this.typeOrmRepository.count(options);
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}
	}

	return { TenantAwareCrudService };
});

/** The request context: null for a queue consumer, a person for an operator. */
const mockRequestContext: { tenantId: string | null; organizationId: string | null; userId: string | null } = {
	tenantId: null,
	organizationId: null,
	userId: null
};

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => mockRequestContext.userId,
		currentTenantId: () => mockRequestContext.tenantId,
		currentOrganizationId: () => mockRequestContext.organizationId,
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

import { DeadLetterStatus } from '@gauzy/contracts';
import { JobDeadLetterService } from './job-dead-letter.service';

const QUEUE = 'token-maintenance';
const OTHER_QUEUE = 'worker-default';
const JOB = 'token.expired.cleanup';
const JOB_ID = 'token-maintenance:expired:42';
const NEW_JOB_ID = 'token-maintenance:expired:99';
const OPERATOR = '33333333-3333-4333-8333-333333333333';
const TENANT = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';

type Row = Record<string, any>;

/** A comparable form of a value, so an id and a date compare the way the database compares them. */
function comparable(value: unknown): string | number {
	if (value instanceof Date) {
		return value.getTime();
	}

	return String(value ?? '');
}

/** The three operators the service states, applied as the database applies them. */
function matchesValue(actual: unknown, expected: unknown): boolean {
	if (expected === undefined) {
		return true;
	}

	if (expected && typeof expected === 'object' && typeof (expected as any).type === 'string') {
		const operator = expected as any;

		switch (operator.type) {
			case 'between':
				return (
					comparable(actual) >= comparable(operator.value[0]) &&
					comparable(actual) <= comparable(operator.value[1])
				);
			case 'moreThanOrEqual':
				return comparable(actual) >= comparable(operator.value);
			case 'in':
				return (operator.value ?? []).some((one: unknown) => comparable(one) === comparable(actual));
			default:
				throw new Error(`the in-memory double does not model the '${operator.type}' operator`);
		}
	}

	return comparable(actual) === comparable(expected);
}

function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([field, expected]) => matchesValue(row[field], expected));
}

/** An in-memory `job_dead_letter` table and the repository over it. */
function world(seed: Row[] = []) {
	const table: Row[] = [...seed];
	let sequence = 0;

	const save = (row: Row): Row => {
		if (row.id) {
			const index = table.findIndex((one) => one.id === row.id);

			if (index >= 0) {
				table[index] = { ...table[index], ...row };

				return table[index];
			}
		}

		const created = { id: `dl-${++sequence}`, ...row };

		table.push(created);

		return created;
	};

	const apply = (options: any = {}): Row[] => {
		let rows = table.filter((row) => matches(row, options.where));

		const [field, direction] = Object.entries(options.order ?? {})[0] ?? [];

		if (field) {
			rows = [...rows].sort((left, right) => {
				const a = comparable(left[field]);
				const b = comparable(right[field]);

				if (a === b) {
					return 0;
				}

				return (a < b ? -1 : 1) * (String(direction).toUpperCase() === 'DESC' ? -1 : 1);
			});
		}

		const skip = options.skip ?? 0;

		return rows.slice(skip, options.take === undefined ? undefined : skip + options.take);
	};

	const repository: any = {
		metadata: { tableName: 'job_dead_letter', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => apply(options),
		count: async (options: any = {}) => table.filter((row) => matches(row, options.where)).length,
		findOne: async (options: any = {}) => table.find((row) => matches(row, options.where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save(row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = table.findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(table[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async () => {
			throw new Error('the dead-letter store has no delete path, and the double refuses one too');
		}
	};

	return {
		table,
		service: new JobDeadLetterService(repository as never, {} as never),
		row: (id: string) => table.find((row) => row.id === id)
	};
}

/** One `job_dead_letter` row, with the fields this suite reads. */
const deadLetterRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: null,
	organizationId: null,
	queueName: QUEUE,
	jobId: JOB_ID,
	jobName: JOB,
	payload: { requestedAt: '2026-01-01T00:00:00.000Z' },
	status: DeadLetterStatus.NEW,
	attemptCount: 3,
	failedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('JobDeadLetterService — recording a job that exhausted its attempts', () => {
	it('records the failure NEW, with the payload stored verbatim for a replay', async () => {
		const { service, row } = world();

		const recorded = await service.recordDeadLetter({
			queueName: ` ${QUEUE} `,
			jobId: JOB_ID,
			jobName: JOB,
			payload: { requestedAt: '2026-01-01T00:00:00.000Z', tenantId: TENANT },
			attemptCount: 3,
			lastError: 'the provider refused the batch'
		});

		expect(recorded.status).toBe(DeadLetterStatus.NEW);
		expect(recorded.queueName).toBe(QUEUE);
		expect(recorded.attemptCount).toBe(3);
		expect(recorded.failedAt).toBeInstanceOf(Date);
		expect(recorded.payload).toEqual({ requestedAt: '2026-01-01T00:00:00.000Z', tenantId: TENANT });
		expect(recorded.replayedAt).toBeUndefined();
		expect(recorded.discardedAt).toBeUndefined();
		expect(row(recorded.id)).toBeDefined();
	});

	it('files the row under the tenancy the payload carries, because a queue consumer has no request', async () => {
		const { service } = world();

		const recorded = await service.recordDeadLetter({
			queueName: QUEUE,
			jobId: JOB_ID,
			jobName: JOB,
			payload: { tenantId: TENANT, organizationId: ORG },
			attemptCount: 1
		});

		expect(recorded.tenantId).toBe(TENANT);
		expect(recorded.organizationId).toBe(ORG);
	});

	it('prefers the caller’s own scope, so a payload cannot file a row under another tenancy', async () => {
		const { service } = world();
		mockRequestContext.tenantId = 'tenant-of-the-caller';
		mockRequestContext.organizationId = 'org-of-the-caller';

		try {
			const recorded = await service.recordDeadLetter({
				queueName: QUEUE,
				jobId: JOB_ID,
				jobName: JOB,
				payload: { tenantId: TENANT, organizationId: ORG },
				attemptCount: 1
			});

			expect(recorded.tenantId).toBe('tenant-of-the-caller');
			expect(recorded.organizationId).toBe('org-of-the-caller');
		} finally {
			mockRequestContext.tenantId = null;
			mockRequestContext.organizationId = null;
		}
	});

	it('refuses a row that could not be inspected: no queue, no job name, no payload, no attempt count', async () => {
		const { service } = world();
		const sound = { queueName: QUEUE, jobName: JOB, payload: {}, attemptCount: 1 };

		expect(await refusalOf(() => service.recordDeadLetter({ ...sound, queueName: '  ' } as never))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
		expect(await refusalOf(() => service.recordDeadLetter({ ...sound, jobName: '' } as never))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
		expect(
			await refusalOf(() => service.recordDeadLetter({ ...sound, payload: undefined } as never))
		).toMatch(/^JOB_DEAD_LETTER_STATE_INVALID/);
		expect(await refusalOf(() => service.recordDeadLetter({ ...sound, attemptCount: 0 } as never))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
		expect(
			await refusalOf(() => service.recordDeadLetter({ ...sound, attemptCount: undefined } as never))
		).toMatch(/^JOB_DEAD_LETTER_STATE_INVALID/);
	});

	it('answers with the row already recorded for that queue and job, because one failure is one row', async () => {
		const { service, table } = world([deadLetterRow('dl-existing')]);

		const recorded = await service.recordDeadLetter({
			queueName: QUEUE,
			jobId: JOB_ID,
			jobName: JOB,
			payload: { requestedAt: 'a different value, which must not replace what failed' },
			attemptCount: 3
		});

		expect(recorded.id).toBe('dl-existing');
		expect(table).toHaveLength(1);
		expect(recorded.payload).toEqual({ requestedAt: '2026-01-01T00:00:00.000Z' });
	});

	it('never deduplicates a row that names no job, because there is no job to compare', async () => {
		const { service, table } = world();

		await service.recordDeadLetter({ queueName: QUEUE, jobName: JOB, payload: {}, attemptCount: 1 });
		await service.recordDeadLetter({ queueName: QUEUE, jobName: JOB, payload: {}, attemptCount: 1 });

		expect(table).toHaveLength(2);
	});
});

describe('JobDeadLetterService — replaying a failure', () => {
	it('marks the row REPLAYED and records the fresh job id without rewriting the failed one', async () => {
		const { service, row } = world([deadLetterRow('dl-1')]);

		const replayed = await service.replayDeadLetter('dl-1', {
			replayedJobId: NEW_JOB_ID,
			replayedByUserId: OPERATOR
		});

		expect(replayed.status).toBe(DeadLetterStatus.REPLAYED);
		expect(replayed.replayedAt).toBeInstanceOf(Date);
		expect(replayed.replayedByUserId).toBe(OPERATOR);
		// The failed job's id is the row's business key; the enqueued id is recorded beside it.
		expect(replayed.jobId).toBe(JOB_ID);
		expect(replayed.metadata).toMatchObject({ replayedJobId: NEW_JOB_ID });
		expect(row('dl-1')?.status).toBe(DeadLetterStatus.REPLAYED);
	});

	it('records the operator from the request context when the caller names nobody', async () => {
		const { service } = world([deadLetterRow('dl-1')]);
		mockRequestContext.userId = OPERATOR;

		try {
			const replayed = await service.replayDeadLetter('dl-1', { replayedJobId: NEW_JOB_ID });

			expect(replayed.replayedByUserId).toBe(OPERATOR);
		} finally {
			mockRequestContext.userId = null;
		}
	});

	it('refuses a second replay, so the same failure cannot be retried twice unnoticed', async () => {
		const { service } = world([deadLetterRow('dl-1', { status: DeadLetterStatus.REPLAYED, replayedAt: new Date() })]);

		expect(await refusalOf(() => service.replayDeadLetter('dl-1', { replayedJobId: NEW_JOB_ID }))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
	});

	it('refuses to replay a failure an operator decided to drop', async () => {
		const { service } = world([
			deadLetterRow('dl-1', { status: DeadLetterStatus.DISCARDED, discardedAt: new Date(), discardedReason: 'no' })
		]);

		expect(await refusalOf(() => service.replayDeadLetter('dl-1', { replayedJobId: NEW_JOB_ID }))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
	});

	it('refuses to replay a row with nothing to re-enqueue', async () => {
		const { service } = world([deadLetterRow('dl-1', { payload: null })]);

		expect(await refusalOf(() => service.replayDeadLetter('dl-1', { replayedJobId: NEW_JOB_ID }))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
	});
});

describe('JobDeadLetterService — discarding a failure', () => {
	it('keeps the row and records the decision, the instant and the reason', async () => {
		const { service, table, row } = world([deadLetterRow('dl-1')]);

		const discarded = await service.discardDeadLetter('dl-1', { reason: 'the tenant was deleted' });

		expect(discarded.status).toBe(DeadLetterStatus.DISCARDED);
		expect(discarded.discardedAt).toBeInstanceOf(Date);
		expect(discarded.discardedReason).toBe('the tenant was deleted');
		// A discard is a status change and not a delete: the row is still there, and still readable.
		expect(table).toHaveLength(1);
		expect(row('dl-1')?.deletedAt).toBeUndefined();
	});

	it('is not the same as a delete, so the discarded row is still listed', async () => {
		const { service } = world([deadLetterRow('dl-1')]);

		await service.discardDeadLetter('dl-1', { reason: 'not worth retrying' });

		const listed = await service.listDeadLetters({ status: DeadLetterStatus.DISCARDED });

		expect(listed.total).toBe(1);
		expect(listed.items[0].discardedReason).toBe('not worth retrying');
	});

	it('requires a reason, because a decision without one is indistinguishable from nobody looking', async () => {
		const { service } = world([deadLetterRow('dl-1')]);

		expect(await refusalOf(() => service.discardDeadLetter('dl-1', { reason: '   ' }))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
		expect(await refusalOf(() => service.discardDeadLetter('dl-1', {} as never))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
	});

	it('refuses to restate a decision already taken', async () => {
		const { service } = world([deadLetterRow('dl-1', { status: DeadLetterStatus.DISCARDED, discardedAt: new Date() })]);

		expect(await refusalOf(() => service.discardDeadLetter('dl-1', { reason: 'a different reason' }))).toMatch(
			/^JOB_DEAD_LETTER_STATE_INVALID/
		);
	});
});

describe('JobDeadLetterService — reading the store', () => {
	it('measures the depth of a queue as the failures nobody has acted on', async () => {
		const { service } = world([
			deadLetterRow('dl-1'),
			deadLetterRow('dl-2', { jobId: 'other-job-id' }),
			deadLetterRow('dl-3', { status: DeadLetterStatus.REPLAYED, replayedAt: new Date() }),
			deadLetterRow('dl-4', { status: DeadLetterStatus.DISCARDED, discardedAt: new Date() }),
			deadLetterRow('dl-5', { queueName: OTHER_QUEUE })
		]);

		expect(await service.deadLetterDepth(QUEUE)).toBe(2);
		expect(await service.deadLetterDepth(OTHER_QUEUE)).toBe(1);
	});

	it('lists failures newest first, with a total that counts the filter rather than the page', async () => {
		const { service } = world([
			deadLetterRow('dl-1', { failedAt: new Date('2026-01-01T00:00:00.000Z') }),
			deadLetterRow('dl-2', { failedAt: new Date('2026-01-03T00:00:00.000Z') }),
			deadLetterRow('dl-3', { failedAt: new Date('2026-01-02T00:00:00.000Z') }),
			deadLetterRow('dl-4', { queueName: OTHER_QUEUE, failedAt: new Date('2026-01-04T00:00:00.000Z') })
		]);

		const page = await service.listDeadLetters({ queueName: QUEUE, limit: 2 });

		expect(page.items.map((row) => row.id)).toEqual(['dl-2', 'dl-3']);
		expect(page.total).toBe(3);
	});

	it('narrows by the window a failure is found with', async () => {
		const { service } = world([
			deadLetterRow('dl-1', { failedAt: new Date('2026-01-01T00:00:00.000Z') }),
			deadLetterRow('dl-2', { failedAt: new Date('2026-01-05T00:00:00.000Z') })
		]);

		const page = await service.listDeadLetters({ failedAfter: new Date('2026-01-02T00:00:00.000Z') });

		expect(page.items.map((row) => row.id)).toEqual(['dl-2']);
	});

	it('answers null for a row that does not exist, and refuses when the caller must honour an id', async () => {
		const { service } = world();

		expect(await service.findDeadLetter('dl-9')).toBeNull();
		expect(await refusalOf(() => service.findDeadLetterOrFail('dl-9'))).toMatch(/^JOB_DEAD_LETTER_NOT_FOUND/);
	});
});
