import { IBasePerTenantAndOrganizationEntityModel, JsonData } from './base-entity.model';

/**
 * What caused one attempt of a scheduled job to run.
 *
 * It is an enumeration rather than free text because an operator's first question about a run is
 * "why did this happen now?", and the answer decides what they do next: a `SCHEDULED` run that failed
 * is a broken pass, a `MANUAL` run that failed is somebody's diagnostic, a `RETRY` row is the second
 * half of a failure the ledger already records, and a `FAN_OUT` row is one partition of a parent
 * pass and is read together with its siblings.
 *
 * `SCHEDULED` covers every automatic entry point — cron, interval and the start-up pass — because
 * they are the same fact from the ledger's point of view: nobody asked for this run just now.
 */
export enum JobTrigger {
	/** A tick of the job's own schedule: a cron expression, an interval, or the start-up pass. */
	SCHEDULED = 'SCHEDULED',
	/** Somebody asked for this run: an operator's trigger, or a caller that needed the work done now. */
	MANUAL = 'MANUAL',
	/** An attempt after the first one of the same run, so a retried pass is legible as a retry. */
	RETRY = 'RETRY',
	/** One partition of a fan-out: the parent tick enqueued this child, and the child's row is the child's. */
	FAN_OUT = 'FAN_OUT'
}

/**
 * Where one attempt of a scheduled job stands.
 *
 * The set is deliberately small and terminal-heavy: a run is `RUNNING` while it is being executed and
 * reaches exactly one of the other four, after which the row is a fact and is never rewritten. That
 * is what makes the ledger answer "did it run, and what did it do" without a status history table —
 * one row per attempt, one status per row, and the attempt count says which attempt it was.
 *
 * `SKIPPED_OVERLAP` exists because "the job did not run" and "the job ran and did nothing" are
 * different facts. A tick that could not start, because the previous run of the same job is still in
 * flight or because another instance holds the job's lock, writes this row rather than nothing, so an
 * operator can tell a slow job from a stopped one.
 */
export enum JobExecutionStatus {
	/** The attempt is in flight. The only status a run can hold while `finishedAt` is null. */
	RUNNING = 'RUNNING',
	/** The attempt completed. Terminal. */
	SUCCEEDED = 'SUCCEEDED',
	/** The attempt threw, and the run has no attempts left. Terminal; carries `lastError`. */
	FAILED = 'FAILED',
	/** The attempt was stopped by an operator or by a shutdown rather than by its own outcome. Terminal. */
	CANCELLED = 'CANCELLED',
	/** The tick could not start because another run of the same job held it. Terminal, and a row. */
	SKIPPED_OVERLAP = 'SKIPPED_OVERLAP'
}

/**
 * The columns of one attempt of one scheduled job — the platform's single run ledger.
 *
 * This is **the** place a scheduled pass is recorded, whatever registered it: the programme's own
 * passes (the measurement audit, the payment-instrument audit, the expiry sweeps) and every pass a
 * plugin declares are registered through the same scheduler, so one ledger answers for all of them
 * rather than one table per job family. The row is a fact about a run and never a queue entry: it
 * holds what an operator needs afterwards — which job, which attempt, when it started, when it
 * finished, how it ended, on which instance, and what it said when it broke.
 *
 * `jobName` is denormalised on purpose. `jobId` is the registered job's identifier and is what a
 * caller filters by, but a ledger row has to stay readable after a job is renamed or removed from the
 * registry, and resolving a name at read time would make the row's meaning depend on today's code.
 */
export interface IJobExecution extends IBasePerTenantAndOrganizationEntityModel {
	/** The registered job's id, as the scheduler's registry resolves it. */
	jobId: string;
	/** The job's name at the moment of the run, so the row is readable without the registry. */
	jobName: string;
	/** What caused this attempt. */
	trigger: JobTrigger;
	/** Where the attempt stands. Terminal for every value but `RUNNING`. */
	status: JobExecutionStatus;
	/** Which attempt this is, 1-based. A retried pass writes one row per attempt. */
	attemptCount: number;
	/** When the attempt started. */
	startedAt: Date;
	/** When the attempt reached its terminal status. Null exactly while `status` is `RUNNING`. */
	finishedAt?: Date;
	/** How long the attempt took, in milliseconds. Null while it is still running. */
	durationMs?: number;
	/** The instance that ran it, so a duplicate across replicas is diagnosable. Null for a run that never started. */
	nodeId?: string;
	/** The last error, when the attempt failed. Bounded, because a stack trace is evidence and not a document. */
	lastError?: string;
	/** The job's own counters — rows scanned, items emitted, children enqueued. Read whole; nothing filters on it. */
	metadata?: JsonData;
}

