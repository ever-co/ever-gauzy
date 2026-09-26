/**
 * `uuid` ships ESM only, which Jest does not transform out of `node_modules` — and the bootstrap reaches
 * it through core's request context. A counter stub keeps the module graph CommonJS, exactly as the
 * kernel's own specs do.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

/**
 * Core is replaced wholesale, for the same reason one step further out.
 *
 * The bootstrap imports `JobExecutionService` for its constructor's type and for the class Nest resolves
 * as the provider — neither of which this spec needs, because it builds the bootstrap with a double. The
 * real import drags the whole kernel in, including the copy of `uuid` that lives under `packages/core`
 * and is the one Jest cannot parse; mocking the package keeps the suite about the mapping it is testing
 * rather than about the kernel's module graph.
 */
jest.mock('@gauzy/core', () => ({ JobExecutionService: class JobExecutionService {} }));

import { ConflictException } from '@nestjs/common';
import { JobExecutionStatus, JobTrigger } from '@gauzy/contracts';
import { SchedulerRunRecorder, SchedulerService } from '@gauzy/scheduler';
import { SchedulerLedgerBootstrap } from './scheduler-ledger.bootstrap';

/**
 * The wiring between the scheduler and the run ledger, and the mappings it promises.
 *
 * The worker is the process that ticks the schedules, so it is the only one with something to record;
 * the ledger's own services are delivered and tested separately, and the scheduler's recorder port is
 * tested on its own side. What is tested here is the seam between them, because that is where a silent
 * failure lives: if the recorder is never attached, every job still runs, every test still passes, and
 * nothing is ever written — the ledger would look like a feature nobody uses rather than a service that
 * was never wired.
 *
 * The mappings are asserted value by value for the same reason. A trigger or a status that arrives as
 * `undefined` in the ledger is a column an operator cannot filter on, and the two vocabularies are
 * value-identical by design, so a mismatch is a defect in this file rather than a translation anybody
 * has to reason about.
 */
