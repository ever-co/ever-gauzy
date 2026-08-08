import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DocumentKnowledgeStatusEnum, ID } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { getDocsConfig } from '../../docs.config';
import { DocumentChunk } from '../../entities/document-chunk.entity';
import { DocumentIndexState } from '../../entities/document-index-state.entity';
import { Document } from '../../entities/document.entity';
import { TypeOrmDocumentChunkRepository } from '../../repositories/type-orm-document-chunk.repository';
import { TypeOrmDocumentIndexStateRepository } from '../../repositories/type-orm-document-index-state.repository';
import { TypeOrmDocumentRepository } from '../../repositories/type-orm-document.repository';
import { chunkMarkdown, IChunkingResult } from '../chunking/markdown-chunker';
import { EmbeddingService } from '../embedding/embedding.service';
import { DocsPermanentError, DocsTransientError } from '../errors';
import {
	LEXICAL_ONLY_EMBEDDING_DIMS,
	LEXICAL_ONLY_EMBEDDING_MODEL,
	VECTOR_STORE_LEXICAL
} from '../knowledge.constants';
import { IDocsChunkJob, IDocsEmbedJob, IDocsIndexJob } from '../queue/docs-job.types';
import { DocumentVectorStoreRegistry } from '../vector-store/vector-store.registry';
import { IVectorStoreScope } from '../vector-store/vector-store.interface';
import { renderKnowledgeMarkdown } from './page-markdown.renderer';

/** Chunk-stage result the worker branches on. */
export interface IChunkStageResult {
	outcome: 'chunked' | 'skipped-unchanged';
	contentHash: string;
}

/** Embed-stage result carried into the index job payload. */
export interface IEmbedStageResult {
	embeddingModel: string | null;
	embeddingDims: number | null;
}

/**
 * The knowledge indexing engine (§6/§8 of the AI-knowledge spec): chunk replacement,
 * embedding writes through the vector-store seam, `document_index_state` bookkeeping, and
 * the `contentHash` skip-if-unchanged short-circuit.
 *
 * Worker-safe by construction: every query carries the explicit tenant/organization
 * snapshot of the job payload; `RequestContext` is never consulted.
 *
 * Stage layout (restart-safe because the chunker is deterministic):
 * - **chunk** — transactionally replaces the chunk set (embeddings NULL) and moves the
 *   document to `INDEXING`. Retrieval only ever surfaces `INDEXED` documents, so no
 *   partially-replaced set is ever visible.
 * - **embed** — resolves provider + store; batches `embedMany`; writes vectors through
 *   `IDocumentVectorStore.upsertChunks` as batches return. No provider / lexical store ⇒
 *   skipped entirely (lexical-only ingestion).
 * - **index** — verifies embedding completeness, upserts `document_index_state`, records
 *   `metadata.indexing`, flips `knowledgeStatus: INDEXED`.
 */
@Injectable()
export class DocumentIndexService {
	private readonly logger = new Logger(DocumentIndexService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly typeOrmDocumentChunkRepository: TypeOrmDocumentChunkRepository,
		private readonly typeOrmDocumentIndexStateRepository: TypeOrmDocumentIndexStateRepository,
		private readonly embeddingService: EmbeddingService
	) {}

	/** SHA-256 hex digest of the normalized markdown that gets chunked. */
	public contentHashOf(markdown: string): string {
		return createHash('sha256').update(markdown, 'utf8').digest('hex');
	}

	/**
	 * The embedding model this deployment would index with right now: the configured model
	 * when a provider resolves AND the active store accepts vectors, else the lexical
	 * sentinel. Drives both the skip-if-unchanged check and the model-drift sweep.
	 */
	public async expectedEmbeddingModel(tenantId: ID): Promise<string> {
		const store = await DocumentVectorStoreRegistry.resolve();
		if (!store || store.id === VECTOR_STORE_LEXICAL) {
			return LEXICAL_ONLY_EMBEDDING_MODEL;
		}
		const resolved = await this.embeddingService.resolve(tenantId);
		return resolved ? resolved.modelId : LEXICAL_ONLY_EMBEDDING_MODEL;
	}

