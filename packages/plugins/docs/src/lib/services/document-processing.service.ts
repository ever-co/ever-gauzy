import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentStatusEnum,
	ID,
	IDocument
} from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { EventBus, FileStorage, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_EXTRACTED_TEXT_EDITED, DOCS_NOT_A_FILE } from '../docs.constants';
import { ReprocessDocumentDTO, UpdateExtractedTextDTO } from '../dto';
import { Document } from '../entities/document.entity';
import { DocumentEvent, IDocumentEventContext } from '../events/document.event';
import { DocsPermanentError } from '../knowledge/errors';
import { ExtractionRegistryService, IDocumentExtractionResult } from '../knowledge/extraction';
import { DOCS_JOB_CHUNK, DOCS_JOB_EXTRACT } from '../knowledge/queue/constants';
import { DocsJobReason, IDocsExtractJob, IDocsJobBase } from '../knowledge/queue/docs-job.types';
import { DocsQueueService } from '../knowledge/queue/docs-queue.service';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentService } from './document.service';

/**
 * Pipeline orchestration facade: status transitions (`UPLOADED→PROCESSING→READY|FAILED`),
 * the `extractedTextEdited` guard (a human correction is never silently overwritten),
 * review-flag setting, `DocumentEvent` emission per transition, and the request-path
 * reprocess / extracted-text-correction flows.
 *
 * Worker-thread methods take an explicit tenant/organization snapshot and use plain
 * repository queries — `RequestContext` is NEVER consulted on queue threads.
 */
@Injectable()
export class DocumentProcessingService {
	private readonly logger = new Logger(DocumentProcessingService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly documentService: DocumentService,
		private readonly docsQueueService: DocsQueueService,
		private readonly extractionRegistry: ExtractionRegistryService,
		private readonly _eventBus: EventBus
	) {}

	/**
	 * Loads a document by the explicit job snapshot (worker-safe — no `RequestContext`).
	 * A soft-deleted or missing row returns null: the caller logs and completes the job.
	 */
	async loadSnapshot(documentId: ID, tenantId: ID, organizationId: ID): Promise<Document | null> {
		return this.typeOrmDocumentRepository.findOne({
			where: { id: documentId, tenantId, organizationId }
		});
	}

	/**
	 * Runs extraction for one FILE document (the `docs.extract` handler body).
	 *
	 * Honors the human-correction guard: when `extractedTextEdited` is set (and the job
	 * does not carry `keepExtractedText`, which skips extraction entirely), the stored
	 * text is preserved — a retry can never clobber a human correction.
	 *
	 * @param document The snapshot-loaded document row.
	 * @param job The extract-job payload.
	 * @returns True when extraction wrote (or preserved) usable text.
	 */
	async runExtraction(document: Document, job: IDocsExtractJob): Promise<boolean> {
		const config = getDocsConfig();

		// keepExtractedText / edited guard — preserve the stored text, skip the extractor.
		if (job.keepExtractedText || document.extractedTextEdited) {
			this.logger.log(
				`Extraction skipped for document ${document.id} (keepExtractedText=${!!job.keepExtractedText}, edited=${document.extractedTextEdited})`
			);
			await this.transition(document, {
				status: DocumentStatusEnum.READY,
				statusMessage: null
			});
			return Boolean(document.extractedText);
		}

		if (!document.storageKey) {
			throw new DocsPermanentError('The document has no stored file to extract.');
		}

		await this.transition(document, { status: DocumentStatusEnum.PROCESSING });

		// Load the blob through the provider recorded on the row.
		const provider = new FileStorage().getProvider(document.storageProvider);
		const buffer = await provider.getFile(document.storageKey);

		const result: IDocumentExtractionResult = await this.extractionRegistry.extract(buffer as Buffer, {
			filename: document.originalFilename ?? document.name,
			mimeType: document.mimeType,
			maxChars: config.maxExtractedChars,
			forceOcr: job.forceOcr,
			// The OCR path resolves provider credentials from these. They come off the JOB,
			// never `RequestContext` — extraction runs on queue and background threads.
			tenantId: job.tenantId ?? document.tenantId,
			organizationId: job.organizationId ?? document.organizationId
		});

		const metadata = this.mergeExtractionMetadata(document, result);
		const patch: Partial<Document> = {
			extractedText: result.markdown,
			status: DocumentStatusEnum.READY,
			statusMessage: null,
			// `.update()` bypasses entity subscribers, so the sqlite text-column
			// serialization the DocumentSubscriber normally performs happens here.
			metadata: (isSqlite() || isBetterSqlite3() ? JSON.stringify(metadata) : metadata) as any
		};

		// OCR-derived text is a transcription, not a parse: it can silently drop or garble
		// content no downstream stage can detect. So it enters the review circuit breaker on
		// arrival — indexed and searchable, but withheld from AI retrieval until a human
		// approves it. The document still continues the normal chain from here.
		if (result.metadata?.ocr) {
			patch.reviewStatus = DocumentReviewStatusEnum.PENDING;
			patch.reviewReason = DocumentReviewReasonEnum.LOW_CONFIDENCE;
		}

		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			patch
		);
		document.extractedText = result.markdown;
		document.status = DocumentStatusEnum.READY;
		document.metadata = metadata;
		if (result.metadata?.ocr) {
			document.reviewStatus = DocumentReviewStatusEnum.PENDING;
			document.reviewReason = DocumentReviewReasonEnum.LOW_CONFIDENCE;
			this.logger.log(
				`Extraction for document ${document.id} came from OCR ` +
					`(${result.metadata.ocr.pagesTranscribed}/${result.metadata.ocr.pageCount} pages via ` +
					`${result.metadata.ocr.providerId}) — flagged for review.`
			);
		}

