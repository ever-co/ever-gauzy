import { Inject, Injectable, Logger } from '@nestjs/common';
import { SCHEDULER_MODULE_OPTIONS } from '../constants/scheduler.constants';
import { DiscoveredScheduledJob } from '../interfaces/discovered-scheduled-job.interface';
import {
	SchedulerRunHandle,
	SchedulerRunRecorder,
	SchedulerRunStatus,
	SchedulerRunTrigger
} from '../interfaces/scheduler-run-recorder.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { SchedulerQueueService } from './scheduler-queue.service';

/** What opening an attempt answered. */
type BeginRunResult =
	| { outcome: 'recorded'; handle: SchedulerRunHandle }
	| { outcome: 'refused' }
	| { outcome: 'unavailable' };

/**
 * Runs a discovered job, and — when a run recorder is attached — writes down what it ran.
 *
 * **This is the scheduler's single funnel.** Every entry point reaches a job through `execute()`: a
 * cron tick, an interval tick, the start-up pass and a manual trigger all arrive here, so one hook
 * here observes every run rather than one per entry point.
 *
 * **The recorder is optional, and the scheduler behaves identically without one.** With no recorder
 * attached this class does exactly what it has always done: the handler runs, retries are attempted,
 * a failure is logged and rethrown. Nothing about a run's behaviour depends on whether somebody is
 * recording it, because every call through the port is caught here and only logged — a ledger that is
 * unreachable, slow or wrong must never turn a successful pass into a failed one, nor replace a job's
 * own error with its own.
 */
@Injectable()
export class SchedulerJobRunnerService {
	private readonly logger = new Logger(SchedulerJobRunnerService.name);
	private readonly runningJobs = new Set<string>();

	/** The attached ledger, or null when this process records nothing. */
	private runRecorder: SchedulerRunRecorder | null = null;

	constructor(
		@Inject(SCHEDULER_MODULE_OPTIONS)
		private readonly moduleOptions: ResolvedSchedulerModuleOptions,
		private readonly queueService: SchedulerQueueService
	) {}

	/**
	 * Attaches the ledger every run is written to, or detaches it with `null`.
	 *
	 * Set at boot by the process that owns the ledger: the scheduler cannot resolve one itself, because
	 * the ledger is a platform service in a package this one does not depend on. Attaching late is
	 * safe — a run that happened before the recorder existed is simply a run nobody recorded.
	 *
	 * @param recorder The recorder, or null to record nothing.
	 */
	setRunRecorder(recorder: SchedulerRunRecorder | null): void {
		this.runRecorder = recorder;
	}

	/** Whether this process currently records its runs. */
	hasRunRecorder(): boolean {
		return this.runRecorder !== null;
	}

	isRunning(jobId: string): boolean {
		return this.runningJobs.has(jobId);
	}

	async execute(job: DiscoveredScheduledJob): Promise<void> {
		if (!this.moduleOptions.enabled || !job.options.enabled) {
			return;
		}

		if (job.options.preventOverlap && this.runningJobs.has(job.id)) {
			this.logger.warn(`Skipping "${job.id}" because the previous run is still in progress.`);
			// A skip is a fact and not an absence: the tick was due, it could not start, and an
			// operator reading the ledger has to be able to tell that from a pass that never fired.
			await this.recordSkip(job, 'the previous run of this job is still in progress in this process');
			return;
		}

		const startedAt = Date.now();
		this.runningJobs.add(job.id);

		try {
			await this.executeWithRetry(job);
			this.logger.debug(`Finished "${job.id}" in ${Date.now() - startedAt}ms`);
		} catch (error) {
			const message = error instanceof Error ? error.stack ?? error.message : String(error);
			this.logger.error(`Scheduled job "${job.id}" failed.`, message);
			throw error;
		} finally {
			this.runningJobs.delete(job.id);
		}
	}

	/**
	 * Every attempt of one run, each bracketed by the ledger when one is attached.
	 *
	 * One attempt is one ledger row, so a run that retried twice leaves three rows that say which
	 * attempt each was — which is the difference between "this job failed" and "this job failed three
	 * times and then gave up". The failure of an attempt is recorded before the retry delay, so the
	 * ledger shows the run in flight during the wait rather than after it.
	 *
	 * @param job The job being run.
	 */
	private async executeWithRetry(job: DiscoveredScheduledJob): Promise<void> {
		const attempts = job.options.retries + 1;
		let attempt = 1;
		let lastError: unknown;

		while (attempt <= attempts) {
			const startedAt = new Date();
			const begin = await this.beginRun(job, attempt, startedAt);

			if (begin.outcome === 'refused') {
				// Another live run of this job holds it — another replica, or a row an interrupted
				// process left behind that the ledger has not reclaimed yet. The tick is over, and it
				// is over as a recorded skip rather than as a failure.
				await this.recordSkip(job, `another live run of "${job.id}" holds it`, attempt);
				return;
			}

			const handle = begin.outcome === 'recorded' ? begin.handle : null;

			try {
				await this.executeSingleAttempt(job);
				await this.finishRun(job, handle, 'SUCCEEDED', undefined, attempt, startedAt);
				return;
			} catch (error) {
				lastError = error;
				await this.finishRun(job, handle, 'FAILED', error, attempt, startedAt);

				const hasNextAttempt = attempt < attempts;
				if (!hasNextAttempt) {
					break;
				}

				this.logger.warn(
					`"${job.id}" failed on attempt ${attempt}/${attempts}. Retrying in ${job.options.retryDelayMs}ms.`
				);
				await sleep(job.options.retryDelayMs);
				attempt += 1;
			}
		}

		throw lastError;
	}