	/**
	 * `docs.chunk` stage: resolves the knowledge markdown, short-circuits on an unchanged
	 * `contentHash` + embedding model, else transactionally replaces the chunk set.
	 */
	public async runChunkStage(document: Document, job: IDocsChunkJob): Promise<IChunkStageResult> {
		const markdown = renderKnowledgeMarkdown(document);
		if (!markdown) {
			throw new DocsPermanentError('The document has no extractable content to index.');
		}

		const contentHash = this.contentHashOf(markdown);
		const expectedModel = await this.expectedEmbeddingModel(job.tenantId);

		// §8.2 skip-if-unchanged: same content, same model ⇒ zero AI spend.
		if (!job.force) {
			const state = await this.typeOrmDocumentIndexStateRepository.findOne({
				where: { documentId: document.id, tenantId: job.tenantId, organizationId: job.organizationId }
			});
			if (state && state.contentHash === contentHash && state.embeddingModel === expectedModel) {
				await this.setKnowledgeStatus(document, DocumentKnowledgeStatusEnum.INDEXED);
				this.logger.debug(
					`docs.chunk short-circuit for document ${document.id} — content and model unchanged`
				);
				return { outcome: 'skipped-unchanged', contentHash };
			}
		}

		await this.setKnowledgeStatus(document, DocumentKnowledgeStatusEnum.INDEXING);

		const config = getDocsConfig();
		const result: IChunkingResult = chunkMarkdown(markdown, {
			chunkTokens: config.chunkTokens,
			overlapTokens: config.chunkOverlapTokens
		});

		// Transactional wholesale replace (embeddings NULL until the embed stage).
		await this.typeOrmDocumentChunkRepository.manager.transaction(async (manager) => {
			await manager.delete(DocumentChunk, {
				tenantId: job.tenantId,
				organizationId: job.organizationId,
				documentId: document.id
			});
			const rows = result.chunks.map((chunk) => ({
				tenantId: job.tenantId,
				organizationId: job.organizationId,
				documentId: document.id,
				chunkIndex: chunk.chunkIndex,
				content: chunk.content,
				tokenCount: chunk.tokenCount,
				metadata: chunk.metadata,
				embedding: null as any
			}));
			// Bounded batches keep the parameter count under every dialect's limit.
			const repository = manager.getRepository(DocumentChunk);
			for (let offset = 0; offset < rows.length; offset += 100) {
				await repository.insert(rows.slice(offset, offset + 100) as any);
			}
		});

		// The token counter used is recorded per run so drift is diagnosable (§6).
		await this.mergeIndexingMetadata(document, { tokenCounter: result.tokenCounter });

		this.logger.log(
			`docs.chunk wrote ${result.chunks.length} chunks for document ${document.id} (hash ${contentHash.slice(0, 12)}…)`
		);
		return { outcome: 'chunked', contentHash };
	}

	/**
	 * `docs.embed` stage: provider-resolved batched embedding written through the active
	 * vector store. Lexical-only conditions (AI disabled, no provider, lexical store) skip
	 * cleanly with `embeddingModel: null`.
	 */
	public async runEmbedStage(document: Document, job: IDocsEmbedJob): Promise<IEmbedStageResult> {
		const config = getDocsConfig();
		const scope: IVectorStoreScope = { tenantId: job.tenantId, organizationId: job.organizationId };

		if (!config.aiEnabled) {
			this.logger.debug(`docs.embed skipped for document ${document.id} — AI is disabled (lexical-only)`);
			return { embeddingModel: null, embeddingDims: null };
		}

		const store = await DocumentVectorStoreRegistry.resolve();
		if (!store || store.id === VECTOR_STORE_LEXICAL) {
			this.logger.debug(`docs.embed skipped for document ${document.id} — no vector-capable store`);
			return { embeddingModel: null, embeddingDims: null };
		}

		const resolved = await this.embeddingService.resolve(job.tenantId);
		if (!resolved) {
			this.logger.debug(`docs.embed skipped for document ${document.id} — no embedding provider resolves`);
			return { embeddingModel: null, embeddingDims: null };
		}

		const chunks = await this.typeOrmDocumentChunkRepository.find({
			where: { tenantId: job.tenantId, organizationId: job.organizationId, documentId: document.id },
			order: { chunkIndex: 'ASC' }
		});
		if (!chunks.length) {
			return { embeddingModel: null, embeddingDims: null };
		}

		const batchSize = Math.min(Math.max(config.embedBatchSize, 1), 64);
		for (let offset = 0; offset < chunks.length; offset += batchSize) {
			const batch = chunks.slice(offset, offset + batchSize);
			const embeddings = await this.embeddingService.embedBatch(
				resolved,
				batch.map((chunk) => chunk.content),
				scope
			);
			// Vectors land chunk-by-chunk as batches return (§7.3) — a poisoned later batch
			// never loses the batches already written.
			await store.upsertChunks(
				scope,
				document.id,
				batch.map((chunk, index) => ({
					chunkId: chunk.id,
					chunkIndex: chunk.chunkIndex,
					content: chunk.content,
					embedding: embeddings[index]
				}))
			);
		}

		return { embeddingModel: resolved.modelId, embeddingDims: resolved.dims };
	}

