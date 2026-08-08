import { DocumentKindEnum, DocumentKnowledgeStatusEnum, DocumentStatusEnum } from '@gauzy/contracts';
import { classifyRecoveryAction, IRecoveryThresholds } from './docs-recovery.predicate';

const thresholds: IRecoveryThresholds = {
	uploadedStaleMinutes: 5,
	stuckThresholdMinutes: 30,
	failAfterHours: 24
};

const now = new Date('2026-08-07T12:00:00.000Z');

/** Builds a candidate row `ageMinutes` old. */
const row = (
	overrides: Partial<{
		kind: DocumentKindEnum;
		status: DocumentStatusEnum;
		knowledgeStatus: DocumentKnowledgeStatusEnum;
	}>,
	ageMinutes: number
) =>
	({
		kind: DocumentKindEnum.FILE,
		status: DocumentStatusEnum.READY,
		knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
		updatedAt: new Date(now.getTime() - ageMinutes * 60_000),
		...overrides
	} as any);

describe('classifyRecoveryAction (recovery-scan predicate)', () => {
	it('re-enqueues a stale UPLOADED file (enqueue-lost race)', () => {
		expect(classifyRecoveryAction(row({ status: DocumentStatusEnum.UPLOADED }, 6), now, thresholds)).toBe(
			'reenqueue-extract'
		);
	});

	it('leaves a fresh UPLOADED file alone (extract may be in flight)', () => {
		expect(classifyRecoveryAction(row({ status: DocumentStatusEnum.UPLOADED }, 2), now, thresholds)).toBeNull();
	});

	it('re-enqueues a PROCESSING row stuck past the threshold (mid-run crash)', () => {
		expect(classifyRecoveryAction(row({ status: DocumentStatusEnum.PROCESSING }, 31), now, thresholds)).toBe(
			'reenqueue-extract'
		);
	});

	it('leaves an actively PROCESSING row alone', () => {
		expect(classifyRecoveryAction(row({ status: DocumentStatusEnum.PROCESSING }, 10), now, thresholds)).toBeNull();
	});

	it('flips a PROCESSING row stuck for more than 24h to FAILED', () => {
		expect(
			classifyRecoveryAction(row({ status: DocumentStatusEnum.PROCESSING }, 25 * 60), now, thresholds)
		).toBe('mark-failed');
	});

	it('re-enqueues chunk for stale knowledge QUEUED/INDEXING on a READY document', () => {
		expect(
			classifyRecoveryAction(
				row({ knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED }, 45),
				now,
				thresholds
			)
		).toBe('reenqueue-chunk');
		expect(
			classifyRecoveryAction(
				row({ knowledgeStatus: DocumentKnowledgeStatusEnum.INDEXING }, 45),
				now,
				thresholds
			)
		).toBe('reenqueue-chunk');
	});

	it('does not re-enqueue chunk while the content pipeline still owns the row', () => {
		// knowledgeStatus QUEUED but the document is still UPLOADED — extract recovery owns it.
		expect(
			classifyRecoveryAction(
				row({ status: DocumentStatusEnum.UPLOADED, knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED }, 45),
				now,
				thresholds
			)
		).toBe('reenqueue-extract');
	});

	it('leaves settled rows alone (READY/NONE, INDEXED, FAILED, EXCLUDED)', () => {
		expect(classifyRecoveryAction(row({}, 1000), now, thresholds)).toBeNull();
		expect(
			classifyRecoveryAction(row({ knowledgeStatus: DocumentKnowledgeStatusEnum.INDEXED }, 1000), now, thresholds)
		).toBeNull();
		expect(
			classifyRecoveryAction(row({ status: DocumentStatusEnum.FAILED }, 1000), now, thresholds)
		).toBeNull();
		expect(
			classifyRecoveryAction(row({ knowledgeStatus: DocumentKnowledgeStatusEnum.EXCLUDED }, 1000), now, thresholds)
		).toBeNull();
	});

	it('is deterministic for identical inputs', () => {
		const input = row({ status: DocumentStatusEnum.PROCESSING }, 31);
		expect(classifyRecoveryAction(input, now, thresholds)).toBe(classifyRecoveryAction(input, now, thresholds));
	});
});
