import { Logger } from '@nestjs/common';
import { DocumentKindEnum, DocumentSourceEnum, DocumentVisibilityEnum, ID, JsonData } from '@gauzy/contracts';

/**
 * The integration-importer seam of `07-ai-knowledge.md` §17.3.
 *
 * Capture channels are **provider-based**: this plugin owns the contract and the registry;
 * integration plugins (Google Drive, SharePoint, Notion, …) own the transport and register
 * their implementation. Nothing here reaches out to a third-party service — the registry is
 * a static, DI-free surface (mirroring `DocumentVectorStoreRegistry`) so an integration
 * plugin can register without importing this plugin's Nest graph.
 *
 * Idempotency is the importer contract's core promise: every mapped document carries
 * `externalSource` + `externalId`, which the provenance unique index
 * `UQ_document_external_provenance` turns into an upsert key — a re-run updates, never
 * duplicates. Content-level dedup rides the existing `sha256` column on top.
 */

/** Tenant/organization scope every importer call is executed under. */
export interface IDocumentImporterContext {
	tenantId: ID;
	organizationId: ID;
	/** Optional folder the imported documents should land under. */
	parentId?: ID | null;
	/** Free-form per-integration configuration (credentials are resolved by the integration). */
	settings?: JsonData;
}

/** One item as it exists on the remote side. */
export interface IExternalDocumentRef {
	/** Namespace of the importer (e.g. `google-drive`) — becomes `document.externalSource`. */
	externalSource: string;
	/** Stable id inside `externalSource` — becomes `document.externalId`. */
	externalId: string;
	/** Display name, when the listing already knows it. */
	name?: string;
	/** Remote last-modified timestamp, used by incremental runs. */
	updatedAt?: Date;
	/** Remote byte size, when known (lets the caller pre-check the storage quota). */
	sizeBytes?: number;
	/** Anything the importer needs to carry from `list` into `fetch`. */
	metadata?: JsonData;
}

/** The payload one item resolves to. */
export interface IDocumentImporterPayload {
	/** File bytes for `kind: FILE` imports. */
	content?: Buffer;
	/** Already-extracted text/markdown, when the remote side provides it. */
	text?: string;
	/** Sniffed server-side regardless — this is the remote's claim only. */
	mimeType?: string;
	fileName?: string;
	metadata?: JsonData;
}

/** The document shape an importer maps a remote item to. */
export interface IMappedDocument {
	name: string;
	kind: DocumentKindEnum;
	/** Always `INTEGRATION` for importer output (07 §17.3). */
	source: DocumentSourceEnum.INTEGRATION;
	externalSource: string;
	externalId: string;
	parentId?: ID | null;
	description?: string | null;
	visibility?: DocumentVisibilityEnum;
	mimeType?: string | null;
	fileSize?: number | null;
	originalFilename?: string | null;
	/** Extracted text when the remote provided it (skips the extract stage). */
	extractedText?: string | null;
	metadata?: JsonData;
}

/**
 * One integration importer. `listChangedSince` is optional: an importer that cannot express
 * incremental listing simply omits it and the caller performs a full sweep.
 */
export interface IDocumentImporter {
	/** Stable importer id, also used as the `externalSource` namespace by convention. */
	readonly id: string;

	/**
	 * Lists remote items changed since a timestamp (omit for a full sweep). Implementations
	 * are expected to be rate-limit aware and to page internally.
	 */
	listChangedSince?(context: IDocumentImporterContext, since?: Date): Promise<IExternalDocumentRef[]>;

	/** Resolves one remote item's payload. */
	fetch(context: IDocumentImporterContext, ref: IExternalDocumentRef): Promise<IDocumentImporterPayload>;

	/** Maps a remote item + payload onto the document shape this plugin persists. */
	mapToDocument(
		context: IDocumentImporterContext,
		ref: IExternalDocumentRef,
		payload: IDocumentImporterPayload
	): IMappedDocument | Promise<IMappedDocument>;
}

/**
 * Process-wide registry of document importers.
 *
 * Static (not Nest DI) on purpose: an integration plugin registers in its own bootstrap
 * without importing `DocsModule`, exactly like the vector-store provider seam.
 */
export class DocumentImporterRegistry {
	private static readonly logger = new Logger('DocumentImporterRegistry');
	private static readonly importers = new Map<string, IDocumentImporter>();

	/**
	 * Registers (or replaces) an importer.
	 *
	 * @param importer The importer to register.
	 */
	static register(importer: IDocumentImporter): void {
		if (!importer?.id) {
			throw new Error('A document importer must expose a stable `id`.');
		}
		if (this.importers.has(importer.id)) {
			this.logger.warn(`Document importer '${importer.id}' was already registered — replacing.`);
		}
		this.importers.set(importer.id, importer);
		this.logger.log(`Document importer registered: ${importer.id}`);
	}

	/**
	 * Removes an importer (plugin teardown).
	 *
	 * @param id The importer id.
	 */
	static unregister(id: string): void {
		this.importers.delete(id);
	}

	/**
	 * Resolves one importer by id.
	 *
	 * @param id The importer id.
	 * @returns The importer, or undefined when not registered.
	 */
	static resolve(id: string): IDocumentImporter | undefined {
		return this.importers.get(id);
	}

	/** Whether an importer with that id is registered. */
	static has(id: string): boolean {
		return this.importers.has(id);
	}

	/** All registered importers, in registration order. */
	static list(): IDocumentImporter[] {
		return [...this.importers.values()];
	}

	/** Drops every registration (tests / teardown). */
	static clear(): void {
		this.importers.clear();
	}
}
