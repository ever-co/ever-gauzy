import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	ID,
	IDocument
} from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { RequestContext } from '@gauzy/core';
import { DOCS_REVIEW_NOT_PENDING } from '../docs.constants';
import { ApproveReviewDTO, RejectReviewDTO, RequestReviewDTO } from '../dto';
import { Document } from '../entities/document.entity';
import { DocumentIndexService } from '../knowledge/indexing/document-index.service';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentService } from './document.service';

/**
 * The human-review workflow (§4.9 of the backend spec, §12 of the AI-knowledge spec).
 *
 * State machine: `NONE → PENDING → APPROVED | REJECTED` (re-reviewable). Approve makes an
 * already-`INDEXED` document retrievable immediately — the circuit-breaker filter is
 * dynamic, no re-index needed. Reject never deletes the document; it forces
 * `knowledgeStatus: EXCLUDED` and physically removes the knowledge projection.
 */
@Injectable()
export class DocumentReviewService {
	private readonly logger = new Logger(DocumentReviewService.name);

	constructor(
		private readonly documentService: DocumentService,
		private readonly documentIndexService: DocumentIndexService,
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository
	) {}

	/**
	 * `POST /documents/:id/review/request` — manual review request. Already PENDING →
	 * 200 no-op (machine-set reasons come from the pipeline, never from this route).
	 */
	public async requestReview(id: ID, input: RequestReviewDTO = {}): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);
		// A review request mutates the document's review state — read access is not enough.
		await this.documentService.assertCanWrite(document);
		if (document.reviewStatus === DocumentReviewStatusEnum.PENDING) {
			return document;
		}

		const previous = document.reviewStatus;
		await this.updateReview(document, {
			reviewStatus: DocumentReviewStatusEnum.PENDING,
			reviewReason: DocumentReviewReasonEnum.MANUAL,
			reviewedById: null,
			reviewedAt: null
		});
		if (input.reason) {
			await this.mergeReviewMetadata(document, { requestReason: input.reason.slice(0, 1000) });
		}
		this.emit(document, previous, DocumentReviewStatusEnum.PENDING);
		return document;
	}

	/**
	 * `POST /documents/:id/review/approve` — PENDING → APPROVED; stamps `reviewedById` +
	 * `reviewedAt`. An `INDEXED`-pending-gate document becomes retrievable immediately.
	 * Non-PENDING → 409 `DOCS_REVIEW_NOT_PENDING`.
	 */
	public async approve(id: ID, input: ApproveReviewDTO = {}): Promise<IDocument> {
		const document = await this.requirePending(id);

		await this.updateReview(document, {
			reviewStatus: DocumentReviewStatusEnum.APPROVED,
			reviewedById: RequestContext.currentEmployeeId() ?? null,
			reviewedAt: new Date()
		});
		if (input.note) {
			await this.mergeReviewMetadata(document, { approveNote: input.note.slice(0, 1000) });
		}
		this.emit(document, DocumentReviewStatusEnum.PENDING, DocumentReviewStatusEnum.APPROVED);
		return document;
	}

	/**
	 * `POST /documents/:id/review/reject` — PENDING → REJECTED; the document stays in the
	 * hub but is excluded from AI retrieval: `knowledgeStatus` forced to `EXCLUDED` and the
	 * knowledge projection removed. Re-reviewable via a new review request.
	 */
	public async reject(id: ID, input: RejectReviewDTO = {}): Promise<IDocument> {
		const document = await this.requirePending(id);

		await this.updateReview(document, {
			reviewStatus: DocumentReviewStatusEnum.REJECTED,
			reviewedById: RequestContext.currentEmployeeId() ?? null,
			reviewedAt: new Date()
		});
		if (input.reason) {
			await this.mergeReviewMetadata(document, { rejectReason: input.reason.slice(0, 1000) });
		}

		// Rejected content leaves the index physically (§4.9 / §12).
		if (document.knowledgeStatus !== DocumentKnowledgeStatusEnum.NONE) {
			await this.documentIndexService.removeKnowledgeProjection(
				{ tenantId: document.tenantId, organizationId: document.organizationId },
				document.id
			);
			const previousKnowledge = document.knowledgeStatus;
			await this.typeOrmDocumentRepository.update(
				{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
				{ knowledgeStatus: DocumentKnowledgeStatusEnum.EXCLUDED }
			);
			document.knowledgeStatus = DocumentKnowledgeStatusEnum.EXCLUDED;
			this.documentService.emitDocumentEvent(document, 'updated', {
				phase: 'knowledge',
				previous: previousKnowledge,
				next: DocumentKnowledgeStatusEnum.EXCLUDED
			});
		}

		this.emit(document, DocumentReviewStatusEnum.PENDING, DocumentReviewStatusEnum.REJECTED);
		return document;
	}

	/** Loads the document and enforces the PENDING precondition. */
	private async requirePending(id: ID): Promise<Document> {
		const document = await this.documentService.findOneScoped(id);
		if (document.reviewStatus !== DocumentReviewStatusEnum.PENDING) {
			throw new ConflictException({
				message: 'The document is not pending review',
				code: DOCS_REVIEW_NOT_PENDING
			});
		}
		return document;
	}

	/** Scoped review-column update mirrored onto the in-memory entity. */
	private async updateReview(
		document: Document,
		patch: Partial<Record<'reviewStatus' | 'reviewReason' | 'reviewedById' | 'reviewedAt', any>>
	): Promise<void> {
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			patch as any
		);
		Object.assign(document, patch);
	}

	/** Merges keys into `metadata.review` (sqlite-aware — `update` bypasses subscribers). */
	private async mergeReviewMetadata(document: Document, patch: Record<string, unknown>): Promise<void> {
		const existing = (document.metadata && typeof document.metadata === 'object' ? document.metadata : {}) as any;
		const metadata = { ...existing, review: { ...(existing.review ?? {}), ...patch } };
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{ metadata: isSqlite() || isBetterSqlite3() ? (JSON.stringify(metadata) as any) : metadata } as any
		);
		document.metadata = metadata;
	}

	private emit(document: Document, previous: string, next: string): void {
		this.documentService.emitDocumentEvent(document, 'updated', { phase: 'review', previous, next });
	}
}
