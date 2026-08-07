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

// Events
export * from './lib/events/document.event';

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
export * from './lib/knowledge/queue/docs-recovery.predicate';

// Pipeline error classification
export * from './lib/knowledge/errors';

// Extraction provider registry — third parties add providers via
// `ExtractionRegistryService.register()`
export * from './lib/knowledge/extraction';

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
