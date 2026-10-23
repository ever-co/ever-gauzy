/**
 * The seam through which a scheduler writes down what it ran.
 *
 * The scheduler knows how to run a pass and nothing about how a platform records one: it has no
 * database, no ORM and no dependency on any package that has one. This port is the whole of what it
 * needs from a run ledger — open an attempt, close it with an outcome, and say when a tick could not
 * start — and it is deliberately expressed in the scheduler's own vocabulary rather than in any
 * table's, so that the package which owns the ledger can map it without the scheduler learning a
 * schema.
 *
 * **It is optional and off by default.** A process that attaches no recorder behaves exactly as it
 * does today: the job runs, a failure is logged, and nothing is written anywhere. That is what keeps
 * this additive — an installation that has not adopted the ledger is not asked to.
 *
 * **A recorder never breaks the run it observes.** Every call the runner makes through this port is
 * caught and logged, so a ledger that is unreachable, misconfigured or simply wrong cannot turn a
 * successful pass into a failed one, nor replace a job's own error with its own.
 */

/** What caused one attempt to run. The vocabulary is the run ledger's, stated once, here. */
export type SchedulerRunTrigger = 'SCHEDULED' | 'MANUAL' | 'RETRY' | 'FAN_OUT';

/**
 * Where one attempt stands.
 *
 * `SKIPPED_OVERLAP` is a status and not an absence: a tick that could not start is recorded, because
 * "the job did not run" and "the job ran and did nothing" are different facts.
 */
export type SchedulerRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'SKIPPED_OVERLAP';

/** One attempt about to begin. */
export interface SchedulerRunStart {
	/** The resolved scheduled-job id. */
	jobId: string;
	/** The job's name, so the record is readable without the registry. */
	jobName: string;
	/** What caused this attempt. */
	trigger: SchedulerRunTrigger;
	/** Which attempt this is, 1-based: a retried job reports one attempt at a time. */
	attemptCount: number;
	/** The instance running it, when the host can name one. */
	nodeId?: string;
	/** When the attempt began. */
	startedAt: Date;
}

/** How one attempt ended. */
export interface SchedulerRunOutcome {
	/** The terminal status. `RUNNING` is never an outcome. */
	status: Exclude<SchedulerRunStatus, 'RUNNING'>;
	/** When the attempt ended. */
	finishedAt: Date;
	/** How long it took, in milliseconds. */
	durationMs: number;
	/** The attempt the run ended on, which is the count the run began with unless a retry advanced it. */
	attemptCount: number;
	/** The failure, when there was one. */
	lastError?: string;
	/** The job's own counters — rows scanned, items emitted — when the job reported any. */
	metadata?: Record<string, unknown>;
}

/** A tick that could not start because another run of the same job holds it. */
export interface SchedulerRunSkip {
	/** The job whose tick was refused. */
	jobId: string;
	/** The job's name. */
	jobName: string;
	/** What caused the tick to fire. */
	trigger: SchedulerRunTrigger;
	/** Which attempt was refused. */
	attemptCount: number;
	/** Why it was refused — the live run's id, or the lock that was held. */
	reason: string;
	/** When the tick was observed and refused. */
	observedAt: Date;
}

/**
 * What a run ledger must be able to do for the scheduler.
 *
 * `beginRun` answers `null` — rather than throwing — when another live run of the same job holds it.
 * That is the one refusal the runner has to act on rather than merely log: it is the difference
 * between "record this attempt" and "record that this tick never started", and a port that expressed
 * it as an exception would make the scheduler depend on the exception type of whichever package
 * implemented the ledger.
 */
export interface SchedulerRunRecorder {
	/**
	 * Opens an attempt.
	 *
	 * @param run The job, the attempt and the instance.
	 * @returns A handle used to close the same run, or `null` when another live run holds the job.
	 */
	beginRun(run: SchedulerRunStart): Promise<SchedulerRunHandle | null>;

	/**
	 * Closes an attempt with its outcome.
	 *
	 * @param handle The handle `beginRun` answered with.
	 * @param outcome How the attempt ended.
	 */
	finishRun(handle: SchedulerRunHandle, outcome: SchedulerRunOutcome): Promise<void>;

	/**
	 * Records a tick that could not start.
	 *
	 * @param skip The job whose tick was refused, and why.
	 */
	recordSkippedOverlap(skip: SchedulerRunSkip): Promise<void>;
}

/** What `beginRun` answers with: the identity of the run a later `finishRun` closes. */
export interface SchedulerRunHandle {
	/** The ledger's own identifier for the run. */
	id: string;
}
