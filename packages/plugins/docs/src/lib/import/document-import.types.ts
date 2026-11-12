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
	/**
	 * Claims the import for one run: applies `patch` only where the row is QUEUED, or RUNNING with no progress since
	 * `staleBefore` (a run that died), in one conditional update. True when this caller won it.
	 */
	claim(id: ID, scope: IImportScope, staleBefore: Date, patch: Partial<IImportRow>): Promise<boolean>;
	/**
	 * Applies `patch` to the import. With `fence` (the `attempts` a run's claim wrote), only while the import is still
	 * that run's and RUNNING: a run taken over by a later claim (it stalled past the stale window), or one the stalled
	 * import sweep sent back to QUEUED or gave up, changes nothing. True when the row was written.
	 */
	update(id: ID, scope: IImportScope, patch: Partial<IImportRow>, fence?: number): Promise<boolean>;
	/** The uploaded zip, bounded by the import's limit. */
	readArchive(row: IImportRow): Promise<Buffer>;
	/**
	 * Deletes the uploaded zip (best-effort; the import is over). With `fence`, only while the import is still that
	 * run's: a run taken over never deletes the zip its replacement reads.
	 */
	discardArchive(row: IImportRow, fence?: number): Promise<void>;
	/** The document this import already created for an archive entry (any kind), if any. */
	findImported(scope: IImportScope, externalSource: string, externalId: string): Promise<IImportedDocumentRef | null>;
	/**
	 * Gives a document an earlier run created back to the importing member (and the export's created date): a run that
	 * stopped between creating a row and stamping it would otherwise leave a PRIVATE page no one can read.
	 */
	adoptImported(id: ID, ownerUserId: ID | null, createdAt?: Date): Promise<void>;
	createNode(input: ICreateImportedNode): Promise<IImportedDocumentRef>;
	/** Stores the bytes, creates the FILE document and enqueues its processing (`docs.extract`). */
	createFile(input: ICreateImportedFile): Promise<IImportedDocumentRef>;
	/**
	 * Writes a page's content (the JSON, schema-valid; the derived and sanitized HTML) as a claimed content revision,
	 * only while the page is as the import created it: false when it was saved meanwhile (by a member, or by an earlier
	 * run of this import), and it is then left as it is. An editor that loaded the empty page sees the revision moved.
	 */
	writePage(document: IImportedDocumentRef, scope: IImportScope, contentJson: IDocNode, ownerUserId: ID | null): Promise<boolean>;
	/**
	 * The ids of the pages a page's saved content mentions: for a page saved meanwhile, whose links follow what it holds,
	 * not what the import would have written.
	 */
	mentionsOf(documentId: ID, scope: IImportScope): Promise<Set<string>>;
	/** The `document → document` links of the pages a page mentions. */
	linkPages(documentId: ID, mentionedIds: ID[], scope: IImportScope): Promise<void>;
	/** The bytes the organization stores today. */
	usedBytes(scope: IImportScope): Promise<number>;
}