	/**
	 * `docs.index` stage: completeness verification, `document_index_state` upsert, and
	 * the `INDEXED` flip.
	 */
	public async runIndexStage(document: Document, job: IDocsIndexJob): Promise<void> {
		const scope = { tenantId: job.tenantId, organizationId: job.organizationId };
		const chunkCount = await this.typeOrmDocumentChunkRepository.count({
			where: { ...scope, documentId: document.id }
		});

		const embeddingModel = job.embeddingModel ?? LEXICAL_ONLY_EMBEDDING_MODEL;
		const embeddingDims = job.embeddingDims ?? LEXICAL_ONLY_EMBEDDING_DIMS;

		// Verify completeness before flipping to INDEXED (§7.3): every chunk of an embedded
		// run must carry a vector. A gap means a crash between stages — transient; the
		// recovery scan re-runs from `docs.chunk`.
		if (job.embeddingModel) {
			const missing = await this.typeOrmDocumentChunkRepository.count({
				where: { ...scope, documentId: document.id, embedding: IsNull() }
			});
			if (missing > 0) {
				throw new DocsTransientError(
					`Document ${document.id} has ${missing}/${chunkCount} chunks without embeddings — re-run embed.`
				);
			}
		}

		// Upsert the single bookkeeping row per document.
		const existing = await this.typeOrmDocumentIndexStateRepository.findOne({
			where: { ...scope, documentId: document.id }
		});
		if (existing) {
			await this.typeOrmDocumentIndexStateRepository.update(
				{ id: existing.id, ...scope },
				{
					embeddingModel,
					embeddingDims,
					chunkCount,
					lastIndexedAt: new Date(),
					contentHash: job.contentHash
				}
			);
		} else {
			await this.typeOrmDocumentIndexStateRepository.insert({
				...scope,
				documentId: document.id,
				embeddingModel,
				embeddingDims,
				chunkCount,
				lastIndexedAt: new Date(),
				contentHash: job.contentHash
			} as any);
		}

		// The lexical-only marker lives in the index metadata (+ the sentinel model above).
		await this.mergeIndexingMetadata(document, {
			embeddingModel: job.embeddingModel,
			lexicalOnly: !job.embeddingModel,
			indexedAt: new Date().toISOString()
		});

		await this.setKnowledgeStatus(document, DocumentKnowledgeStatusEnum.INDEXED);
		this.logger.log(
			`docs.index completed for document ${document.id}: ${chunkCount} chunks, model=${embeddingModel}`
		);
	}

	/**
	 * Removes one document's knowledge projection (chunks + index state) in one
	 * transaction — the exclude/reject cleanup. Idempotent.
	 */
	public async removeKnowledgeProjection(scope: IVectorStoreScope, documentId: ID): Promise<void> {
		await this.typeOrmDocumentChunkRepository.manager.transaction(async (manager) => {
			await manager.delete(DocumentChunk, { ...scope, documentId });
			await manager.delete(DocumentIndexState, { ...scope, documentId });
		});
	}

	/**
	 * Documents of one tenant/org whose index state mismatches the expected embedding
	 * model (the §8.4 drift set). Includes lexical-only (`sentinel`) rows once a provider
	 * appears, and vice versa.
	 */
	public async findModelDriftDocumentIds(scope: IVectorStoreScope, expectedModel: string): Promise<ID[]> {
		const rows = await this.typeOrmDocumentIndexStateRepository
			.createQueryBuilder('state')
			.select('state.documentId', 'documentId')
			.where('state.tenantId = :tenantId', { tenantId: scope.tenantId })
			.andWhere('state.organizationId = :organizationId', { organizationId: scope.organizationId })
			.andWhere('state.embeddingModel != :expectedModel', { expectedModel })
			.getRawMany();
		return rows.map((row: any) => row.documentId);
	}

	/**
	 * Worker-safe knowledge-status write (mirrors `DocumentProcessingService` semantics
	 * without the request-path coupling).
	 */
	private async setKnowledgeStatus(document: Document, next: DocumentKnowledgeStatusEnum): Promise<void> {
		if (document.knowledgeStatus === next) {
			return;
		}
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{ knowledgeStatus: next }
		);
		document.knowledgeStatus = next;
	}

	/**
	 * Merges keys into `document.metadata.indexing` (sqlite-aware serialization — `update`
	 * bypasses the entity subscribers).
	 */
	private async mergeIndexingMetadata(document: Document, patch: Record<string, unknown>): Promise<void> {
		const existing = (document.metadata && typeof document.metadata === 'object' ? document.metadata : {}) as any;
		const metadata = { ...existing, indexing: { ...(existing.indexing ?? {}), ...patch } };
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{ metadata: isSqlite() || isBetterSqlite3() ? (JSON.stringify(metadata) as any) : metadata } as any
		);
		document.metadata = metadata;
	}
}
