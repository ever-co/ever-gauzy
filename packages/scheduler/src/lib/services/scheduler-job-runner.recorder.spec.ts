import 'reflect-metadata';
import { DiscoveredScheduledJob, ResolvedScheduledJobOptions } from '../interfaces/discovered-scheduled-job.interface';
import {
	SchedulerRunHandle,
	SchedulerRunOutcome,
	SchedulerRunRecorder,
	SchedulerRunSkip,
	SchedulerRunStart
} from '../interfaces/scheduler-run-recorder.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { SchedulerJobRunnerService } from './scheduler-job-runner.service';
import { SchedulerService } from './scheduler.service';

/**
 * The run-recorder seam: what the scheduler writes down when a ledger is attached, and what it does
 * when one is not.
 *
 * The property that matters most is the second half. This hook sits on the ONE path every run takes,
 * so a ledger that is slow, misconfigured or simply broken must not be able to fail a pass or replace
 * a job's own error with its own — and a process that attaches no ledger must behave exactly as it did
 * before the hook existed.
 */
describe('SchedulerJobRunnerService — the run ledger seam', () => {
	const moduleOptions = (overrides: Partial<ResolvedSchedulerModuleOptions> = {}): ResolvedSchedulerModuleOptions =>
		({
			enabled: true,
			enableQueueing: false,
			defaultQueueName: 'default-queue',
			logRegisteredJobs: false,
			defaultJobOptions: {
				enabled: true,
				preventOverlap: true,
				retries: 0,
				retryDelayMs: 0,
				maxRandomDelayMs: 0
			},
			...overrides
		} as ResolvedSchedulerModuleOptions);

	const jobOptions = (overrides: Partial<ResolvedScheduledJobOptions> = {}): ResolvedScheduledJobOptions => ({
		enabled: true,
		runOnStart: false,
		preventOverlap: true,
		retries: 0,
		retryDelayMs: 0,
		maxRandomDelayMs: 0,
		...overrides
	});

	const queueService = { enqueue: async () => undefined } as never;

	/** A job whose handler the suite controls. */
	const job = (
		handler: () => Promise<unknown>,
		overrides: Partial<ResolvedScheduledJobOptions> = {}
	): DiscoveredScheduledJob => ({
		id: 'measurement-audit',
		providerName: 'MeasurementAuditService',
		methodName: 'audit',
		options: jobOptions(overrides),
		handler
	});

	/** A recorder that writes everything into arrays the suite can read. */
	const recorder = () => {
		const started: SchedulerRunStart[] = [];
		const finished: Array<{ handle: SchedulerRunHandle; outcome: SchedulerRunOutcome }> = [];
		const skipped: SchedulerRunSkip[] = [];
		let refuse = false;

		const port: SchedulerRunRecorder = {
			beginRun: async (run) => {
				started.push(run);

				return refuse ? null : { id: `run-${started.length}` };
			},
			finishRun: async (handle, outcome) => {
				finished.push({ handle, outcome });
			},
			recordSkippedOverlap: async (skip) => {
				skipped.push(skip);
			}
		};

		return {
			port,
			started,
			finished,
			skipped,
			refuseNextRun: () => {
				refuse = true;
			}
		};
	};

	it('runs and records nothing when no ledger is attached, exactly as before the seam existed', async () => {
		const runs: number[] = [];
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);

		await runner.execute(job(async () => runs.push(1)));

		expect(runs).toHaveLength(1);
		expect(runner.hasRunRecorder()).toBe(false);
	});

	it('opens an attempt before the handler runs and closes it with the outcome afterwards', async () => {
		const runs: number[] = [];
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);

		runner.setRunRecorder(ledger.port);
		await runner.execute(job(async () => runs.push(1)));

		expect(ledger.started).toHaveLength(1);
		expect(ledger.started[0]).toMatchObject({
			jobId: 'measurement-audit',
			trigger: 'SCHEDULED',
			attemptCount: 1
		});
		expect(ledger.started[0].startedAt).toBeInstanceOf(Date);
		expect(ledger.started[0].nodeId).toMatch(/:\d+$/);
		expect(ledger.finished).toHaveLength(1);
		expect(ledger.finished[0].handle).toEqual({ id: 'run-1' });
		expect(ledger.finished[0].outcome).toMatchObject({ status: 'SUCCEEDED', attemptCount: 1 });
		expect(ledger.finished[0].outcome.durationMs).toBeGreaterThanOrEqual(0);
	});

	it('writes one row per attempt, so a retried run is legible as a retry', async () => {
		let calls = 0;
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);

		runner.setRunRecorder(ledger.port);
		await runner.execute(
			job(
				async () => {
					calls += 1;
					if (calls === 1) {
						throw new Error('the first attempt threw');
					}
				},
				{ retries: 1 }
			)
		);

		expect(calls).toBe(2);
		expect(ledger.started.map((run) => run.trigger)).toEqual(['SCHEDULED', 'RETRY']);
		expect(ledger.finished.map((entry) => entry.outcome.status)).toEqual(['FAILED', 'SUCCEEDED']);
		expect(ledger.finished[0].outcome.lastError).toContain('the first attempt threw');
	});

	it('records the failure and still rethrows it when the attempts are exhausted', async () => {
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);

		runner.setRunRecorder(ledger.port);

		await expect(
			runner.execute(
				job(async () => {
					throw new Error('always throws');
				})
			)
		).rejects.toThrow('always throws');

		expect(ledger.finished.map((entry) => entry.outcome.status)).toEqual(['FAILED']);
	});

	it('records a refused tick as a skip instead of running it, and does not report a failure', async () => {
		const runs: number[] = [];
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);

		ledger.refuseNextRun();
		runner.setRunRecorder(ledger.port);

		await expect(runner.execute(job(async () => runs.push(1)))).resolves.toBeUndefined();

		expect(runs).toHaveLength(0);
		expect(ledger.finished).toHaveLength(0);
		expect(ledger.skipped).toHaveLength(1);
		expect(ledger.skipped[0].reason).toContain('another live run');
	});

	it('records the in-process overlap skip, which used to leave nothing behind at all', async () => {
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);
		let release: () => void = () => undefined;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});

		runner.setRunRecorder(ledger.port);

		const first = runner.execute(job(async () => held));
		await Promise.resolve();
		await runner.execute(job(async () => undefined));
		release();
		await first;

		expect(ledger.skipped).toHaveLength(1);
		expect(ledger.skipped[0].reason).toContain('still in progress');
		// The skip is a row and not a run: nothing was opened for it.
		expect(ledger.started).toHaveLength(1);
	});

	it('runs the job anyway when the ledger itself cannot be written to', async () => {
		const runs: number[] = [];
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);
		const broken: SchedulerRunRecorder = {
			beginRun: async () => {
				throw new Error('the ledger is unreachable');
			},
			finishRun: async () => undefined,
			recordSkippedOverlap: async () => undefined
		};

		runner.setRunRecorder(broken);

		await expect(runner.execute(job(async () => runs.push(1)))).resolves.toBeUndefined();
		expect(runs).toHaveLength(1);
	});

	it('detaches the ledger, so a process can stop recording without restarting', async () => {
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);

		runner.setRunRecorder(ledger.port);
		await runner.execute(job(async () => undefined));
		runner.setRunRecorder(null);
		await runner.execute(job(async () => undefined));

		expect(ledger.started).toHaveLength(1);
		expect(runner.hasRunRecorder()).toBe(false);
	});

	it('is reachable through the service the scheduler module exports, which is the wiring point', () => {
		const ledger = recorder();
		const runner = new SchedulerJobRunnerService(moduleOptions(), queueService);
		const service = new SchedulerService({ getAll: () => [] } as never, runner, queueService);

		service.attachRunRecorder(ledger.port);

		expect(service.hasRunRecorder()).toBe(true);
		expect(runner.hasRunRecorder()).toBe(true);

		service.attachRunRecorder(null);

		expect(runner.hasRunRecorder()).toBe(false);
	});
});
