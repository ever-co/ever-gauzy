import { ConflictException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { JobExecutionStatus, JobTrigger } from '@gauzy/contracts';
import { JobExecutionService } from '@gauzy/core';
import {
	SchedulerRunHandle,
	SchedulerRunOutcome,
	SchedulerRunRecorder,
	SchedulerRunSkip,
	SchedulerRunStart,
	SchedulerRunStatus,
	SchedulerRunTrigger,
	SchedulerService
} from '@gauzy/scheduler';

/**
 * Writes this process's scheduled runs into the ledger.
 *
 * A scheduled pass that fails leaves nothing behind on its own: the runner logs the failure, retries
 * once, and returns, and a worker that is killed mid-pass leaves even less. The ledger is the row that
 * makes "did last night's pass run, and what did it say" answerable without reading a log, and this
 * class is the whole of the wiring between the two: it adapts the scheduler's recorder port to the
 * ledger's service and attaches it to the one funnel every attempt passes through.
 *
 * **It is an adapter and nothing else.** It holds no state, decides nothing and writes no table of its
 * own; every method is a mapping from the port's vocabulary to the ledger's, which is why it is short.
 * The two vocabularies are value-identical — a trigger is `SCHEDULED`/`MANUAL`/`RETRY`/`FAN_OUT` and a
 * status is `RUNNING`/`SUCCEEDED`/`FAILED`/`CANCELLED`/`SKIPPED_OVERLAP` on both sides — so the maps
 * below are exhaustive rather than clever, and a value the ledger does not know is translated to the
 * nearest one it does rather than being dropped.
 *
 * **A refusal is an answer, not a failure.** The ledger refuses to open a second live run of the same
 * job; the port expresses that as `null` so the runner can record the tick as skipped instead of
 * treating the job as broken. Everything else — a ledger that is unreachable, a row that cannot be
 * written — is left to throw, and the runner catches it: a recorder never breaks the run it observes.
 */
@Injectable()
export class SchedulerLedgerBootstrap implements OnApplicationBootstrap {
	private readonly logger = new Logger(SchedulerLedgerBootstrap.name);

	constructor(
		private readonly schedulerService: SchedulerService,
		private readonly jobExecutionService: JobExecutionService
	) {}

	/**
	 * Attaches the recorder once the application is up.
	 *
	 * At bootstrap rather than in the constructor because the scheduler's discovery pass — the one that
	 * registers every job and may run the start-up ones — happens while the module graph is still being
	 * built, and a recorder attached before that would record start-up runs the ledger's own service is
	 * not ready for.
	 */
	public onApplicationBootstrap(): void {
		this.schedulerService.attachRunRecorder(new JobExecutionRunRecorder(this.jobExecutionService));
		this.logger.log('Scheduled runs are recorded in the job ledger.');
	}
}

/**
 * The port, answered by the run ledger.
 *
 * Kept private to this file: it is the shape of one process's wiring, not a service anything injects,
 * and exporting it would invite a second instance whose two halves could disagree about the mapping.
 */
class JobExecutionRunRecorder implements SchedulerRunRecorder {
	constructor(private readonly runs: JobExecutionService) {}

	/**
	 * Opens an attempt.
	 *
	 * @param run The job, the attempt and the instance.
	 * @returns A handle the later close uses, or `null` when another live run of the job holds it — the
	 * one refusal the runner has to act on, and the reason this method answers instead of throwing.
	 */
	public async beginRun(run: SchedulerRunStart): Promise<SchedulerRunHandle | null> {
		try {
			const opened = await this.runs.beginRun({
				jobId: run.jobId,
				jobName: run.jobName,
				trigger: toJobTrigger(run.trigger),
				attemptCount: run.attemptCount,
				...(run.nodeId ? { nodeId: run.nodeId } : {}),
				startedAt: run.startedAt
			});

			return { id: opened.id };
		} catch (error) {
			// The ledger refuses a second live run of the same job. That is the tick being skipped, which
			// is a row of its own — `recordSkippedOverlap` below — and not an error the runner should see.
			if (error instanceof ConflictException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Closes an attempt with its outcome.
	 *
	 * @param handle The handle `beginRun` answered with.
	 * @param outcome How the attempt ended.
	 */
	public async finishRun(handle: SchedulerRunHandle, outcome: SchedulerRunOutcome): Promise<void> {
		await this.runs.finishRun(handle.id, {
			status: toJobExecutionStatus(outcome.status),
			finishedAt: outcome.finishedAt,
			durationMs: outcome.durationMs,
			attemptCount: outcome.attemptCount,
			...(outcome.lastError ? { lastError: outcome.lastError } : {}),
			...(outcome.metadata ? { metadata: outcome.metadata } : {})
		});
	}

	/**
	 * Records a tick that could not start.
	 *
	 * @param skip The job whose tick was refused, and why.
	 */
	public async recordSkippedOverlap(skip: SchedulerRunSkip): Promise<void> {
		await this.runs.recordSkippedOverlap({
			jobId: skip.jobId,
			jobName: skip.jobName,
			trigger: toJobTrigger(skip.trigger),
			attemptCount: skip.attemptCount,
			reason: skip.reason
		});
	}
}

/**
 * The scheduler's trigger as the ledger names it.
 *
 * @param trigger The port's value.
 * @returns The ledger's value, which is the same word for every member.
 */
function toJobTrigger(trigger: SchedulerRunTrigger): JobTrigger {
	switch (trigger) {
		case 'MANUAL':
			return JobTrigger.MANUAL;
		case 'RETRY':
			return JobTrigger.RETRY;
		case 'FAN_OUT':
			return JobTrigger.FAN_OUT;
		case 'SCHEDULED':
		default:
			// A tick of the job's own schedule, which is also what an unknown value means: a run that
			// happened because time passed.
			return JobTrigger.SCHEDULED;
	}
}

/**
 * The attempt's outcome as the ledger names it.
 *
 * `RUNNING` never arrives here — the port states that the outcome type excludes it — so the fallback is
 * the one status that records "it threw", which is the honest reading of a value this mapping does not
 * know.
 *
 * @param status The port's value.
 * @returns The ledger's value.
 */
function toJobExecutionStatus(status: Exclude<SchedulerRunStatus, 'RUNNING'>): JobExecutionStatus {
	switch (status) {
		case 'SUCCEEDED':
			return JobExecutionStatus.SUCCEEDED;
		case 'CANCELLED':
			return JobExecutionStatus.CANCELLED;
		case 'SKIPPED_OVERLAP':
			return JobExecutionStatus.SKIPPED_OVERLAP;
		case 'FAILED':
		default:
			return JobExecutionStatus.FAILED;
	}
}
