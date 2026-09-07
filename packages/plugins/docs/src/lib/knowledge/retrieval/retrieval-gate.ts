import {
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum
} from '@gauzy/contracts';

/**
 * The review circuit breaker and retrievability predicates (§12/§9.2 of the AI-knowledge
 * spec) as PURE functions — no ORM, no Nest imports, so unit tests and non-SQL consumers
 * (e.g. the chat `docs_read` refusal path) can use them directly. The SQL filter set in
 * `retrieval-filters.ts` mirrors these exactly.
 */

/** The minimal document projection the circuit-breaker predicate inspects. */
export interface IRetrievalGateDocument {
	knowledgeStatus: DocumentKnowledgeStatusEnum;
	reviewStatus: DocumentReviewStatusEnum;
	reviewReason?: DocumentReviewReasonEnum | null;
	isArchived?: boolean;
	deletedAt?: Date | null;
	searchable?: boolean;
}

/**
 * The review circuit breaker (§12): a `PENDING` document with reason `ai-generated` or
 * `low-confidence`, or any `REJECTED` document, is blocked from retrieval (and from
 * `docs_read`). Reasons `manual` and `extraction-failed` never block.
 */
export function isBlockedByReviewCircuitBreaker(document: IRetrievalGateDocument): boolean {
	if (document.reviewStatus === DocumentReviewStatusEnum.REJECTED) {
		return true;
	}
	return (
		document.reviewStatus === DocumentReviewStatusEnum.PENDING &&
		(document.reviewReason === DocumentReviewReasonEnum.AI_GENERATED ||
			document.reviewReason === DocumentReviewReasonEnum.LOW_CONFIDENCE)
	);
}

/**
 * The full retrievability predicate mirrored by the SQL filter set — INDEXED, not
 * archived/deleted, searchable, and not blocked by the review circuit breaker.
 */
export function isRetrievable(document: IRetrievalGateDocument): boolean {
	return (
		document.knowledgeStatus === DocumentKnowledgeStatusEnum.INDEXED &&
		document.isArchived !== true &&
		!document.deletedAt &&
		document.searchable !== false &&
		!isBlockedByReviewCircuitBreaker(document)
	);
}
