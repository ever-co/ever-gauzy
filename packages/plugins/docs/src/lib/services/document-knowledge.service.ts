import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DocumentKindEnum, DocumentKnowledgeStatusEnum, DocumentStatusEnum, ID, IDocument } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_NOT_INDEXABLE, DOCS_NOT_READY } from '../docs.constants';
import { BulkKnowledgeReindexDTO, ReindexDocumentKnowledgeDTO } from '../dto';
import { Document } from '../entities/document.entity';
import { DocsAiService } from '../knowledge/ai/docs-ai.service';
import { DocumentIndexService } from '../knowledge/indexing/document-index.service';
import { VECTOR_STORE_PGVECTOR } from '../knowledge/knowledge.constants';
import { DOCS_JOB_CHUNK, DOCS_JOB_CLASSIFY, DOCS_JOB_EXTRACT } from '../knowledge/queue/constants';
import { DocsQueueService } from '../knowledge/queue/docs-queue.service';
import { DocumentVectorStoreRegistry } from '../knowledge/vector-store/vector-store.registry';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentProcessingService } from './document-processing.service';
import { DocumentService } from './document.service';

/** Response of `GET /api/plugins/docs/knowledge/status` (§8.3). */
export interface IKnowledgeStatus {
	vectorCapable: boolean;
	embeddingProviderConfigured: boolean;
	embeddingModel: string;
}

/** Response of the bulk reindex sweep. */
export interface IBulkReindexResult {
	scope: 'model-drift' | 'all';
	dryRun: boolean;
	affected: number;
}

/**
 * Request-path knowledge lifecycle operations (§4.8 of the backend spec): import,
 * exclude, per-document and bulk re-index, and the capability status probe.
 */
@Injectable()
export class DocumentKnowledgeService {
	private readonly logger = new Logger(DocumentKnowledgeService.name);

	constructor(
		private readonly documentService: DocumentService,
		private readonly processingService: DocumentProcessingService,
		private readonly documentIndexService: DocumentIndexService,
		private readonly docsQueueService: DocsQueueService,
		private readonly docsAiService: DocsAiService,
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository
	) {}

