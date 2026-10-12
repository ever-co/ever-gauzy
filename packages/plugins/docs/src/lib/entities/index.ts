import { Document } from './document.entity';
import { DocumentCategory } from './document-category.entity';
import { DocumentChunk } from './document-chunk.entity';
import { DocumentInboundAddress } from './document-inbound-address.entity';
import { DocumentIndexState } from './document-index-state.entity';
import { DocumentLink } from './document-link.entity';
import { DocumentShare } from './document-share.entity';
import { DocumentVersion } from './document-version.entity';

export { Document } from './document.entity';
export { DocumentCategory } from './document-category.entity';
export { DocumentChunk } from './document-chunk.entity';
export { DocumentInboundAddress } from './document-inbound-address.entity';
export { DocumentIndexState } from './document-index-state.entity';
export { DocumentLink } from './document-link.entity';
export { DocumentShare } from './document-share.entity';
export { DocumentVersion } from './document-version.entity';

/**
 * Every entity shipped by the Documents plugin — the single source for `@Plugin({ entities })`
 * and the `forFeature` arrays in `DocsModule`.
 */
export const ALL_DOC_ENTITIES = [
	Document,
	DocumentCategory,
	DocumentVersion,
	DocumentChunk,
	DocumentIndexState,
	DocumentShare,
	DocumentLink,
	DocumentInboundAddress
];