/**
 * What a caller states when an attempt begins.
 *
 * The status is deliberately absent: a run begins `RUNNING` and nowhere else, which is what makes
 * `finishedAt` non-null exactly when the run is over. The scope is stated rather than inferred
 * because a fan-out child runs for one tenant or one organization, and the ledger's
 * "one live run per job and scope" rule is decided on that pair.
 */
export interface IJobExecutionBeginInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The registered job's id. Required: a run nobody can name is a run nobody can inspect. */
	jobId: string;
	/** The job's name, when the caller knows a better one than the id. Defaults to `jobId`. */
	jobName?: string;
	/** What caused this attempt. Defaults to `SCHEDULED`. */
	trigger?: JobTrigger;
	/** Which attempt this is. Defaults to 1 and is never lower than 1. */
	attemptCount?: number;
	/** The instance running it. Null for a run that never started, which is what a skip records. */
	nodeId?: string;
	/** When the attempt started. Defaults to the moment the row is written. */
	startedAt?: Date;
	/** The job's own counters, when it knows them before it starts. */
	metadata?: JsonData;
}

/**
 * How an attempt ended.
 *
 * Only terminal statuses are accepted here — `RUNNING` is the state a run is *in*, not an outcome a
 * caller reports — so the write that finishes a run cannot also leave it open.
 */
export interface IJobExecutionFinishInput {
	/** How the attempt ended: `SUCCEEDED`, `FAILED`, `CANCELLED` or `SKIPPED_OVERLAP`. */
	status: JobExecutionStatus;
	/** When it ended. Defaults to the moment the row is written. */
	finishedAt?: Date;
	/** How long it took. Derived from the start and finish instants when the caller states none. */
	durationMs?: number;
	/** The attempt the run ended on. Never lower than the count the run began with. */
	attemptCount?: number;
	/** The failure, when there was one. */
	lastError?: string;
	/** The job's own counters, as it knows them at the end. Replaces what the run began with. */
	metadata?: JsonData;
}

/**
 * What a caller states when a tick could not start because another run of the job holds it.
 *
 * A skip has no start and no node: the attempt never ran, so the row records when the tick was
 * observed and why it was refused, and nothing else may be claimed about it.
 */
export interface IJobExecutionSkipOverlapInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The registered job's id whose tick was skipped. */
	jobId: string;
	/** The job's name, when the caller knows a better one than the id. Defaults to `jobId`. */
	jobName?: string;
	/** What caused the tick to fire. Defaults to `SCHEDULED`. */
	trigger?: JobTrigger;
	/** Which attempt was refused. Defaults to 1. */
	attemptCount?: number;
	/** Why the tick was refused — the live run's id, or the lock that was held. */
	reason?: string;
	/** The job's own counters, when there is anything to say about the tick. */
	metadata?: JsonData;
}

/** The fields a caller may narrow a read of the run ledger by. */
export interface IJobExecutionFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one job. The ledger's primary read: a job's recent runs. */
	jobId?: string;
	/** Restrict to jobs whose name matches. */
	jobName?: string;
	/** Restrict to one or more statuses. `RUNNING` alone is the "what is running right now" read. */
	status?: JobExecutionStatus;
	/** Restrict to one or more triggers. */
	trigger?: JobTrigger;
	/** Restrict to runs that started at or after this instant. */
	startedAfter?: Date;
	/** Restrict to runs that started before this instant. */
	startedBefore?: Date;
	/** How many rows to answer with, newest first. */
	limit?: number;
	/** How many rows to skip, for a paged read. */
	offset?: number;
}
