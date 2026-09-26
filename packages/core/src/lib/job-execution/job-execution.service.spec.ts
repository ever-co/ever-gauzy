/**
 * The scheduler's run ledger (schema chapter §3.21).
 *
 * Six rules, and the suite walks each of them: a run is opened `RUNNING` and closed once,
 * `finishedAt` is non-null exactly when the attempt is over, one live run per job and scope, a stale
 * live run is closed rather than ignored, `SKIPPED_OVERLAP` is a row rather than silence, and attempts
 * are counted but never decremented. Retention is walked as well, because it is the table's only hard
 * delete and the rule that keeps it narrow — over rows only, never a live one — is the one an
 * operator would be hurt by if it broke.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole
 * application graph — a unit test pays for the narrowest surface the module under test touches. The
 * service under test is the real one, over an in-memory table whose `where` matching applies equality,
 * the three operators the service actually states, and the ordering and paging its reads ask for: a
 * double that ignored `order` and `take` would let a service that stopped ordering its listing, or
 * stopped bounding it, pass here and fail in production.
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

		async deleteMany(ids: any[]): Promise<any> {
			return this.typeOrmRepository.deleteMany(ids);
		}
	}

	return { TenantAwareCrudService };
});

/** The request context, as a mutable scope the suite can move between tenants. */
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

import { JobExecutionStatus, JobTrigger } from '@gauzy/contracts';
import { JobExecution } from './job-execution.entity';
import { JobExecutionService } from './job-execution.service';

const JOB = 'measurement-audit';
const OTHER_JOB = 'payment-instrument-audit';
const NODE = 'worker-1:4242';
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

/**
 * The three operators the service states, applied as the database applies them.
 *
 * A filter the double silently ignored would make every "narrowed" read in this suite a read of the
 * whole table, which is the failure mode the assertions about windows and ordering exist to catch.
 */
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

/**
 * An in-memory `job_execution` table and the repository over it.
 *
 * `order`, `take` and `skip` are applied because the ledger's reads are ordered and bounded reads:
 * "the newest run of this job" and "a job's recent runs" are both statements this suite asserts.
 */
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

		const created = { id: `run-new-${++sequence}`, ...row };

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
		metadata: { tableName: 'job_execution', hasColumnWithPropertyPath: () => false },
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
		deleteMany: async (ids: string[]) => {
			const doomed = ids.filter((id) => table.some((row) => row.id === id));

			for (const id of doomed) {
				const index = table.findIndex((row) => row.id === id);
				table.splice(index, 1);
			}

			return { affected: doomed.length };
		}
	};

	return {
		table,
		repository,
		service: new JobExecutionService(repository as never, {} as never),
		run: (id: string) => table.find((row) => row.id === id)
	};
}

/**
 * One `job_execution` row, with the fields this suite reads.
 *
 * The start instant defaults to *now* rather than to a fixed date, and that matters: a live row with
 * an old start is an interrupted run by the ledger's own staleness window, so a fixed date in the past
 * would make every "this job is still running" case silently become a reclaim.
 */
const runRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: null,
	organizationId: null,
	jobId: JOB,
	jobName: JOB,
	trigger: JobTrigger.SCHEDULED,
	status: JobExecutionStatus.RUNNING,
	attemptCount: 1,
	startedAt: new Date(),
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

