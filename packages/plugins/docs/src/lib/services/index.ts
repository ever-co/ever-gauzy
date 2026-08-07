import { DocumentService } from './document.service';
import { DocumentAccessService } from './document-access.service';
import { DocumentCategoryService } from './document-category.service';
import { DocumentKnowledgeService } from './document-knowledge.service';
import { DocumentLinkService } from './document-link.service';
import { DocumentProcessingService } from './document-processing.service';
import { DocumentQuotaService } from './document-quota.service';
import { DocumentReviewService } from './document-review.service';
import { DocumentSettingsService } from './document-settings.service';
import { DocumentShareService } from './document-share.service';
import { DocumentTreeService } from './document-tree.service';
import { DocumentUploadService } from './document-upload.service';
import { DocumentVersionService } from './document-version.service';

export * from './document.service';
export * from './document-access.predicate';
export * from './document-access.service';
export * from './document-access.sql';
export * from './document-category.service';
export * from './document-knowledge.service';
export * from './document-link.service';
export * from './document-processing.service';
export * from './document-quota.service';
export * from './document-review.service';
export * from './document-settings.service';
export * from './document-share.service';
export * from './document-tree.service';
export * from './document-upload.service';
export * from './document-version.service';
export * from './file-sniffer';
export * from './quota.calculator';

/**
 * Every domain service provider of the Documents plugin.
 *
 * `DocumentAccessService` is declared first: it owns the visibility + share composition
 * that `DocumentService` (and through it, everything else) depends on.
 */
export const Services = [
	DocumentAccessService,
	DocumentQuotaService,
	DocumentService,
	DocumentTreeService,
	DocumentCategoryService,
	DocumentVersionService,
	DocumentLinkService,
	DocumentShareService,
	DocumentSettingsService,
	DocumentProcessingService,
	DocumentUploadService,
	DocumentKnowledgeService,
	DocumentReviewService
];
