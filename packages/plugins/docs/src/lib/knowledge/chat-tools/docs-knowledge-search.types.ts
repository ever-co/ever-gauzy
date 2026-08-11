import { ID } from '@gauzy/contracts';

/**
 * Minimal local contract for the Documents knowledge retrieval service
 * (spec `07-ai-knowledge.md` §9 — file `knowledge/retrieval/retrieval.service.ts`,
 * class `DocumentKnowledgeSearchService`), typed against the §9.5 response contract.
 *
 * The chat tools depend on the retrieval service ONLY through this interface plus the
 * {@link DOCS_KNOWLEDGE_SEARCH_SERVICE} optional injection token, so this folder never
 * imports the implementation and degrades gracefully in a process that does not provide it.
 *
 * `DocumentKnowledgeSearchService` has landed and IS bound — `docs.module.ts` provides
 * `{ provide: DOCS_KNOWLEDGE_SEARCH_SERVICE, useExisting: DocumentKnowledgeSearchService }`.
 * Keep that binding in place: because the injection is `@Optional()`, dropping it does not
 * fail at boot — the chat tools would silently answer with no results instead.
 */

/** Optional-injection token under which the retrieval service is bound. */
export const DOCS_KNOWLEDGE_SEARCH_SERVICE = 'DOCS_KNOWLEDGE_SEARCH_SERVICE';

/** Where a hit sits inside its document (citation locator, §9.5). */
export interface IDocsKnowledgeSearchLocator {
	/** Heading breadcrumb ending at the chunk's own heading. */
	headingPath?: string[];
	/** 1-based page number (paged formats such as PDF). */
	page?: number | null;
	/** Sheet name (spreadsheets). */
	sheet?: string | null;
	/** Character range inside the normalized extracted text. */
	charRange?: { start: number; end: number } | null;
}

/** Compact document header attached to each hit (§9.5). */
export interface IDocsKnowledgeSearchHitDocument {
	id: ID;
	name: string;
	kind: string;
	summary?: string | null;
	categories?: { id: ID; slug: string; name: string }[];
	updatedAt?: Date | string;
}

/** One fused retrieval hit (§9.5). */
export interface IDocsKnowledgeSearchHit {
	chunkId: ID;
	documentId: ID;
	chunkIndex: number;
	/** Fused RRF score (or lexical rank score in degraded mode). */
	score: number;
	/** The chunk text — UNTRUSTED document content; must be fenced before reaching a prompt. */
	content: string;
	locator?: IDocsKnowledgeSearchLocator | null;
	document?: IDocsKnowledgeSearchHitDocument | null;
}

/** Search input accepted by the retrieval service (§9.1 / §11.2 facets). */
export interface IDocsKnowledgeSearchInput {
	query: string;
	/** Fused result count (default 6 for chat tools; service clamps its own bounds). */
	topK?: number;
	/** Restrict to specific documents. */
	documentIds?: ID[];
	/** Restrict to category slugs. */
	categorySlugs?: string[];
	/** Restrict to a document kind ('FILE' | 'PAGE'). */
	kind?: string;
	/** Retrieval-log consumer tag (§16): the chat tools pass 'chat-tool'. */
	consumerKind?: 'knowledge-search' | 'chat-tool' | 'attach-picker';
}

/** §9.5 response contract. Zero hits is a valid answer, never an error. */
export interface IDocsKnowledgeSearchResponse {
	hits: IDocsKnowledgeSearchHit[];
	lowConfidence: boolean;
	degraded: 'none' | 'lexical-only';
}

/**
 * The retrieval-service surface the chat tools call.
 *
 * Executes in the REQUESTING USER's request scope — tenant/organization scoping, the
 * §9.2 mandatory filter set, and the visibility predicate are the service's job, by
 * construction (no service-account bypass path, spec 08 §7.2).
 */
export interface IDocsKnowledgeSearchService {
	search(input: IDocsKnowledgeSearchInput): Promise<IDocsKnowledgeSearchResponse>;
}
