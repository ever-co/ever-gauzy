import { DocumentController } from './document.controller';
import { DocumentImportController } from './document-import.controller';
import { DocumentPdfController } from './document-pdf.controller';
import { DocumentCategoryController } from './document-category.controller';
import { DocumentKnowledgeController } from './document-knowledge.controller';
import { DocumentLinkController } from './document-link.controller';
import { DocumentReviewController } from './document-review.controller';
import { DocumentInboundAddressController } from './document-inbound-address.controller';
import { DocumentSettingsController } from './document-settings.controller';
import { DocumentCollaborationController } from './document-collaboration.controller';
import { DocumentCommentAnchorController } from './document-comment-anchor.controller';
import { DocumentShareController } from './document-share.controller';
import { DocumentStatsController } from './document-stats.controller';
import { DocumentTreeController } from './document-tree.controller';
import { DocumentUploadController } from './document-upload.controller';
import { DocumentVersionController } from './document-version.controller';

export * from './document.controller';
export * from './document-import.controller';
export * from './document-pdf.controller';
export * from './document-category.controller';
export * from './document-comment-anchor.controller';
export * from './document-knowledge.controller';
export * from './document-link.controller';
export * from './document-review.controller';
export * from './document-inbound-address.controller';
export * from './document-settings.controller';
export * from './document-share.controller';
export * from './document-stats.controller';
export * from './document-tree.controller';
export * from './document-upload.controller';
export * from './document-version.controller';

/**
 * The controllers of the Documents plugin.
 *
 * Order matters for route resolution: controllers whose static segments (`/upload`,
 * `/reorder`, `/bulk`, `/facets`, `/count`) must win over `/:id` are declared before the
 * generic ones inside each controller; across controllers Nest keeps declaration order —
 * the upload controller precedes the generic document controller so `POST /upload` never
 * falls into `/:id` handlers.
 *
 * The inbound-email capture webhook is NOT in this list: it is `@Public()` (signed webhook,
 * no JWT) and is registered separately in `DocsModule` so the guarded API surface and the
 * public capture surface never get mixed up by accident.
 */
export const Controllers = [
	// Before DocumentController: its static `/documents/spaces` must beat `/documents/:id`.
	DocumentCollaborationController,
	// Before DocumentController: `/documents/:id/export.pdf` beside the generic `/documents/:id` routes; `/imports` is
	// its own prefix.
	DocumentImportController,
	DocumentPdfController,
	DocumentUploadController,
	DocumentKnowledgeController,
	DocumentReviewController,
	// Before DocumentController: its static `/documents/stats` must beat `/documents/:id`.
	DocumentStatsController,
	DocumentController,
	DocumentCommentAnchorController,
	DocumentTreeController,
	DocumentVersionController,
	DocumentCategoryController,
	DocumentShareController,
	DocumentLinkController,
	DocumentSettingsController,
	DocumentInboundAddressController
];
