/**
 * Public API Surface of @gauzy/plugin-docs
 */
export * from './lib/docs.plugin';
export * from './lib/docs.module';
export * from './lib/docs.config';
export * from './lib/docs.constants';

// Entities (exported for typing only — other plugins must not register them again)
export * from './lib/entities';

// Public services (available via DocsModule exports)
export { DocumentService } from './lib/services/document.service';
export { DocumentLinkService } from './lib/services/document-link.service';
export { DocumentUploadService } from './lib/services/document-upload.service';
export { DocumentProcessingService } from './lib/services/document-processing.service';
export { DocumentKnowledgeService } from './lib/services/document-knowledge.service';
export { DocumentReviewService } from './lib/services/document-review.service';
export { DocumentShareService } from './lib/services/document-share.service';
export { DocumentAccessService } from './lib/services/document-access.service';
export { DocumentQuotaService } from './lib/services/document-quota.service';

// Visibility + share composition (08 §3) — the pure truth-table predicates and their SQL
// mirror, exported so other surfaces can never re-derive a different rule.
export * from './lib/services/document-access.predicate';
export { buildShareGrantExistsSql, IShareScopeParameters } from './lib/services/document-access.sql';

// Organization storage-quota arithmetic (08 §5.7) — pure, unit-tested.
export * from './lib/services/quota.calculator';

// Events
export * from './lib/events/document.event';

// M4 consolidation: the legacy Organization-Documents / Help-Center import (types, pure
// mappers, service). Legacy tables are only ever read — provenance lives on the new side.
export * from './lib/legacy-import';

// Commands intended for cross-plugin dispatch
export { CreateDocumentCommand } from './lib/commands/create-document.command';
export { CreateDocumentLinkCommand } from './lib/commands/create-document-link.command';
export { UploadDocumentsCommand } from './lib/commands/upload-documents.command';

// AI-chat tool contribution (docs_search / docs_read) + the retrieval-service seam
export { DocsChatToolsService, DOCS_CHAT_TOOL_FACTORY_ID } from './lib/knowledge/chat-tools/docs-chat-tools.service';
export * from './lib/knowledge/chat-tools/docs-knowledge-search.types';
export {
	UNTRUSTED_CONTENT_NOTICE,
	fenceUntrustedContent,
	hardenUntrustedContent,
	stripPromptControlMarkers
} from './lib/knowledge/chat-tools/untrusted-content';

// AI-knowledge pipeline: retrieval, RRF, chunking, embedding, classification seams
export {
	DocumentKnowledgeSearchService,
	IKnowledgeSearchHit,
	IKnowledgeSearchInput,
	IKnowledgeSearchResult
} from './lib/knowledge/retrieval/retrieval.service';
export * from './lib/knowledge/retrieval/rrf';
export {
	applyRetrievalFilters,
	isBlockedByReviewCircuitBreaker,
	isRetrievable,
	IRetrievalGateDocument
} from './lib/knowledge/retrieval/retrieval-filters';
export * from './lib/knowledge/chunking/markdown-chunker';
export * from './lib/knowledge/chunking/token-counter';
export { EmbeddingService } from './lib/knowledge/embedding/embedding.service';
export { DocumentClassifierService } from './lib/knowledge/classification/document-classifier.service';
export {
	parseClassificationOutput,
	sampleMarkdown,
	buildClassificationPrompt
} from './lib/knowledge/classification/classification.prompt';
export { DocumentIndexService } from './lib/knowledge/indexing/document-index.service';
export { DocsAiService } from './lib/knowledge/ai/docs-ai.service';
export { DocsAiUsageEvent } from './lib/knowledge/ai/docs-ai-usage.event';
export * from './lib/knowledge/knowledge.constants';

// Vector-store provider seam — third parties register additional stores via
// `DocumentVectorStoreRegistry.register()`
export * from './lib/knowledge/vector-store/vector-store.interface';
export { DocumentVectorStoreRegistry } from './lib/knowledge/vector-store/vector-store.registry';
export { PgVectorStoreProvider } from './lib/knowledge/vector-store/providers/pgvector.provider';
export { LexicalStoreProvider } from './lib/knowledge/vector-store/providers/lexical.provider';

// Prompt-injection hardening helpers (shared untrusted-content fencing, §18.1)
export {
	UNTRUSTED_EXCERPT_NOTICE,
	breakClosingFence,
	fenceDocChunk,
	fenceDocumentContent,
	neutralizeUntrustedContent,
	stripChatTemplateMarkers
} from './lib/knowledge/security/untrusted-content';

// Queue constants, job payload types, and the enqueue seam
export * from './lib/knowledge/queue/constants';
export * from './lib/knowledge/queue/docs-job.types';
export { DocsQueueService } from './lib/knowledge/queue/docs-queue.service';
export { DocsRecoveryService } from './lib/knowledge/queue/docs-recovery.service';
// The single definition of every pipeline stage + the transport-neutral job surface both the
// BullMQ worker host and the inline runner dispatch through.
export { DocsPipelineService } from './lib/knowledge/queue/docs-pipeline.service';
export * from './lib/knowledge/queue/docs-pipeline.types';
export * from './lib/knowledge/queue/docs-recovery.predicate';

// Pipeline error classification
export * from './lib/knowledge/errors';

// Telemetry seam (07 §16): the swappable retrieval/AI-usage log. P1 ships the structured
// logger; P2 binds a table-backed implementation to the same `DOCS_RETRIEVAL_LOG` token.
export * from './lib/telemetry';

// Capture channels (07 §17): the importer contract + registry that integration plugins
// implement, the provider-agnostic inbound-email adapter seam with its reference
// implementation, and the AI-chat attachment subscriber.
export * from './lib/capture';

// Extraction provider registry — third parties add providers via
// `ExtractionRegistryService.register()`. Also carries the provider-vision OCR seam
// (scanned PDFs + images) and the shared PDF rasterizer.
export * from './lib/knowledge/extraction';

// Thumbnail generation (07 §4.4) — images + the first page of PDFs, written through the
// FileStorage provider onto `document.thumbKey`. Cosmetic by contract: it never changes
// `status` or `knowledgeStatus`.
export * from './lib/knowledge/thumbnail';

// Upload helpers (multi-file interceptor + decorator, magic-byte sniffing)
export * from './lib/interceptors';
export {
	sniffFile,
	isMarkupContent,
	isProbablyUtf8Text,
	canonicalExtension,
	ISniffResult,
	ISniffedType
} from './lib/services/file-sniffer';
