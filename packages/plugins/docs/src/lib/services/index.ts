import { DocumentService } from './document.service';
import { DocumentCategoryService } from './document-category.service';
import { DocumentKnowledgeService } from './document-knowledge.service';
import { DocumentLinkService } from './document-link.service';
import { DocumentProcessingService } from './document-processing.service';
import { DocumentReviewService } from './document-review.service';
import { DocumentSettingsService } from './document-settings.service';
import { DocumentTreeService } from './document-tree.service';
import { DocumentUploadService } from './document-upload.service';
import { DocumentVersionService } from './document-version.service';

export * from './document.service';
export * from './document-category.service';
export * from './document-knowledge.service';
export * from './document-link.service';
export * from './document-processing.service';
export * from './document-review.service';
export * from './document-settings.service';
export * from './document-tree.service';
export * from './document-upload.service';
export * from './document-version.service';
export * from './file-sniffer';

/**
 * Every domain service provider of the Documents plugin. The share services slot into
 * this array with their milestone.
 */
export const Services = [
	DocumentService,
	DocumentTreeService,
	DocumentCategoryService,
	DocumentVersionService,
	DocumentLinkService,
	DocumentSettingsService,
	DocumentProcessingService,
	DocumentUploadService,
	DocumentKnowledgeService,
	DocumentReviewService
];
