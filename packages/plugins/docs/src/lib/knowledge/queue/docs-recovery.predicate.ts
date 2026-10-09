import { DocumentKindEnum, DocumentKnowledgeStatusEnum, DocumentStatusEnum } from '@gauzy/contracts';

/** The action the recovery sweep takes for one stale row. */
export type RecoveryAction = 'reenqueue-extract' | 'mark-failed' | 'reenqueue-chunk' | null;

/** Thresholds consumed by the pure recovery predicate. */
export interface IRecoveryThresholds {
	/** UPLOADED rows older than this (minutes) are re-enqueued. */
	uploadedStaleMinutes: number;
	/** PROCESSING / knowledge QUEUED-INDEXING rows older than this (minutes) are re-enqueued. */
	stuckThresholdMinutes: number;
	/** PROCESSING rows stuck longer than this (hours) flip to FAILED instead. */
	failAfterHours: number;
}

/** The row shape the predicate inspects (structural — entity-independent, unit-testable). */
export interface IRecoveryCandidate {
	kind: DocumentKindEnum;
	status: DocumentStatusEnum;
	knowledgeStatus: DocumentKnowledgeStatusEnum;
	/** Optional to mirror the entity's base-class timestamp; a missing value skips the row. */
	updatedAt?: Date | string;
}

/**
 * The pure recovery predicate — given one document row and the current time, decides
 * what the sweep should do. Deterministic and side-effect free (unit-tested directly).
 *
 * Rules (§7.5 of the backend spec):
 * 1. FILE in `UPLOADED` older than the stale window with no live job → re-enqueue extract
 *    (covers enqueue-lost races when Redis was briefly unavailable at upload time).
 * 2. `PROCESSING` whose `updatedAt` is older than the stuck threshold → re-enqueue
 *    extract (mid-run crash); stuck beyond the fail-after window → flip to `FAILED`.
 * 3. Knowledge `QUEUED`/`INDEXING` stale by the same rule (content pipeline already done)
 *    → re-enqueue from chunk.
 *
 * @param row The (partial) document row.
 * @param now The evaluation instant.
 * @param thresholds The staleness thresholds.
 * @returns The action to take, or null to leave the row alone.
 */
export function classifyRecoveryAction(
	row: IRecoveryCandidate,
	now: Date,
	thresholds: IRecoveryThresholds
): RecoveryAction {
	// No timestamp → cannot judge staleness; leave the row alone.
	if (!row.updatedAt) {
		return null;
	}
	const updatedAt = new Date(row.updatedAt).getTime();
	const ageMinutes = (now.getTime() - updatedAt) / 60_000;

	if (row.status === DocumentStatusEnum.PROCESSING) {
		if (ageMinutes >= thresholds.failAfterHours * 60) {
			return 'mark-failed';
		}
		if (ageMinutes >= thresholds.stuckThresholdMinutes) {
			return 'reenqueue-extract';
		}
		return null;
	}

	if (row.kind === DocumentKindEnum.FILE && row.status === DocumentStatusEnum.UPLOADED) {
		return ageMinutes >= thresholds.uploadedStaleMinutes ? 'reenqueue-extract' : null;
	}

	if (
		row.status === DocumentStatusEnum.READY &&
		(row.knowledgeStatus === DocumentKnowledgeStatusEnum.QUEUED ||
			row.knowledgeStatus === DocumentKnowledgeStatusEnum.INDEXING)
	) {
		return ageMinutes >= thresholds.stuckThresholdMinutes ? 'reenqueue-chunk' : null;
	}

	return null;
}