		this.emitEvent(document, 'updated', {
			phase: 'status',
			previous: DocumentStatusEnum.PROCESSING,
			next: DocumentStatusEnum.READY
		});
		return true;
	}

	/**
	 * Dead-letters an extract/classify-stage failure onto the document row itself:
	 * `status: FAILED` + user-safe `statusMessage` (500 chars) + review flag
	 * `PENDING / extraction-failed`. Only `DocsPermanentError` messages are user-facing.
	 */
	async markExtractionFailed(document: Document, error: unknown): Promise<void> {
		const message =
			error instanceof DocsPermanentError
				? error.message
				: 'An unexpected error occurred while processing the document.';

		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{
				status: DocumentStatusEnum.FAILED,
				statusMessage: message.slice(0, 500),
				reviewStatus: DocumentReviewStatusEnum.PENDING,
				reviewReason: DocumentReviewReasonEnum.EXTRACTION_FAILED
			}
		);
		document.status = DocumentStatusEnum.FAILED;

		this.emitEvent(document, 'updated', {
			phase: 'status',
			previous: DocumentStatusEnum.PROCESSING,
			next: DocumentStatusEnum.FAILED
		});
	}

	/**
	 * Dead-letters a knowledge-stage (chunk/embed/index) failure: `knowledgeStatus: FAILED`
	 * — `status` is NOT demoted (the document itself is fine; only its projection failed).
	 */
	async markKnowledgeFailed(document: Document, error: unknown): Promise<void> {
		const message =
			error instanceof DocsPermanentError
				? error.message
				: 'An unexpected error occurred while indexing the document.';

		const previous = document.knowledgeStatus;
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{
				knowledgeStatus: DocumentKnowledgeStatusEnum.FAILED,
				statusMessage: message.slice(0, 500)
			}
		);
		document.knowledgeStatus = DocumentKnowledgeStatusEnum.FAILED;

		this.emitEvent(document, 'updated', {
			phase: 'knowledge',
			previous,
			next: DocumentKnowledgeStatusEnum.FAILED
		});
	}

	/**
	 * Sets the knowledge status with an event emission (worker-safe).
	 */
	async setKnowledgeStatus(document: Document, next: DocumentKnowledgeStatusEnum): Promise<void> {
		const previous = document.knowledgeStatus;
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{ knowledgeStatus: next }
		);
		document.knowledgeStatus = next;
		this.emitEvent(document, 'updated', { phase: 'knowledge', previous, next });
	}

	/**
	 * Request-path: `POST /documents/:id/reprocess` — re-runs the pipeline from
	 * `docs.extract` for a FILE document.
	 *
	 * @param id The document id (RBAC/visibility-scoped through `DocumentService`).
	 * @param input `{ force?, ocr?, overwriteEdited? }`.
	 * @returns The document after the enqueue.
	 */
	async reprocess(id: ID, input: ReprocessDocumentDTO): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);
		await this.documentService.assertCanWrite(document);

		if (document.kind !== DocumentKindEnum.FILE) {
			throw new ConflictException({
				message: 'Only FILE documents can be reprocessed',
				code: DOCS_NOT_A_FILE
			});
		}

		// The clobber guard: a human correction is never silently overwritten.
		if (document.extractedTextEdited && !input.overwriteEdited) {
			throw new ConflictException({
				message: 'The extracted text was edited by a human — pass overwriteEdited to re-extract',
				code: DOCS_EXTRACTED_TEXT_EDITED
			});
		}

		if (document.extractedTextEdited && input.overwriteEdited) {
			await this.typeOrmDocumentRepository.update(
				{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
				{ extractedTextEdited: false }
			);
			document.extractedTextEdited = false;
		}

		await this.enqueueExtract(
			document,
			'reindex',
			{ keepExtractedText: false, forceOcr: input.ocr === true },
			// A user-triggered reprocess must always run — a unique suffix bypasses the
			// deterministic-id coalescing against a retained completed job.
			{ jobId: `docs:extract:${document.id}:${Date.now()}` }
		);
		return document;
	}

	/**
	 * Request-path: `PUT /documents/:id/extracted-text` — the human correction flow.
	 * Stores the text, sets `extractedTextEdited: true` (permanent pipeline-overwrite
	 * protection), forces `status: READY`, clears `statusMessage` and `aiConfidence`,
	 * clears an `extraction-failed` PENDING review state, and re-enqueues from
	 * `docs.chunk` (`reason: 'extracted-text-edited'`) when the document is in knowledge.
	 */
	async updateExtractedText(id: ID, input: UpdateExtractedTextDTO): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);
		await this.documentService.assertCanWrite(document);

		if (document.kind !== DocumentKindEnum.FILE) {
			throw new ConflictException({
				message: 'Extracted text applies to FILE documents only',
				code: DOCS_NOT_A_FILE
			});
		}

		const previousStatus = document.status;
		const patch: Partial<Document> = {
			extractedText: input.extractedText,
			extractedTextEdited: true,
			status: DocumentStatusEnum.READY,
			statusMessage: null,
			aiConfidence: null
		};
		if (
			document.reviewStatus === DocumentReviewStatusEnum.PENDING &&
			document.reviewReason === DocumentReviewReasonEnum.EXTRACTION_FAILED
		) {
			patch.reviewStatus = DocumentReviewStatusEnum.NONE;
			patch.reviewReason = null;
		}

		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			patch
		);
		Object.assign(document, patch);

		this.emitEvent(document, 'updated', {
			phase: 'status',
			previous: previousStatus,
			next: DocumentStatusEnum.READY
		});

		// Entering at the chunk stage never runs extract/classify — the correction
		// survives by construction.
		if (
			document.knowledgeStatus !== DocumentKnowledgeStatusEnum.NONE &&
			document.knowledgeStatus !== DocumentKnowledgeStatusEnum.EXCLUDED
		) {
			await this.docsQueueService.enqueue(DOCS_JOB_CHUNK, this.snapshotOf(document, 'extracted-text-edited'));
		}

		return document;
	}

	/**
	 * Enqueues `docs.extract` for a document with the standard tenant snapshot.
	 */
	async enqueueExtract(
		document: IDocument,
		reason: DocsJobReason,
		extras: Partial<IDocsExtractJob> = {},
		options: Record<string, unknown> = {}
	): Promise<boolean> {
		const payload: IDocsExtractJob = { ...this.snapshotOf(document, reason), ...extras };
		return this.docsQueueService.enqueue(DOCS_JOB_EXTRACT, payload, options as any);
	}

	/**
	 * Builds the standard `IDocsJobBase` snapshot for a document.
	 */
	public snapshotOf(document: IDocument, reason: DocsJobReason): IDocsJobBase {
		let initiatedByUserId: ID | undefined;
		try {
			initiatedByUserId = RequestContext.currentUserId() ?? undefined;
		} catch {
			initiatedByUserId = undefined; // queue threads have no request context
		}
		return {
			documentId: document.id,
			tenantId: document.tenantId,
			organizationId: document.organizationId,
			reason,
			initiatedByUserId
		};
	}

	/**
	 * Worker-safe status transition + event emission.
	 */
	private async transition(
		document: Document,
		patch: { status: DocumentStatusEnum; statusMessage?: string | null }
	): Promise<void> {
		const previous = document.status;
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			patch as any
		);
		document.status = patch.status;
		this.emitEvent(document, 'updated', { phase: 'status', previous, next: patch.status });
	}

	/**
	 * Merges the extraction result metadata under `metadata.extraction`.
	 */
	private mergeExtractionMetadata(document: Document, result: IDocumentExtractionResult): any {
		const existing = (document.metadata && typeof document.metadata === 'object' ? document.metadata : {}) as any;
		return {
			...existing,
			extraction: {
				pageCount: result.metadata?.pageCount,
				truncated: result.metadata?.truncated ?? false,
				warnings: result.metadata?.warnings,
				wordCount: result.metadata?.wordCount,
				// Present ONLY on OCR-derived text — its presence is the provenance flag the
				// review queue and the detail panel read to say "transcribed, not parsed".
				ocr: result.metadata?.ocr,
				extractedAt: new Date().toISOString()
			}
		};
	}

	/**
	 * Best-effort `DocumentEvent` emission — a failure logs and never rolls back the
	 * primary mutation. On queue threads the request context is simply absent.
	 */
	private emitEvent(document: Document, type: 'created' | 'updated' | 'deleted', context: IDocumentEventContext): void {
		try {
			const ctx = RequestContext.currentRequestContext();
			// `EventBus.publish` is `async`, so the catch below can only ever see a
			// synchronous throw (the context read, the event construction) — a rejected
			// publish would sail straight past it as an unhandled rejection. Emission is
			// best-effort by contract, so the promise is terminated on its own channel.
			this._eventBus
				.publish(new DocumentEvent(ctx, document, type, context))
				.catch((error) =>
					this.logger.warn(`Failed to publish DocumentEvent (${type}): ${(error as Error).message}`)
				);
		} catch (error) {
			this.logger.warn(`Failed to publish DocumentEvent (${type}): ${(error as Error).message}`);
		}
	}

}
