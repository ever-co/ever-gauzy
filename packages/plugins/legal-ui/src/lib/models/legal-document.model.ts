/**
 * Identifiers of the legal documents bundled into the application.
 *
 * These match the document ids used by the `@ever-co/legal` corpus.
 */
export type LegalDocumentSlug = 'tos' | 'privacy' | 'cookies';

/**
 * A single legal document, vendored from `@ever-co/legal` at authoring time.
 *
 * Instances are plain build-time constants generated into `src/lib/content` - reading one
 * performs no HTTP request, so the Terms / Privacy pages cannot render blank because a
 * third-party service is unreachable.
 */
export interface ILegalDocument {
	/** Document id, e.g. `tos`. */
	readonly document: LegalDocumentSlug;

	/** Product the document was rendered for, e.g. `gauzy`. */
	readonly product: string;

	/** Human readable product name, e.g. `Ever Gauzy`. */
	readonly productName: string;

	/** Canonical domain the document refers to, e.g. `gauzy.co`. */
	readonly domain: string;

	/** Legal entity the document is published by. */
	readonly entity: string;

	/** Stable identifier of the legal entity. */
	readonly entityId: string;

	/** BCP-47-ish locale of the text, e.g. `en`. */
	readonly locale: string;

	/** Semantic version of the document, e.g. `1.0.0`. */
	readonly version: string;

	/** Date the version came into force, as `YYYY-MM-DD`. */
	readonly effectiveDate: string;

	/** SHA-256 the corpus pins this revision of the document by. */
	readonly sha256: string;

	/** Title of the document, taken from its first heading. */
	readonly title: string;

	/** Rendered HTML body of the document. */
	readonly html: string;
}
