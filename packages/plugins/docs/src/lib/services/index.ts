import { DocsFeatureService } from './docs-feature.service';
import { DocumentService } from './document.service';
import { DocumentAccessService } from './document-access.service';
import { DocumentCommentAccessPolicy } from './document-comment-access.policy';
import { DocumentCategoryService } from './document-category.service';
import { DocumentCollaborationService } from './document-collaboration.service';
import { DocumentCommentAnchorService } from './document-comment-anchor.service';
import { DocumentMarkdownService } from './document-markdown.service';
import { DocumentKnowledgeService } from './document-knowledge.service';
import { DocumentLinkService } from './document-link.service';
import { DocumentLiveBridge } from './document-live.bridge';
import { DocumentNotifierService } from './document-notifier.service';
import { DocumentPathService } from './document-path.service';
import { DocumentProcessingService } from './document-processing.service';
import { DocumentQuotaService } from './document-quota.service';
import { DocumentReviewService } from './document-review.service';
import { DocumentSettingsService } from './document-settings.service';
import { DocumentShareService } from './document-share.service';
import { DocumentStatsService } from './document-stats.service';
import { DocumentTreeService } from './document-tree.service';
import { DocumentUploadService } from './document-upload.service';
import { DocumentVersionService } from './document-version.service';

export * from './docs-feature.service';
export * from './document.service';
export * from './document-access.predicate';
export * from './document-access.service';
export * from './document-comment-access.policy';
export * from './document-access.sql';
export * from './document-category.service';
export * from './document-comment-anchor';
export * from './document-comment-anchor.service';
export * from './document-search-snippet';
export * from './document-knowledge.service';
export * from './document-link.service';
export * from './document-path.service';
export * from './document-processing.service';
export * from './document-quota.service';
export * from './document-review.service';
export * from './document-settings.service';
export * from './document-share.service';
export * from './document-stats.service';
export * from './document-tree.service';
export * from './document-upload.service';
export * from './document-version.service';
export * from './document-live.bridge';
export * from './file-sniffer';
export * from './quota.calculator';

/**
 * Every domain service provider of the Documents plugin.
 *
 * `DocumentAccessService` is declared first: it owns the visibility + share composition
 * that `DocumentService` (and through it, everything else) depends on.
 */
export const Services = [
	// The seam the live editing sessions fill in when `GAUZY_DOCS_LIVE_ENABLED=true` (a no-op otherwise).
	DocumentLiveBridge,
	DocsFeatureService,
	DocumentAccessService,
	// Governs the comments of a page (`entity: Document`): found by the comment API at boot.
	DocumentCommentAccessPolicy,
	DocumentQuotaService,
	DocumentService,
	DocumentPathService,
	DocumentTreeService,
	DocumentCategoryService,
	DocumentVersionService,
	DocumentLinkService,
	DocumentCommentAnchorService,
	DocumentShareService,
	DocumentSettingsService,
	DocumentStatsService,
	DocumentProcessingService,
	DocumentUploadService,
	DocumentKnowledgeService,
	DocumentReviewService,
	DocumentNotifierService,
	DocumentCollaborationService,
	DocumentMarkdownService
];
export { DocumentCollaborationService } from './document-collaboration.service';
export { DocumentMarkdownService } from './document-markdown.service';
export * from './document-markdown';
export { DocumentNotifierService } from './document-notifier.service';
