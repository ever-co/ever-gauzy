import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IUser } from './user.model';

/**
 * Where a dead letter stands in an operator's hands.
 *
 * Three values and no more, because the row is a queue's terminal failure rather than a workflow:
 * `NEW` is a failure nobody has dealt with, `REPLAYED` is one that was put back on its queue, and
 * `DISCARDED` is one an operator decided not to retry. Neither of the last two is a delete, and
 * neither is written without the instant and the reason that produced it — which is what makes the
 * discarded set an answer to "what did we decide to drop, and why" rather than an absence.
 */
export enum DeadLetterStatus {
	/** The job exhausted its attempts and nothing has been done about it. The operator's queue. */
	NEW = 'NEW',
	/** An operator put the job back on its queue with a fresh job id. Terminal for this row. */
	REPLAYED = 'REPLAYED',
	/** An operator decided this failure is not worth retrying, and said why. Terminal for this row. */
	DISCARDED = 'DISCARDED'
}

/**
 * The columns of one job that exhausted its attempts — the platform's only dead-letter form.
 *
 * There is no per-queue `<name>-dead` queue beside this table. A job that fails permanently is a
 * platform-level fact whatever queue it came from, and it has to be inspectable and replayable by an
 * operator rather than visible only to the queue that lost it: a queue's own failed set expires on
 * its `removeOnFail` policy, and when it does, the failure is gone. This row is what survives.
 *
 * **The payload is stored verbatim**, which is the whole point of the row: a replay re-enqueues
 * exactly what failed, so a defect that has been fixed can be retried against the same input instead
 * of being reconstructed by hand from a log line.
 *
 * `jobId` keeps the id of the job that **failed**, and is the second half of the unique tuple that
 * makes one failure one row. The id a replay enqueued is recorded in `metadata.replayedJobId`: a
 * rewritten `jobId` would make the replayed row collide with the dead letter of its own retry, which
 * is the one row the operator needs next.
 */
export interface IJobDeadLetter extends IBasePerTenantAndOrganizationEntityModel {
	/** The queue the job belonged to. The operator's grouping, and half of the row's business key. */
	queueName: string;
	/** The job's identifier on its queue, when the queue issued one. Null for a job that failed before it had an id. */
	jobId?: string;
	/** The job's name, so the row is readable without the queue's own bookkeeping. */
	jobName: string;
	/** The job's data, exactly as enqueued, so a replay re-enqueues what failed. */
	payload: JsonData;
	/** Where the row stands in an operator's hands. */
	status: DeadLetterStatus;
	/** How many attempts the job made before its attempts were exhausted. */
	attemptCount: number;
	/** When the last attempt failed. */
	failedAt: Date;
	/** Why the last attempt failed. Bounded, because a stack trace is evidence and not a document. */
	lastError?: string;
	/** When an operator replayed it. Non-null exactly when `status` is `REPLAYED`. */
	replayedAt?: Date;
	/** Who replayed it. Released rather than cascaded, because the row outlives the account that acted on it. */
	replayedByUserId?: ID;
	/** The user `replayedByUserId` names. Named for the platform's own `createdByUser`/`createdByUserId` pair. */
	replayedByUser?: IUser;
	/** When an operator discarded it. Non-null exactly when `status` is `DISCARDED`. */
	discardedAt?: Date;
	/** Why an operator discarded it. A discard without a reason is refused, which is what keeps this readable. */
	discardedReason?: string;
	/** The queue's own failure detail — the stack trace, the queue's attempt verdict. Read whole. */
	metadata?: JsonData;
}

/**
 * What a caller states when a job that exhausted its attempts is recorded.
 *
 * `status` is deliberately absent: a recorded dead letter is `NEW`, and the two later states are
 * written by the operator actions that observe them. A body that states one is refused rather than
 * silently ignored, because a caller that believes it recorded a replay has a bug it would otherwise
 * never see.
 */
export interface IJobDeadLetterRecordInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The queue the job belonged to. Required: without it the failure cannot be grouped or inspected. */
	queueName: string;
	/** The job's identifier on its queue, when it has one. */
	jobId?: string;
	/** The job's name. Required: it is what an operator recognises in a listing. */
	jobName: string;
	/** The job's data, exactly as enqueued. */
	payload: JsonData;
	/** How many attempts the job made. Required, and at least 1: a job that never ran has not failed. */
	attemptCount: number;
	/** When the last attempt failed. Defaults to the moment the row is written. */
	failedAt?: Date;
	/** Why the last attempt failed. */
	lastError?: string;
	/** The queue's own failure detail. */
	metadata?: JsonData;
}

/** What a caller states when a dead letter is put back on its queue. */
export interface IJobDeadLetterReplayInput {
	/**
	 * The fresh job id the re-enqueue produced, recorded on the row as `metadata.replayedJobId`.
	 *
	 * The enqueue itself is the queue layer's step and happens before this write: only the queue
	 * knows its policy (attempts, backoff, idempotency) and whether the queue is still declared. A
	 * replay that marked the row first and enqueued second would leave a row saying a job was retried
	 * when nothing was.
	 */
	replayedJobId?: string;
	/** Who replayed it. Defaults to the caller in the request context, when there is one. */
	replayedByUserId?: ID;
}

/** What a caller states when a dead letter is abandoned rather than retried. */
export interface IJobDeadLetterDiscardInput {
	/** Why it is not worth retrying. Required — a discard without a reason is unauditable. */
	reason: string;
	/** Who discarded it. Defaults to the caller in the request context, when there is one. */
	discardedByUserId?: ID;
}

/** The fields a caller may narrow a read of the dead-letter store by. */
export interface IJobDeadLetterFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one queue. The `deadLetterDepth` read is this filter with `status` at `NEW`. */
	queueName?: string;
	/** Restrict to one job name. */
	jobName?: string;
	/** Restrict to one or more lifecycle statuses. */
	status?: DeadLetterStatus;
	/** Restrict to rows that failed at or after this instant. */
	failedAfter?: Date;
	/** Restrict to rows that failed before this instant. */
	failedBefore?: Date;
	/** How many rows to answer with, newest failure first. */
	limit?: number;
	/** How many rows to skip, for a paged read. */
	offset?: number;
}