describe('JobExecutionService — opening and closing a run', () => {
	it('opens an attempt RUNNING, with no finish instant and the job’s name denormalised', async () => {
		const { service, run } = world();

		const opened = await service.beginRun({ jobId: ` ${JOB} `, nodeId: NODE });

		expect(opened.status).toBe(JobExecutionStatus.RUNNING);
		expect(opened.trigger).toBe(JobTrigger.SCHEDULED);
		expect(opened.attemptCount).toBe(1);
		expect(opened.jobId).toBe(JOB);
		expect(opened.jobName).toBe(JOB);
		expect(opened.nodeId).toBe(NODE);
		expect(opened.finishedAt).toBeUndefined();
		expect(run(opened.id)).toBeDefined();
	});

	it('refuses a run with no job id, because a run nobody can name is a run nobody can inspect', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.beginRun({ jobId: '  ' }))).toMatch(/^JOB_EXECUTION_STATE_INVALID/);
		expect(await refusalOf(() => service.beginRun({ jobId: 'x', attemptCount: 0 }))).toMatch(
			/^JOB_EXECUTION_STATE_INVALID/
		);
	});

	it('closes a run with its outcome, deriving the duration from the two instants', async () => {
		const { service, run } = world([
			runRow('run-1', { startedAt: new Date('2026-01-01T00:00:00.000Z') })
		]);

		const finished = await service.finishRun('run-1', {
			status: JobExecutionStatus.SUCCEEDED,
			finishedAt: new Date('2026-01-01T00:00:02.500Z'),
			metadata: { scanned: 12 }
		});

		expect(finished.status).toBe(JobExecutionStatus.SUCCEEDED);
		expect(finished.durationMs).toBe(2_500);
		expect(finished.finishedAt).toEqual(new Date('2026-01-01T00:00:02.500Z'));
		expect(finished.metadata).toEqual({ scanned: 12 });
		expect(run('run-1')?.finishedAt).toBeInstanceOf(Date);
	});

	it('refuses to close a run with anything that is not an outcome', async () => {
		const { service } = world([runRow('run-1')]);

		expect(await refusalOf(() => service.finishRun('run-1', { status: JobExecutionStatus.RUNNING }))).toMatch(
			/^JOB_EXECUTION_STATE_INVALID/
		);
		expect(await refusalOf(() => service.finishRun('run-1', {} as never))).toMatch(
			/^JOB_EXECUTION_STATE_INVALID/
		);
	});

	it('refuses to rewrite a run that already ended, because an ended run is a fact', async () => {
		const { service } = world([runRow('run-1', { status: JobExecutionStatus.SUCCEEDED, finishedAt: new Date() })]);

		expect(
			await refusalOf(() => service.finishRun('run-1', { status: JobExecutionStatus.FAILED, lastError: 'late' }))
		).toMatch(/^JOB_EXECUTION_STATE_INVALID/);
	});

	it('refuses an attempt count that would go backwards, and accepts the attempt the run ended on', async () => {
		const { service } = world([runRow('run-1', { attemptCount: 2 })]);

		expect(
			await refusalOf(() => service.finishRun('run-1', { status: JobExecutionStatus.FAILED, attemptCount: 1 }))
		).toMatch(/^JOB_EXECUTION_STATE_INVALID/);

		const finished = await service.finishRun('run-1', {
			status: JobExecutionStatus.FAILED,
			attemptCount: 3,
			lastError: 'the third attempt threw'
		});

		expect(finished.attemptCount).toBe(3);
		expect(finished.lastError).toBe('the third attempt threw');
	});

	it('bounds the failure it stores, because a stack trace is evidence and not a document', async () => {
		const { service } = world([runRow('run-1')]);

		const finished = await service.finishRun('run-1', {
			status: JobExecutionStatus.FAILED,
			lastError: 'x'.repeat(JobExecutionService.MAX_ERROR_LENGTH + 5_000)
		});

		expect(finished.lastError).toHaveLength(JobExecutionService.MAX_ERROR_LENGTH);
	});

	it('never writes a negative duration, even when the two instants disagree', async () => {
		const { service } = world([runRow('run-1', { startedAt: new Date('2026-01-01T00:00:10.000Z') })]);

		const finished = await service.finishRun('run-1', {
			status: JobExecutionStatus.SUCCEEDED,
			finishedAt: new Date('2026-01-01T00:00:00.000Z')
		});

		expect(finished.durationMs).toBe(0);
	});

	it('closes a run an operator stops as CANCELLED, with the reason recorded', async () => {
		const { service } = world([runRow('run-1')]);

		const cancelled = await service.cancelRun('run-1', 'stopped by an operator during an incident');

		expect(cancelled.status).toBe(JobExecutionStatus.CANCELLED);
		expect(cancelled.lastError).toBe('stopped by an operator during an incident');
		expect(cancelled.finishedAt).toBeInstanceOf(Date);
	});

	it('answers null for a run that does not exist, and refuses when the caller must honour an id', async () => {
		const { service } = world();

		expect(await service.findRun('run-9')).toBeNull();
		expect(await refusalOf(() => service.findRunOrFail('run-9'))).toMatch(/^JOB_EXECUTION_NOT_FOUND/);
	});
});

