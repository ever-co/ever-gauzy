import { BaseEntityEnum, DocumentKindEnum, ID, IDocumentChunkMetadata } from '@gauzy/contracts';

/**
 * The vector-store provider seam of the Documents knowledge subsystem.
 *
 * The plugin ships two providers — `pgvector` (PostgreSQL + pgvector, raw SQL) and
 * `lexical` (ILIKE / websearch_to_tsquery over the GIN index; always available) — and
 * third-party stores can register additional providers via the exported
 * `DocumentVectorStoreRegistry`.
 */

/** Tenant/organization scope every store operation is hard-filtered by. */
export interface IVectorStoreScope {
	tenantId: ID;
	organizationId: ID;
}

/** One chunk handed to `upsertChunks` (already persisted as a `document_chunk` row). */
export interface IVectorStoreChunk {
	/** The `document_chunk` row id. */
	chunkId: ID;
	chunkIndex: number;
	content: string;
	/** Present on the embedded path; absent on lexical-only ingestion. */
	embedding?: number[];
}

/**
 * Optional facet filters of one retrieval query. The mandatory filter set (tenant + org,
 * INDEXED, not archived/deleted, not EXCLUDED, searchable, review circuit breaker,
 * visibility) is applied by every provider through the shared filter builder — these are
 * the caller-supplied narrowing filters only.
 */
export interface IVectorStoreQueryFilters {
	/** Requesting user id (visibility scope). */
	userId?: ID;
	/** True when the caller holds `DOCS_MANAGE` (sees PRIVATE documents). */
	hasManagePermission?: boolean;
	/** Restriction to specific documents (≤ 20). */
	documentIds?: ID[];
	categoryIds?: ID[];
	tagIds?: ID[];
	kinds?: DocumentKindEnum[];
	/** Both or neither with `entityId` — restrict via `document_link`. */
	entity?: BaseEntityEnum;
	entityId?: ID;
}

/** One retrieval query against a store. */
export interface IVectorStoreQuery extends IVectorStoreScope {
	/** The embedded query vector (vector-capable stores). */
	embedding?: number[];
	/** The raw query text (lexical stores). */
	text?: string;
	/** Maximum hits to return (already oversampled by the caller). */
	topK: number;
	filters?: IVectorStoreQueryFilters;
}

/** One scored hit. `score` is normalized into [0, 1] by every provider. */
export interface IVectorStoreHit {
	chunkId: ID;
	documentId: ID;
	chunkIndex: number;
	content: string;
	metadata?: IDocumentChunkMetadata;
	/** Similarity/relevance in [0, 1]. */
	score: number;
}

/**
 * A pluggable vector/lexical store.
 */
export interface IDocumentVectorStore {
	/** Stable provider id (`pgvector`, `lexical`, third-party ids). */
	readonly id: string;

	/**
	 * Whether this store can serve queries in the current deployment (extension present,
	 * external service reachable, …). Consulted at resolution time; implementations should
	 * cache their probe.
	 */
	isAvailable(): Promise<boolean>;

	/**
	 * Writes/updates the vector projection of one document's chunks. Called by the embed
	 * stage as batches return; implementations must be idempotent per chunk.
	 */
	upsertChunks(scope: IVectorStoreScope, documentId: ID, chunks: IVectorStoreChunk[]): Promise<void>;

	/**
	 * Removes one document's entries from the store (knowledge exclude / delete).
	 * The `document_chunk` rows themselves are owned by the index service.
	 */
	deleteByDocument(scope: IVectorStoreScope, documentId: ID): Promise<void>;

	/**
	 * Runs one scored retrieval query under the mandatory + optional filters.
	 */
	query(query: IVectorStoreQuery): Promise<IVectorStoreHit[]>;
}