describe('SchedulerLedgerBootstrap', () => {
	/** The scheduler as this file uses it: one method, plus the jobs it reports. */
	const createScheduler = () => ({ attachRunRecorder: jest.fn() }) as unknown as SchedulerService & {
		attachRunRecorder: jest.Mock;
	};

	/** The ledger as this file uses it: three writes, each answering the row it wrote. */
	const createLedger = () => ({
		beginRun: jest.fn(async (input: Record<string, unknown>) => ({ id: 'run-1', ...input })),
		finishRun: jest.fn(async (id: string, input: Record<string, unknown>) => ({ id, ...input })),
		recordSkippedOverlap: jest.fn(async (input: Record<string, unknown>) => ({ id: 'run-2', ...input }))
	});

	/** The recorder the bootstrap attached, which is what every case below drives. */
	const attach = (): { recorder: SchedulerRunRecorder; ledger: ReturnType<typeof createLedger> } => {
		const scheduler = createScheduler();
		const ledger = createLedger();
		const bootstrap = new SchedulerLedgerBootstrap(scheduler, ledger as never);

		bootstrap.onApplicationBootstrap();

		expect(scheduler.attachRunRecorder).toHaveBeenCalledTimes(1);

		return { recorder: scheduler.attachRunRecorder.mock.calls[0][0], ledger };
	};

	it('attaches a recorder when the application is up', () => {
		const { recorder } = attach();

		expect(recorder).toBeDefined();
		expect(typeof recorder.beginRun).toBe('function');
		expect(typeof recorder.finishRun).toBe('function');
		expect(typeof recorder.recordSkippedOverlap).toBe('function');
	});

	it('opens a run with the job, the attempt, the instance and what caused it', async () => {
		const { recorder, ledger } = attach();
		const startedAt = new Date('2026-01-01T02:30:00.000Z');

		const handle = await recorder.beginRun({
			jobId: 'inventory-reconciliation',
			jobName: 'Inventory reconciliation',
			trigger: 'SCHEDULED',
			attemptCount: 1,
			nodeId: 'worker-1',
			startedAt
		});

		expect(ledger.beginRun).toHaveBeenCalledWith({
			jobId: 'inventory-reconciliation',
			jobName: 'Inventory reconciliation',
			trigger: JobTrigger.SCHEDULED,
			attemptCount: 1,
			nodeId: 'worker-1',
			startedAt
		});
		expect(handle).toEqual({ id: 'run-1' });
	});

	it('carries every trigger the scheduler states into the ledger', async () => {
		const { recorder, ledger } = attach();

		for (const [trigger, expected] of [
			['MANUAL', JobTrigger.MANUAL],
			['RETRY', JobTrigger.RETRY],
			['FAN_OUT', JobTrigger.FAN_OUT]
		] as const) {
			await recorder.beginRun({ jobId: 'j', jobName: 'j', trigger, attemptCount: 2, startedAt: new Date() });
			expect(ledger.beginRun).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: expected, attemptCount: 2 }));
		}
	});

	it('answers a refusal with null rather than an error when another run holds the job', async () => {
		// The one refusal the runner acts on: it records the tick as skipped instead of treating the job
		// as broken. Every other failure is left to throw, because the runner logs it and carries on.
		const { recorder, ledger } = attach();
		ledger.beginRun.mockRejectedValueOnce(new ConflictException('JOB_EXECUTION_ALREADY_RUNNING'));

		await expect(
			recorder.beginRun({ jobId: 'j', jobName: 'j', trigger: 'SCHEDULED', attemptCount: 1, startedAt: new Date() })
		).resolves.toBeNull();
	});

	it('lets any other ledger failure through', async () => {
		const { recorder, ledger } = attach();
		ledger.beginRun.mockRejectedValueOnce(new Error('the ledger is unreachable'));

		await expect(
			recorder.beginRun({ jobId: 'j', jobName: 'j', trigger: 'SCHEDULED', attemptCount: 1, startedAt: new Date() })
		).rejects.toThrow('the ledger is unreachable');
	});

	it('closes a run with its status, its duration and the failure when there was one', async () => {
		const { recorder, ledger } = attach();
		const finishedAt = new Date('2026-01-01T02:31:00.000Z');

		await recorder.finishRun(
			{ id: 'run-1' },
			{
				status: 'FAILED',
				finishedAt,
				durationMs: 60_000,
				attemptCount: 2,
				lastError: 'the provider refused',
				metadata: { rows: 12 }
			}
		);

		expect(ledger.finishRun).toHaveBeenCalledWith('run-1', {
			status: JobExecutionStatus.FAILED,
			finishedAt,
			durationMs: 60_000,
			attemptCount: 2,
			lastError: 'the provider refused',
			metadata: { rows: 12 }
		});
	});

	it('omits the failure and the counters when the run had none', async () => {
		const { recorder, ledger } = attach();
		const finishedAt = new Date('2026-01-01T02:31:00.000Z');

		await recorder.finishRun(
			{ id: 'run-1' },
			{ status: 'SUCCEEDED', finishedAt, durationMs: 1_000, attemptCount: 1 }
		);

		const [, outcome] = ledger.finishRun.mock.calls.at(-1) as [string, Record<string, unknown>];
		expect(outcome).toEqual({
			status: JobExecutionStatus.SUCCEEDED,
			finishedAt,
			durationMs: 1_000,
			attemptCount: 1
		});
		expect('lastError' in outcome).toBe(false);
		expect('metadata' in outcome).toBe(false);
	});

	it('records a tick that could not start as its own row', async () => {
		const { recorder, ledger } = attach();

		await recorder.recordSkippedOverlap({
			jobId: 'docs-reconcile-schedule',
			jobName: 'Docs reconcile',
			trigger: 'SCHEDULED',
			attemptCount: 3,
			reason: 'lock:scheduler:docs-reconcile-schedule held by another replica',
			observedAt: new Date()
		});

		expect(ledger.recordSkippedOverlap).toHaveBeenCalledWith({
			jobId: 'docs-reconcile-schedule',
			jobName: 'Docs reconcile',
			trigger: JobTrigger.SCHEDULED,
			attemptCount: 3,
			reason: 'lock:scheduler:docs-reconcile-schedule held by another replica'
		});
	});
});