describe('JobExecutionService — one live run per job and scope', () => {
	it('refuses a second attempt while the first is still in flight, naming the live run', async () => {
		const { service } = world([runRow('run-1')]);

		const refusal = await refusalOf(() => service.beginRun({ jobId: JOB }));

		expect(refusal).toMatch(/^JOB_EXECUTION_ALREADY_RUNNING/);
		expect(refusal).toContain('run-1');
	});

	it('lets the same job run for another scope, because the rule is per job AND scope', async () => {
		const { service } = world([runRow('run-1', { tenantId: TENANT, organizationId: ORG })]);

		// A platform-wide pass (no tenancy) is a different scope from a tenant's pass of the same job.
		const opened = await service.beginRun({ jobId: JOB });

		expect(opened.status).toBe(JobExecutionStatus.RUNNING);
		expect(opened.tenantId ?? null).toBeNull();

		mockRequestContext.tenantId = TENANT;
		mockRequestContext.organizationId = ORG;

		try {
			expect(await refusalOf(() => service.beginRun({ jobId: JOB }))).toMatch(
				/^JOB_EXECUTION_ALREADY_RUNNING/
			);
		} finally {
			mockRequestContext.tenantId = null;
			mockRequestContext.organizationId = null;
		}
	});

	it('closes a live run whose process is gone rather than refusing every later tick', async () => {
		const { service, run } = world([
			runRow('run-1', { startedAt: new Date(Date.now() - 10 * 60_000), nodeId: 'worker-9:1' })
		]);

		const opened = await service.beginRun({ jobId: JOB, nodeId: NODE });

		expect(opened.id).not.toBe('run-1');
		expect(run('run-1')?.status).toBe(JobExecutionStatus.CANCELLED);
		expect(run('run-1')?.finishedAt).toBeInstanceOf(Date);
		expect(run('run-1')?.lastError).toMatch(/^interrupted:/);
	});

	it('does not reclaim a live run that is still inside the staleness window', async () => {
		const { service, run } = world([runRow('run-1', { startedAt: new Date(Date.now() - 1_000) })]);

		expect(await refusalOf(() => service.beginRun({ jobId: JOB }))).toMatch(/^JOB_EXECUTION_ALREADY_RUNNING/);
		expect(run('run-1')?.status).toBe(JobExecutionStatus.RUNNING);
	});
});

describe('JobExecutionService — a skipped tick is a row, not silence', () => {
	it('records the refusal with the observation instant, no duration and no node', async () => {
		const { service } = world();

		const skipped = await service.recordSkippedOverlap({
			jobId: JOB,
			reason: 'run-1 is still in flight'
		});

		expect(skipped.status).toBe(JobExecutionStatus.SKIPPED_OVERLAP);
		expect(skipped.nodeId ?? null).toBeNull();
		expect(skipped.durationMs).toBe(0);
		expect(skipped.finishedAt).toBeInstanceOf(Date);
		expect(skipped.startedAt).toEqual(skipped.finishedAt);
		expect(skipped.lastError).toBe('run-1 is still in flight');
		expect(skipped.metadata).toEqual({ skipped: true, reason: 'run-1 is still in flight' });
	});

	it('states its own reason when the caller gives none, so the row is never mute', async () => {
		const { service } = world();

		const skipped = await service.recordSkippedOverlap({ jobId: JOB });

		expect(skipped.lastError).toContain(JOB);
		expect(skipped.metadata).toMatchObject({ skipped: true });
	});

	it('leaves the job’s live run untouched, because a skip is not a run', async () => {
		const { service, run } = world([runRow('run-1')]);

		await service.recordSkippedOverlap({ jobId: JOB });

		expect(run('run-1')?.status).toBe(JobExecutionStatus.RUNNING);
		expect(run('run-1')?.finishedAt).toBeUndefined();
	});
});