	/**
	 * `POST /documents/:id/knowledge/import` — `NONE`/`EXCLUDED`/`FAILED` → `QUEUED` +
	 * enqueue from the right pipeline stage (`docs.chunk` when `extractedText` exists,
	 * else `docs.extract`). Already `INDEXED`/`QUEUED`/`INDEXING` → no-op. FILE must be
	 * `READY` (409 `DOCS_NOT_READY`); PAGE always eligible; FOLDER never indexable.
	 */
	public async importToKnowledge(id: ID): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);
		this.assertIndexable(document);

		if (
			[
				DocumentKnowledgeStatusEnum.INDEXED,
				DocumentKnowledgeStatusEnum.QUEUED,
				DocumentKnowledgeStatusEnum.INDEXING
			].includes(document.knowledgeStatus)
		) {
			return document; // idempotent no-op
		}

		if (document.kind === DocumentKindEnum.FILE && document.status !== DocumentStatusEnum.READY) {
			throw new ConflictException({
				message: 'The document must finish processing before it can enter AI knowledge',
				code: DOCS_NOT_READY
			});
		}

		await this.setKnowledgeStatus(document, DocumentKnowledgeStatusEnum.QUEUED);

		const hasText = document.kind === DocumentKindEnum.PAGE || Boolean(document.extractedText);
		await this.docsQueueService.enqueue(
			hasText ? DOCS_JOB_CHUNK : DOCS_JOB_EXTRACT,
			this.processingService.snapshotOf(document, 'import'),
			{ jobId: `docs:${hasText ? 'chunk' : 'extract'}:${document.id}:${Date.now()}` }
		);
		return document;
	}

	/**
	 * `POST /documents/:id/knowledge/exclude` — sets `EXCLUDED` and deletes the document's
	 * chunks + index state transactionally (excluded content leaves the index physically).
	 * Idempotent.
	 */
	public async excludeFromKnowledge(id: ID): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);

		await this.documentIndexService.removeKnowledgeProjection(
			{ tenantId: document.tenantId, organizationId: document.organizationId },
			document.id
		);
		if (document.knowledgeStatus !== DocumentKnowledgeStatusEnum.EXCLUDED) {
			await this.setKnowledgeStatus(document, DocumentKnowledgeStatusEnum.EXCLUDED);
		}
		return document;
	}

	/**
	 * `POST /documents/:id/knowledge/reindex` — re-runs `chunk → embed → index`.
	 * `force: false` (default) keeps the `contentHash` short-circuit.
	 */
	public async reindexDocument(id: ID, input: ReindexDocumentKnowledgeDTO = {}): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);
		this.assertIndexable(document);

		if (
			document.knowledgeStatus === DocumentKnowledgeStatusEnum.NONE ||
			document.knowledgeStatus === DocumentKnowledgeStatusEnum.EXCLUDED
		) {
			// A reindex of a never-imported document is an import.
			return this.importToKnowledge(id);
		}

		await this.setKnowledgeStatus(document, DocumentKnowledgeStatusEnum.QUEUED);
		await this.docsQueueService.enqueue(
			DOCS_JOB_CHUNK,
			{ ...this.processingService.snapshotOf(document, 'reindex'), force: input.force === true },
			// A user-triggered reindex must always run — bypass deterministic-id coalescing.
			{ jobId: `docs:chunk:${document.id}:${Date.now()}` }
		);
		return document;
	}

	/**
	 * `POST /knowledge/reindex` — the bulk model-drift / full re-index sweep (§8.4).
	 * Selects the caller's tenant/org `INDEXED` documents whose index state mismatches the
	 * expected model (or all, for `scope: 'all'`) and enqueues low-priority `chunk` jobs.
	 */
	public async bulkReindex(input: BulkKnowledgeReindexDTO = {}): Promise<IBulkReindexResult> {
		const tenantId = RequestContext.currentTenantId() as ID;
		// Same rule as every other docs path: an unresolvable organization scope is a 400, never
		// "the whole tenant" (a null used to be dropped from the where and enqueued reindex jobs for
		// every indexed document of the tenant with a null organization key).
		const organizationId = this.documentService.resolveOrganizationId();
		const scope = input.scope ?? 'model-drift';
		const dryRun = input.dryRun === true;

		let documentIds: ID[];
		if (scope === 'all') {
			const rows = await this.typeOrmDocumentRepository.find({
				select: { id: true },
				where: { tenantId, organizationId, knowledgeStatus: DocumentKnowledgeStatusEnum.INDEXED }
			});
			documentIds = rows.map((row) => row.id);
		} else {
			const expectedModel = await this.documentIndexService.expectedEmbeddingModel(tenantId);
			documentIds = await this.documentIndexService.findModelDriftDocumentIds(
				{ tenantId, organizationId },
				expectedModel
			);
		}

		if (!dryRun) {
			for (const documentId of documentIds) {
				await this.docsQueueService.enqueue(
					DOCS_JOB_CHUNK,
					{
						documentId,
						tenantId,
						organizationId,
						reason: scope === 'all' ? 'reindex' : 'model-changed',
						initiatedByUserId: RequestContext.currentUserId() ?? undefined,
						force: scope === 'all'
					},
					// Low priority — a sweep must never starve interactive pipeline work.
					{ jobId: `docs:chunk:${documentId}:${Date.now()}`, priority: 10 }
				);
			}
			this.logger.log(`Bulk knowledge reindex (${scope}) enqueued ${documentIds.length} documents`);
		}

		return { scope, dryRun, affected: documentIds.length };
	}

	/**
	 * `POST /documents/:id/summary/regenerate` — re-runs the classification stage (which
	 * regenerates the AI summary) for a READY FILE document with extracted text.
	 */
	public async regenerateSummary(id: ID): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(id);
		if (document.kind !== DocumentKindEnum.FILE || !document.extractedText) {
			throw new ConflictException({
				message: 'A summary can only be regenerated for a FILE document with extracted text',
				code: DOCS_NOT_READY
			});
		}
		await this.docsQueueService.enqueue(
			DOCS_JOB_CLASSIFY,
			this.processingService.snapshotOf(document, 'reindex'),
			// Always run — bypass deterministic-id coalescing against a retained job.
			{ jobId: `docs:classify:${document.id}:${Date.now()}` }
		);
		return document;
	}

	/**
	 * `GET /knowledge/status` — deployment/index capability probe (§8.3).
	 */
	public async getStatus(): Promise<IKnowledgeStatus> {
		const pgvector = DocumentVectorStoreRegistry.get(VECTOR_STORE_PGVECTOR);
		let vectorCapable = false;
		if (pgvector) {
			try {
				vectorCapable = await pgvector.isAvailable();
			} catch {
				vectorCapable = false;
			}
		}
		return {
			vectorCapable,
			embeddingProviderConfigured: this.docsAiService.embeddingProviderConfigured(),
			embeddingModel: getDocsConfig().embeddingModel
		};
	}

	/** FOLDER documents are never indexable (§2). */
	private assertIndexable(document: Document): void {
		if (document.kind === DocumentKindEnum.FOLDER) {
			throw new ConflictException({
				message: 'FOLDER documents cannot enter AI knowledge',
				code: DOCS_NOT_INDEXABLE
			});
		}
	}

	/** Request-path knowledge-status write with event emission. */
	private async setKnowledgeStatus(document: Document, next: DocumentKnowledgeStatusEnum): Promise<void> {
		const previous = document.knowledgeStatus;
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{ knowledgeStatus: next }
		);
		document.knowledgeStatus = next;
		this.documentService.emitDocumentEvent(document, 'updated', { phase: 'knowledge', previous, next });
	}
}
