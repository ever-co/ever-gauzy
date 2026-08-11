import { DocumentController } from './document.controller';
import { DocumentCategoryController } from './document-category.controller';
import { DocumentKnowledgeController } from './document-knowledge.controller';
import { DocumentLinkController } from './document-link.controller';
import { DocumentReviewController } from './document-review.controller';
import { DocumentInboundAddressController } from './document-inbound-address.controller';
import { DocumentSettingsController } from './document-settings.controller';
import { DocumentShareController } from './document-share.controller';
import { DocumentTreeController } from './document-tree.controller';
import { DocumentUploadController } from './document-upload.controller';
import { DocumentVersionController } from './document-version.controller';

export * from './document.controller';
export * from './document-category.controller';
export * from './document-knowledge.controller';
export * from './document-link.controller';
export * from './document-review.controller';
export * from './document-inbound-address.controller';
export * from './document-settings.controller';
export * from './document-share.controller';
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
	DocumentUploadController,
	DocumentKnowledgeController,
	DocumentReviewController,
	DocumentController,
	DocumentTreeController,
	DocumentVersionController,
	DocumentCategoryController,
	DocumentShareController,
	DocumentLinkController,
	DocumentSettingsController,
	DocumentInboundAddressController
];