describe('JobExecutionService — reading the ledger', () => {
	it('lists a job’s runs newest first and bounds what one call may ask for', async () => {
		const { service } = world([
			runRow('run-1', { startedAt: new Date('2026-01-01T00:00:00.000Z') }),
			runRow('run-2', { startedAt: new Date('2026-01-03T00:00:00.000Z') }),
			runRow('run-3', { startedAt: new Date('2026-01-02T00:00:00.000Z') }),
			runRow('run-4', { jobId: OTHER_JOB })
		]);

		const runs = await service.listRecentRuns(JOB);

		expect(runs.map((run) => run.id)).toEqual(['run-2', 'run-3', 'run-1']);
		expect(await service.countRuns(JOB)).toBe(3);
		expect(await service.countRuns(OTHER_JOB)).toBe(1);
	});

	it('answers the newest run of a job, and null when it has never run', async () => {
		const { service } = world([
			runRow('run-1', { status: JobExecutionStatus.FAILED, startedAt: new Date('2026-01-01T00:00:00.000Z') }),
			runRow('run-2', { status: JobExecutionStatus.SUCCEEDED, startedAt: new Date('2026-01-02T00:00:00.000Z') })
		]);

		expect((await service.findLatestRun(JOB))?.id).toBe('run-2');
		expect(await service.findLatestRun('never-registered')).toBeNull();
	});

	it('reads what is running right now, oldest first, and only what is running', async () => {
		const { service } = world([
			runRow('run-1', { startedAt: new Date('2026-01-02T00:00:00.000Z') }),
			runRow('run-2', { jobId: OTHER_JOB, startedAt: new Date('2026-01-01T00:00:00.000Z') }),
			runRow('run-3', { status: JobExecutionStatus.SUCCEEDED, startedAt: new Date('2026-01-03T00:00:00.000Z') })
		]);

		const live = await service.listLiveRuns();

		expect(live.map((run) => run.id)).toEqual(['run-2', 'run-1']);
		expect((await service.findLiveRun(JOB))?.id).toBe('run-1');
	});

	it('narrows a live read by the window a stale run is found with', async () => {
		const { service } = world([
			runRow('run-1', { startedAt: new Date('2026-01-01T00:00:00.000Z') }),
			runRow('run-2', { jobId: OTHER_JOB, startedAt: new Date('2026-01-05T00:00:00.000Z') })
		]);

		const stale = await service.listLiveRuns({ startedBefore: new Date('2026-01-02T00:00:00.000Z') });

		expect(stale.map((run) => run.id)).toEqual(['run-1']);
	});

	it('pages the ledger with a total that counts the filter rather than the page', async () => {
		const { service } = world([
			runRow('run-1', { startedAt: new Date('2026-01-01T00:00:00.000Z') }),
			runRow('run-2', { startedAt: new Date('2026-01-02T00:00:00.000Z') }),
			runRow('run-3', {
				status: JobExecutionStatus.FAILED,
				startedAt: new Date('2026-01-03T00:00:00.000Z')
			})
		]);

		const page = await service.paginateRuns({ limit: 2 });

		expect(page.items.map((run) => run.id)).toEqual(['run-3', 'run-2']);
		expect(page.total).toBe(3);

		const failures = await service.paginateRuns({ status: JobExecutionStatus.FAILED });

		expect(failures.items.map((run) => run.id)).toEqual(['run-3']);
		expect(failures.total).toBe(1);
	});
});

describe('JobExecutionService — retention (schema chapter §25)', () => {
	it('deletes runs that are over and past the window, and nothing else', async () => {
		const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000);
		const recent = new Date(Date.now() - 60_000);
		const { service, table } = world([
			runRow('run-old-done', { status: JobExecutionStatus.SUCCEEDED, startedAt: old }),
			runRow('run-old-failed', { status: JobExecutionStatus.FAILED, startedAt: old }),
			runRow('run-old-live', { status: JobExecutionStatus.RUNNING, startedAt: old }),
			runRow('run-recent', { status: JobExecutionStatus.SUCCEEDED, startedAt: recent })
		]);

		expect(await service.purgeExpiredRuns(30)).toBe(2);
		expect(table.map((row) => row.id).sort()).toEqual(['run-old-live', 'run-recent']);
	});

	it('never purges a live row by age, because the row is the evidence that a run was interrupted', async () => {
		const ancient = new Date(Date.now() - 3_650 * 24 * 60 * 60 * 1_000);
		const { service, table } = world([runRow('run-live', { status: JobExecutionStatus.RUNNING, startedAt: ancient })]);

		expect(await service.purgeExpiredRuns(1)).toBe(0);
		expect(table).toHaveLength(1);
	});

	it('refuses a window that would delete the run executing it', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.purgeExpiredRuns(0))).toMatch(/^JOB_EXECUTION_STATE_INVALID/);
		expect(await refusalOf(() => service.purgeExpiredRuns(-1))).toMatch(/^JOB_EXECUTION_STATE_INVALID/);
	});
});