	private async executeSingleAttempt(job: DiscoveredScheduledJob): Promise<void> {
		const execution = this.executeJobHandler(job);
		if (job.options.timeoutMs === undefined) {
			await execution;
			return;
		}

		const ac = new AbortController();
		try {
			await Promise.race([execution, timeout(job.options.timeoutMs, job.id, ac.signal)]);
		} finally {
			ac.abort(); // Cancel the timeout timer if the job finished first
		}
	}

	private async executeJobHandler(job: DiscoveredScheduledJob): Promise<void> {
		const data = await Promise.resolve(job.handler());

		if (!job.options.queueName) {
			return;
		}

		await this.queueService.enqueue({
			queueName: job.options.queueName,
			jobName: job.options.queueJobName ?? job.id,
			data,
			options: job.options.queueJobOptions
		});
	}

	/**
	 * Opens an attempt in the ledger, when one is attached.
	 *
	 * The three answers are kept apart on purpose, because only one of them is about the job. `recorded`
	 * carries the handle a later close needs; `refused` means the ledger knows of a live run of this job
	 * and the tick must not start; `unavailable` means the ledger itself could not be written to, and
	 * the job runs anyway — unrecorded, which is exactly what a deployment without a ledger does.
	 * Collapsing the last two would let a broken ledger silently stop every pass in the process, and
	 * collapsing the first two would lose the skip an operator needs to see.
	 *
	 * @param job The job about to run.
	 * @param attempt Which attempt this is, 1-based.
	 * @param startedAt When the attempt began.
	 * @returns The result of opening the attempt.
	 */
	private async beginRun(
		job: DiscoveredScheduledJob,
		attempt: number,
		startedAt: Date
	): Promise<BeginRunResult> {
		if (!this.runRecorder) {
			return { outcome: 'unavailable' };
		}

		try {
			const handle = await this.runRecorder.beginRun({
				jobId: job.id,
				jobName: job.id,
				trigger: this.triggerOf(attempt),
				attemptCount: attempt,
				nodeId: this.nodeId(),
				startedAt
			});

			return handle ? { outcome: 'recorded', handle } : { outcome: 'refused' };
		} catch (error) {
			this.logger.error(
				`Run ledger could not open "${job.id}" attempt ${attempt}; the job runs unrecorded.`,
				error instanceof Error ? error.message : String(error)
			);

			return { outcome: 'unavailable' };
		}
	}

	/**
	 * Closes an attempt in the ledger, when one was opened.
	 *
	 * A close that fails is logged and swallowed for the same reason an open is: the ledger is an
	 * observer of the run, and an observer that cannot write must not change what it observes.
	 *
	 * @param job The job that ran.
	 * @param handle The handle `beginRun` answered with, or null when nothing was recorded.
	 * @param status How the attempt ended.
	 * @param error The failure, when there was one.
	 * @param attempt Which attempt this was.
	 * @param startedAt When the attempt began.
	 */
	private async finishRun(
		job: DiscoveredScheduledJob,
		handle: SchedulerRunHandle | null,
		status: Exclude<SchedulerRunStatus, 'RUNNING'>,
		error: unknown,
		attempt: number,
		startedAt: Date
	): Promise<void> {
		if (!this.runRecorder || !handle) {
			return;
		}

		const finishedAt = new Date();

		try {
			await this.runRecorder.finishRun(handle, {
				status,
				finishedAt,
				durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
				attemptCount: attempt,
				...(error !== undefined ? { lastError: describeError(error) } : {})
			});
		} catch (ledgerError) {
			this.logger.error(
				`Run ledger could not close "${job.id}" attempt ${attempt}; the outcome is in the log only.`,
				ledgerError instanceof Error ? ledgerError.message : String(ledgerError)
			);
		}
	}

	/**
	 * Records a tick that could not start.
	 *
	 * @param job The job whose tick was refused.
	 * @param reason Why it was refused.
	 * @param attempt Which attempt was refused.
	 */
	private async recordSkip(job: DiscoveredScheduledJob, reason: string, attempt = 1): Promise<void> {
		if (!this.runRecorder) {
			return;
		}

		try {
			await this.runRecorder.recordSkippedOverlap({
				jobId: job.id,
				jobName: job.id,
				trigger: this.triggerOf(attempt),
				attemptCount: attempt,
				reason,
				observedAt: new Date()
			});
		} catch (error) {
			this.logger.error(
				`Run ledger could not record the skipped tick of "${job.id}".`,
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	/** The first attempt of a run is what caused the run; a later one is a retry. */
	private triggerOf(attempt: number): SchedulerRunTrigger {
		return attempt > 1 ? 'RETRY' : 'SCHEDULED';
	}

	/** This instance, as far as the process can name itself. */
	private nodeId(): string {
		return `${process.env['HOSTNAME'] ?? process.env['COMPUTERNAME'] ?? 'unknown-host'}:${process.pid}`;
	}
}

/** The failure as one bounded line of text. */
function describeError(error: unknown): string {
	if (error instanceof Error) {
		return error.stack ?? error.message;
	}

	return String(error);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function timeout(ms: number, jobId: string, signal?: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`Scheduled job "${jobId}" timed out after ${ms}ms.`));
		}, ms);

		// If the signal is already aborted, clear immediately
		if (signal?.aborted) {
			clearTimeout(timer);
			return;
		}

		// Listen for abort to clear the timer
		signal?.addEventListener('abort', () => {
			clearTimeout(timer);
		}, { once: true });
	});
}
