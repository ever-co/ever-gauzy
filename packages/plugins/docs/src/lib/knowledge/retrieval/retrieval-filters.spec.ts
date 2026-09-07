import {
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum
} from '@gauzy/contracts';
import { isBlockedByReviewCircuitBreaker, isRetrievable } from './retrieval-gate';

/**
 * The review circuit breaker as a pure predicate (§12): PENDING `ai-generated` /
 * `low-confidence` and every REJECTED document are blocked; `manual` and
 * `extraction-failed` never block.
 */
describe('review circuit breaker', () => {
	const doc = (overrides: Partial<Parameters<typeof isRetrievable>[0]> = {}) => ({
		knowledgeStatus: DocumentKnowledgeStatusEnum.INDEXED,
		reviewStatus: DocumentReviewStatusEnum.NONE,
		reviewReason: undefined,
		isArchived: false,
		deletedAt: null,
		searchable: true,
		...overrides
	});

	it('blocks PENDING ai-generated and PENDING low-confidence', () => {
		expect(
			isBlockedByReviewCircuitBreaker(
				doc({
					reviewStatus: DocumentReviewStatusEnum.PENDING,
					reviewReason: DocumentReviewReasonEnum.AI_GENERATED
				})
			)
		).toBe(true);
		expect(
			isBlockedByReviewCircuitBreaker(
				doc({
					reviewStatus: DocumentReviewStatusEnum.PENDING,
					reviewReason: DocumentReviewReasonEnum.LOW_CONFIDENCE
				})
			)
		).toBe(true);
	});

	it('never blocks PENDING manual or PENDING extraction-failed', () => {
		expect(
			isBlockedByReviewCircuitBreaker(
				doc({ reviewStatus: DocumentReviewStatusEnum.PENDING, reviewReason: DocumentReviewReasonEnum.MANUAL })
			)
		).toBe(false);
		expect(
			isBlockedByReviewCircuitBreaker(
				doc({
					reviewStatus: DocumentReviewStatusEnum.PENDING,
					reviewReason: DocumentReviewReasonEnum.EXTRACTION_FAILED
				})
			)
		).toBe(false);
	});

	it('blocks every REJECTED document regardless of reason', () => {
		expect(
			isBlockedByReviewCircuitBreaker(doc({ reviewStatus: DocumentReviewStatusEnum.REJECTED }))
		).toBe(true);
		expect(
			isBlockedByReviewCircuitBreaker(
				doc({ reviewStatus: DocumentReviewStatusEnum.REJECTED, reviewReason: DocumentReviewReasonEnum.MANUAL })
			)
		).toBe(true);
	});

	it('does not block NONE and APPROVED', () => {
		expect(isBlockedByReviewCircuitBreaker(doc())).toBe(false);
		expect(isBlockedByReviewCircuitBreaker(doc({ reviewStatus: DocumentReviewStatusEnum.APPROVED }))).toBe(false);
	});
});

describe('isRetrievable', () => {
	const doc = (overrides: Partial<Parameters<typeof isRetrievable>[0]> = {}) => ({
		knowledgeStatus: DocumentKnowledgeStatusEnum.INDEXED,
		reviewStatus: DocumentReviewStatusEnum.NONE,
		reviewReason: undefined,
		isArchived: false,
		deletedAt: null,
		searchable: true,
		...overrides
	});

	it('accepts an INDEXED, visible, unblocked document', () => {
		expect(isRetrievable(doc())).toBe(true);
	});

	it('requires knowledgeStatus INDEXED', () => {
		for (const knowledgeStatus of [
			DocumentKnowledgeStatusEnum.NONE,
			DocumentKnowledgeStatusEnum.QUEUED,
			DocumentKnowledgeStatusEnum.INDEXING,
			DocumentKnowledgeStatusEnum.FAILED,
			DocumentKnowledgeStatusEnum.EXCLUDED
		]) {
			expect(isRetrievable(doc({ knowledgeStatus }))).toBe(false);
		}
	});

	it('rejects archived, deleted, and unsearchable documents', () => {
		expect(isRetrievable(doc({ isArchived: true }))).toBe(false);
		expect(isRetrievable(doc({ deletedAt: new Date() }))).toBe(false);
		expect(isRetrievable(doc({ searchable: false }))).toBe(false);
	});

	it('applies the review circuit breaker', () => {
		expect(
			isRetrievable(
				doc({
					reviewStatus: DocumentReviewStatusEnum.PENDING,
					reviewReason: DocumentReviewReasonEnum.AI_GENERATED
				})
			)
		).toBe(false);
		expect(isRetrievable(doc({ reviewStatus: DocumentReviewStatusEnum.REJECTED }))).toBe(false);
		// While review-pending `manual` documents DO surface.
		expect(
			isRetrievable(
				doc({ reviewStatus: DocumentReviewStatusEnum.PENDING, reviewReason: DocumentReviewReasonEnum.MANUAL })
			)
		).toBe(true);
	});
});
