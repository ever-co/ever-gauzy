import {
	DocumentImportLayoutEnum,
	DocumentImportPhaseEnum,
	DocumentImportStatusEnum,
	DocumentKindEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum,
	ID
} from '@gauzy/contracts';
import type { IDocNode } from '../services/document-markdown';
import type { IImportArchiveLimits } from './import-archive';

/** Injection token of the import's persistence and storage seam ({@link IDocumentImportStore}). */
export const DOCS_IMPORT_STORE = 'DOCS_IMPORT_STORE';

/** Injection token of the import runner, as the pipeline resolves it for the `docs.import` stage. */
export const DOCS_IMPORT_RUNNER = 'DOCS_IMPORT_RUNNER';

/** The tenant / organization snapshot every read and write of a run carries (no request context on a queue thread). */
export interface IImportScope {
	tenantId: ID;
	organizationId: ID;
}

/**
 * The decisions taken on the request thread, stored with the row (`optionsJson`) so that a run on a queue thread —
 * which has no request context — applies exactly what the request resolved.
 */
export interface IImportOptions {
	/** The organization's storage quota in bytes, `0` = unlimited (`DocumentQuotaService`). */
	quotaBytes: number;
	/** Whether attachments join the AI knowledge index (the organization's `importToKnowledgeDefault`). */
	importToKnowledge: boolean;
	/** The per-file upload limit applied to each attachment. */
	maxFileSize: number;
	/** The archive limits of the installation when the import was started. */
	limits: IImportArchiveLimits;
	/** The member who started the import: the owner of everything it creates. */
	initiatedByUserId?: ID | null;
}

/** The columns of `document_import` a run reads and writes. */
export interface IImportRow {
	id: ID;
	tenantId: ID;
	organizationId: ID;
	status: DocumentImportStatusEnum;
	phase?: DocumentImportPhaseEnum | null;
	layout?: DocumentImportLayoutEnum | null;
	fileName: string;
	fileSize?: number | null;
	storageProvider?: FileStorageProviderEnum | null;
	storageKey?: string | null;
	parentId?: ID | null;
	visibility?: DocumentVisibilityEnum | null;
	organizationTeamId?: ID | null;
	totalItems?: number;
	processedItems?: number;
	importedCount?: number;
	skippedCount?: number;
	failedCount?: number;
	attempts?: number;
	errorCode?: string | null;
	errorMessage?: string | null;
	optionsJson?: string | null;
	reportJson?: string | null;
	startedAt?: Date | null;
	finishedAt?: Date | null;
	lastProgressAt?: Date | null;
	createdByUserId?: ID | null;
	createdAt?: Date;
}

/** A document an import created (or found it had created on an earlier run). */
export interface IImportedDocumentRef {
	id: ID;
	kind: DocumentKindEnum;
	name: string;
	mimeType?: string | null;
	fileSize?: number | null;
}

/** A folder or a page to create. */
export interface ICreateImportedNode {
	scope: IImportScope;
	kind: DocumentKindEnum.FOLDER | DocumentKindEnum.PAGE;
	name: string;
	parentId: ID | null;
	index: number;
	icon?: string;
	createdAt?: Date;
	visibility: DocumentVisibilityEnum;
	organizationTeamId: ID | null;
	/** `docs-import:<importId>` — with `externalId`, the provenance key a resumed run finds it by. */
	externalSource: string;
	externalId: string;
	/** The owner (the member who started the import). */
	ownerUserId: ID | null;
	/** Where it came from: the import and the archive path. */
	metadata: Record<string, unknown>;
}

/** An attachment to store and create, already sniffed. */
export interface ICreateImportedFile extends Omit<ICreateImportedNode, 'kind' | 'icon'> {
	kind: DocumentKindEnum.FILE;
	buffer: Buffer;
	mimeType: string;
	sha256: string;
	importToKnowledge: boolean;
}

/**
 * Everything a run touches outside its own logic: the import row, the archive in storage, the documents and their
 * links, the organization's usage. One Nest implementation (`DocumentImportStore`) over TypeORM and the platform's
 * file storage; the runner's spec drives an in-memory one.
 */
export interface IDocumentImportStore {
	load(id: ID, scope: IImportScope): Promise<IImportRow | null>;
	update(id: ID, scope: IImportScope, patch: Partial<IImportRow>): Promise<void>;
	/** The uploaded zip, bounded by the import's limit. */
	readArchive(row: IImportRow): Promise<Buffer>;
	/** Deletes the uploaded zip (best-effort; the import is over). */
	discardArchive(row: IImportRow): Promise<void>;
	/** The document this import already created for an archive entry (any kind), if any. */
	findImported(scope: IImportScope, externalSource: string, externalId: string): Promise<IImportedDocumentRef | null>;
	createNode(input: ICreateImportedNode): Promise<IImportedDocumentRef>;
	/** Stores the bytes, creates the FILE document and enqueues its processing (`docs.extract`). */
	createFile(input: ICreateImportedFile): Promise<IImportedDocumentRef>;
	/** Writes a page's content: the JSON (schema-valid), the derived and sanitized HTML. */
	writePage(document: IImportedDocumentRef, scope: IImportScope, contentJson: IDocNode, ownerUserId: ID | null): Promise<void>;
	/** The `document → document` links of the pages a page mentions. */
	linkPages(documentId: ID, mentionedIds: ID[], scope: IImportScope): Promise<void>;
	/** The bytes the organization stores today. */
	usedBytes(scope: IImportScope): Promise<number>;
}

