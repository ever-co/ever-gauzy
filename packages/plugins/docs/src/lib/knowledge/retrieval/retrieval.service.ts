import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { In } from 'typeorm';
import { ID, IDocumentChunkMetadata, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../../docs.config';
import { DEFAULT_DOCS_RETRIEVAL_TOPK } from '../../docs.constants';
import { TypeOrmDocumentCategoryRepository } from '../../repositories/type-orm-document-category.repository';
import { TypeOrmDocumentRepository } from '../../repositories/type-orm-document.repository';
import { DocumentAccessService } from '../../services/document-access.service';
import { DOCS_RETRIEVAL_LOG, IDocsRetrievalLog, IDocsRetrievalLogEvent } from '../../telemetry/retrieval-log.types';
import { EmbeddingService } from '../embedding/embedding.service';
import { DOCS_LEXICAL_CONFIDENCE_FLOOR, VECTOR_STORE_LEXICAL } from '../knowledge.constants';
import {
	IDocumentVectorStore,
	IVectorStoreHit,
	IVectorStoreQueryFilters
} from '../vector-store/vector-store.interface';
import { DocumentVectorStoreRegistry } from '../vector-store/vector-store.registry';
import { fuseRrf, RRF_CONFIDENCE_FLOOR } from './rrf';

/**
 * The caller-facing search input (validated by `KnowledgeSearchDTO` on the HTTP path).
 * The chat-tool surface additionally passes `categorySlugs` / `kind` (§11.2) — both are
 * normalized here so the tools and the endpoint share one execution path.
 */
export interface IKnowledgeSearchInput {
	query: string;
	topK?: number;
	documentIds?: ID[];
	categoryIds?: ID[];
	/** Chat-tool facet: category slugs resolved against the tenant catalog. */
	categorySlugs?: string[];
	tagIds?: ID[];
	kinds?: any[];
	/** Chat-tool facet: a single kind ('FILE' | 'PAGE'). */
	kind?: string;
	entity?: any;
	entityId?: ID;
	/** Retrieval-log consumer tag (§16, P2) — accepted and currently unused. */
	consumerKind?: 'knowledge-search' | 'chat-tool' | 'attach-picker';
}

/** One hit of the §9.5 response contract. */
export interface IKnowledgeSearchHit {
	chunkId: ID;
	documentId: ID;
	chunkIndex: number;
	score: number;
	content: string;
	locator: {
		headingPath: string[];
		page: number | null;
		sheet: string | null;
		charRange: { start: number; end: number } | null;
	};
	document: {
		id: ID;
		name: string;
		kind: string;
		summary: string | null;
		categories: Array<{ id: ID; slug: string; name: string }>;
		updatedAt: Date | string;
	};
}

/** The §9.5 response envelope. Zero hits is HTTP 200 — never an error. */
export interface IKnowledgeSearchResult {
	hits: IKnowledgeSearchHit[];
	lowConfidence: boolean;
	degraded: 'none' | 'lexical-only';
}

/**
 * Hybrid lexical + vector retrieval with Reciprocal Rank Fusion (§9).
 *
 * Runs on the HTTP request path (knowledge-search endpoint and the AI-chat tools), so the
 * tenant/organization/user scope comes from `RequestContext`. Both legs are oversampled at
 * `topK * 2` and share the identical mandatory SQL filter set (`retrieval-filters.ts`).
 *
 * The service NEVER fails a request over AI availability: the vector leg is skipped when
 * pgvector is absent, no embedding provider resolves, or the query-embed call fails —
 * the response degrades to `lexical-only` (§10).
 */
@Injectable()
export class DocumentKnowledgeSearchService {
	private readonly logger = new Logger(DocumentKnowledgeSearchService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly typeOrmDocumentCategoryRepository: TypeOrmDocumentCategoryRepository,
		private readonly embeddingService: EmbeddingService,
		private readonly documentAccessService: DocumentAccessService,
		/**
		 * Telemetry sink (§16) — optional by design so the retrieval path works with the
		 * token unbound, and swappable for the P2 table-backed implementation.
		 */
		@Optional()
		@Inject(DOCS_RETRIEVAL_LOG)
		private readonly retrievalLog?: IDocsRetrievalLog
	) {}

	/**
	 * Runs one knowledge search for the requesting user.
	 */
	public async search(input: IKnowledgeSearchInput): Promise<IKnowledgeSearchResult> {
		const startedAt = Date.now();
		const tenantId = RequestContext.currentTenantId() as ID;
		const organizationId = (RequestContext.currentOrganizationId() ?? (input as any).organizationId) as ID;
		const userId = RequestContext.currentUserId() as ID;
		// The share overlay is employee/team scoped (08 §3.3) — without it, PRIVATE documents
		// shared with the requester would be invisible to retrieval but visible in the list.
		const employeeId = this.documentAccessService.currentEmployeeId() ?? undefined;
		const hasManagePermission = RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE);
		const consumerKind = input.consumerKind ?? 'knowledge-search';

		const config = getDocsConfig();
		const topK = Math.min(Math.max(input.topK ?? DEFAULT_DOCS_RETRIEVAL_TOPK, 1), config.retrievalTopKMax);
		const oversample = topK * 2;

		// Chat-tool facets (§11.2): slugs → catalog ids; single kind → kinds array.
		let categoryIds = input.categoryIds;
		if (!categoryIds?.length && input.categorySlugs?.length) {
			const categories = await this.typeOrmDocumentCategoryRepository.find({
				where: { tenantId, organizationId, slug: In(input.categorySlugs) }
			});
			categoryIds = categories.map((category) => category.id);
			if (!categoryIds.length) {
				// Unknown slugs would silently widen the search — return the honest empty set.
				this.logRetrieval({
					tenantId,
					organizationId,
					consumerKind,
					queryLength: input.query?.length ?? 0,
					resultCount: 0,
					documentCount: 0,
					latencyMs: Date.now() - startedAt,
					mode: 'lexical-only',
					topScore: null,
					lowConfidence: true,
					storeId: null
				});
				return { hits: [], lowConfidence: true, degraded: 'lexical-only' };
			}
		}
		const kinds = input.kinds?.length ? input.kinds : input.kind ? [input.kind] : undefined;

		const filters: IVectorStoreQueryFilters = {
			userId,
			employeeId,
			hasManagePermission,
			documentIds: input.documentIds,
			categoryIds,
			tagIds: input.tagIds,
			kinds,
			entity: input.entity,
			entityId: input.entityId
		};

		const scope = { tenantId, organizationId, filters };

		// Resolve the active store once per request.
		const store = await DocumentVectorStoreRegistry.resolve();
		const lexicalStore = DocumentVectorStoreRegistry.get(VECTOR_STORE_LEXICAL) ?? store;

		// Lexical leg — always runs (the floor of the ladder).
		const lexicalHits = lexicalStore
			? await this.safeQuery(lexicalStore, { ...scope, text: input.query, topK: oversample })
			: [];

		// Vector leg — best-effort.
		let vectorHits: IVectorStoreHit[] = [];
		let vectorLegRan = false;
		if (store && store.id !== VECTOR_STORE_LEXICAL && config.aiEnabled) {
			const resolved = await this.embeddingService.resolve(tenantId);
			if (resolved) {
				const embedding = await this.embeddingService.embedQuery(resolved, input.query, {
					tenantId,
					organizationId
				});
				if (embedding) {
					vectorHits = await this.safeQuery(store, { ...scope, embedding, topK: oversample });
					vectorLegRan = true;
				}
			}
		}

		const degraded: 'none' | 'lexical-only' = vectorLegRan ? 'none' : 'lexical-only';

		// RRF fusion (k = 60), deduped by chunk id, truncated to topK.
		const fused = fuseRrf(
			vectorLegRan ? [lexicalHits as any[], vectorHits as any[]] : [lexicalHits as any[]],
			topK
		);

		if (!fused.length) {
			// A zero-result search is the knowledge-gap signal — the ONLY place it is captured.
			this.logRetrieval({
				tenantId,
				organizationId,
				consumerKind,
				queryLength: input.query?.length ?? 0,
				resultCount: 0,
				documentCount: 0,
				latencyMs: Date.now() - startedAt,
				mode: vectorLegRan ? 'hybrid' : 'lexical-only',
				topScore: null,
				lowConfidence: true,
				storeId: vectorLegRan ? store?.id ?? null : lexicalStore?.id ?? null
			});
			return { hits: [], lowConfidence: true, degraded };
		}

		// Low-confidence caveat: RRF floor in hybrid mode; matched-fraction floor when
		// degraded to lexical-only (§9.4).
		const lowConfidence = vectorLegRan
			? fused[0].score < RRF_CONFIDENCE_FLOOR
			: Math.max(...lexicalHits.map((hit) => hit.score), 0) < DOCS_LEXICAL_CONFIDENCE_FLOOR;

		const hits = await this.hydrateHits(fused.map((entry) => ({ ...(entry.hit as IVectorStoreHit), score: entry.score })));

		this.logRetrieval({
			tenantId,
			organizationId,
			consumerKind,
			queryLength: input.query?.length ?? 0,
			resultCount: hits.length,
			documentCount: new Set(hits.map((hit) => hit.documentId)).size,
			latencyMs: Date.now() - startedAt,
			mode: vectorLegRan ? 'hybrid' : 'lexical-only',
			topScore: hits.length ? hits[0].score : null,
			lowConfidence,
			storeId: vectorLegRan ? store?.id ?? null : lexicalStore?.id ?? null
		});

		return { hits, lowConfidence, degraded };
	}

	/**
	 * Hands one retrieval event to the telemetry sink. Fire-and-forget by contract —
	 * telemetry must never slow or fail a search, so the call is fully guarded here on top
	 * of the sink's own guards.
	 *
	 * @param event The content-free retrieval event.
	 */
	private logRetrieval(event: IDocsRetrievalLogEvent): void {
		try {
			this.retrievalLog?.recordRetrieval(event);
		} catch (error) {
			this.logger.debug(`Retrieval telemetry failed: ${(error as Error).message}`);
		}
	}

	/**
	 * Loads the nested document metadata (name, kind, summary, categories, updatedAt) for
	 * the fused hit set and shapes the §9.5 response objects.
	 */
	private async hydrateHits(hits: Array<IVectorStoreHit & { score: number }>): Promise<IKnowledgeSearchHit[]> {
		const documentIds = [...new Set(hits.map((hit) => hit.documentId))];
		const documents = await this.typeOrmDocumentRepository.find({
			where: { id: In(documentIds) },
			relations: { categories: true }
		});
		const byId = new Map(documents.map((document) => [document.id, document]));

		return hits
			.filter((hit) => byId.has(hit.documentId))
			.map((hit) => {
				const document = byId.get(hit.documentId)!;
				const metadata: IDocumentChunkMetadata | undefined = hit.metadata;
				return {
					chunkId: hit.chunkId,
					documentId: hit.documentId,
					chunkIndex: hit.chunkIndex,
					score: hit.score,
					content: hit.content,
					locator: {
						headingPath: metadata?.headingPath ?? [],
						page: metadata?.page ?? null,
						sheet: metadata?.sheet ?? null,
						charRange: metadata?.charRange ?? null
					},
					document: {
						id: document.id,
						name: document.name,
						kind: document.kind,
						summary: document.summary ?? null,
						categories: (document.categories ?? []).map((category) => ({
							id: category.id,
							slug: category.slug,
							name: category.name
						})),
						updatedAt: document.updatedAt
					}
				};
			});
	}

	/**
	 * One leg query that can never fail the request — a broken leg logs and contributes
	 * nothing.
	 */
	private async safeQuery(
		store: IDocumentVectorStore,
		query: Parameters<IDocumentVectorStore['query']>[0]
	): Promise<IVectorStoreHit[]> {
		try {
			return await store.query(query);
		} catch (error) {
			this.logger.warn(`Vector store '${store.id}' query failed: ${(error as Error).message}`);
			return [];
		}
	}
}
