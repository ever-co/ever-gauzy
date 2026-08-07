import { BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IEmployee } from './employee.model';
import { FileStorageProviderEnum } from './file-provider';
import { IOrganizationTeam } from './organization-team.model';
import { ITag } from './tag.model';

/**
 * Document node kind enum
 *
 * The Documents tree has a single node type discriminated by `kind`:
 * folders and pages can contain children; files are leaves.
 */
export enum DocumentKindEnum {
	FOLDER = 'FOLDER',
	PAGE = 'PAGE',
	FILE = 'FILE'
}

/**
 * Document processing status enum
 *
 * FILE documents are born `UPLOADED` and run the processing pipeline;
 * PAGE/FOLDER documents are born `READY`.
 */
export enum DocumentStatusEnum {
	UPLOADED = 'UPLOADED',
	PROCESSING = 'PROCESSING',
	READY = 'READY',
	FAILED = 'FAILED'
}

/**
 * Document source enum
 *
 * How the document entered the platform. Immutable after create.
 */
export enum DocumentSourceEnum {
	UPLOAD = 'UPLOAD',
	EDITOR = 'EDITOR',
	CHAT = 'CHAT',
	EMAIL = 'EMAIL',
	INTEGRATION = 'INTEGRATION',
	SYSTEM = 'SYSTEM',
	IMPORT = 'IMPORT'
}

/**
 * Document AI knowledge status enum
 *
 * Importing into AI knowledge is a choice, not automatic — plain uploads stay `NONE`;
 * `EXCLUDED` means explicitly opted out.
 */
export enum DocumentKnowledgeStatusEnum {
	NONE = 'NONE',
	QUEUED = 'QUEUED',
	INDEXING = 'INDEXING',
	INDEXED = 'INDEXED',
	FAILED = 'FAILED',
	EXCLUDED = 'EXCLUDED'
}

/**
 * Document review status enum
 *
 * The review circuit breaker: a `PENDING` document with an AI-related review reason
 * is excluded from AI retrieval until approved.
 */
export enum DocumentReviewStatusEnum {
	NONE = 'NONE',
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	REJECTED = 'REJECTED'
}

/**
 * Document review reason enum
 *
 * Wire/storage values are kebab-case; keys are SCREAMING_CASE.
 */
export enum DocumentReviewReasonEnum {
	EXTRACTION_FAILED = 'extraction-failed',
	LOW_CONFIDENCE = 'low-confidence',
	AI_GENERATED = 'ai-generated',
	MANUAL = 'manual'
}

/**
 * Document visibility enum
 *
 * `ORGANIZATION` documents are visible to everyone in the organization holding read
 * permission; `PRIVATE` documents are visible to the creator, admins, and explicit
 * share grantees. Children do not inherit visibility.
 */
export enum DocumentVisibilityEnum {
	ORGANIZATION = 'ORGANIZATION',
	PRIVATE = 'PRIVATE'
}

/**
 * Document share access enum
 *
 * `VIEW` (read only) · `COMMENT` (read + comment) · `EDIT` (read + comment + modify
 * content/metadata). Escalation beyond `EDIT` always requires ownership or manage rights.
 */
export enum DocumentShareAccessEnum {
	VIEW = 'VIEW',
	COMMENT = 'COMMENT',
	EDIT = 'EDIT'
}

/**
 * Document entity interface
 *
 * The single node of the Documents tree: a folder (`kind = FOLDER`), an authored
 * wiki page (`kind = PAGE`) or an uploaded file (`kind = FILE`).
 */
export interface IDocument extends IBasePerTenantAndOrganizationEntityModel {
	kind: DocumentKindEnum;
	parentId?: ID; // Self-reference to the parent node; undefined/null = root
	parent?: IDocument;
	children?: IDocument[];
	index: number; // Sibling sort order within the parent
	name: string; // Display name / page title
	icon?: string; // Emoji or icon name for tree/card chrome
	color?: string; // Hex color for tree/card chrome
	description?: string; // Short plain-text description
	contentJson?: JsonData; // PAGE only. Canonical TipTap JSON document
	contentHtml?: string; // PAGE only. Render cache derived from `contentJson`
	contentBinary?: Uint8Array; // PAGE only. CRDT state for future realtime collaboration
	isLocked: boolean; // View-only lock on a PAGE
	storageProvider?: FileStorageProviderEnum; // FILE only. Storage provider of the blob
	storageKey?: string; // FILE only. Provider object key
	thumbKey?: string; // FILE only. Provider key of the generated thumbnail
	readonly fileUrl?: string; // Virtual. Resolved from `storageProvider` + `storageKey`
	readonly thumbUrl?: string; // Virtual. Resolved from `storageProvider` + `thumbKey`
	mimeType?: string; // FILE only. Sniffed (magic-byte) canonical MIME
	fileSize?: number; // FILE only. Bytes
	sha256?: string; // FILE only. Hex digest of the blob; dedup key
	originalFilename?: string; // FILE only. As uploaded; kept for download naming
	version: number; // FILE: bumped on re-upload in place. PAGE: bumped per version snapshot
	extractedText?: string; // FILE only. Markdown extraction result (human-correctable)
	extractedTextEdited: boolean; // True after a human edits `extractedText`
	summary?: string; // AI-generated 1–2 sentence summary
	status: DocumentStatusEnum;
	statusMessage?: string; // Failure reason, set with `FAILED`
	source: DocumentSourceEnum;
	knowledgeStatus: DocumentKnowledgeStatusEnum;
	aiConfidence?: number; // Classification confidence 0–1; undefined = never classified
	searchable: boolean; // False = metadata-only search (content excluded from lexical search)
	reviewStatus: DocumentReviewStatusEnum;
	reviewReason?: DocumentReviewReasonEnum; // Machine-set with `PENDING`
	reviewedById?: ID; // Employee who approved/rejected
	reviewedBy?: IEmployee;
	reviewedAt?: Date;
	visibility: DocumentVisibilityEnum;
	externalSource?: string; // Importer/integration namespace
	externalId?: string; // Id inside `externalSource`; together they make importers idempotent
	metadata?: JsonData; // Catch-all provenance/extension dict
	tags?: ITag[];
	categories?: IDocumentCategory[];
	versions?: IDocumentVersion[];
	shares?: IDocumentShare[];
	links?: IDocumentLink[];
}

/**
 * Document category entity interface
 *
 * Per-tenant/org controlled catalog of business-document categories. AI classification
 * assigns categories from this catalog only; unlike tags, categories are a managed vocabulary.
 */
export interface IDocumentCategory extends IBasePerTenantAndOrganizationEntityModel {
	name: string; // Display name, unique per organization (case-insensitive)
	slug: string; // Kebab-case machine key
	color?: string; // Hex color for chips
	icon?: string; // Eva icon name for chips
	description?: string; // Shown in catalog management UI; used as classification hint text
	isSystem: boolean; // True for seeded defaults; system rows can be renamed but not deleted
	documents?: IDocument[];
}

/**
 * Document version entity interface
 *
 * Point-in-time snapshot of PAGE content, captured automatically with a
 * server-side debounce; restore is non-destructive.
 */
export interface IDocumentVersion extends IBasePerTenantAndOrganizationEntityModel {
	documentId: ID;
	document?: IDocument;
	name: string; // Document title at capture time
	contentJson?: JsonData; // Snapshot
	contentHtml?: string; // Snapshot
	contentBinary?: Uint8Array; // Snapshot (only when the live column was populated)
	lastSavedAt: Date; // Capture timestamp; history ordering key
	createdById?: ID; // Employee whose save triggered the capture; undefined for system writes
	createdBy?: IEmployee;
}

/**
 * Document chunk entity interface
 *
 * Retrieval-augmentation chunk of a document's content. Chunks are replaced
 * transactionally as a set on every re-index; they are never edited in place.
 */
export interface IDocumentChunk extends IBasePerTenantAndOrganizationEntityModel {
	documentId: ID;
	chunkIndex: number; // 0-based position within the document
	content: string; // Chunk text
	embedding?: number[]; // Embedding vector; undefined until embedded
	tokenCount?: number; // Token estimate for budget math
	metadata?: IDocumentChunkMetadata; // Citation locators
}

/**
 * Document chunk metadata interface (citation locators)
 */
export interface IDocumentChunkMetadata {
	headingPath: string[];
	page?: number;
	sheet?: string;
	charRange?: { start: number; end: number };
}

/**
 * Document index state entity interface
 *
 * Exactly one bookkeeping row per document that has ever been indexed into AI
 * knowledge: which embedding model produced the chunks, at what dimensionality,
 * how many, when, and from which content hash.
 */
export interface IDocumentIndexState extends IBasePerTenantAndOrganizationEntityModel {
	documentId: ID;
	embeddingModel: string; // Model id used at index time
	embeddingDims: number; // Vector dimensionality at index time
	chunkCount: number; // Chunks written in the last successful index run
	lastIndexedAt: Date; // Last successful index completion
	contentHash: string; // SHA-256 of the exact text that was chunked
}

/**
 * Document share entity interface
 *
 * Overlay sharing for PRIVATE documents. Exactly one of `employeeId` / `teamId`
 * is set per row (XOR).
 */
export interface IDocumentShare extends IBasePerTenantAndOrganizationEntityModel {
	documentId: ID;
	document?: IDocument;
	employeeId?: ID;
	employee?: IEmployee;
	teamId?: ID;
	team?: IOrganizationTeam;
	access: DocumentShareAccessEnum;
}

/**
 * Document link entity interface
 *
 * Attaches a document to any business record (polymorphic by `entity` + `entityId`).
 * Idempotent per (document, entity, entityId).
 */
export interface IDocumentLink extends IBasePerTenantAndOrganizationEntityModel {
	documentId: ID;
	document?: IDocument;
	entity: BaseEntityEnum; // The type of the target record
	entityId: ID; // Target record id
	metadata?: JsonData; // Display label captured at link time
}

/**
 * Document create input interface
 */
export interface IDocumentCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	kind: DocumentKindEnum;
	name: string;
	parentId?: ID;
	index?: number;
	icon?: string;
	color?: string;
	description?: string;
	contentJson?: JsonData; // PAGE only
	contentHtml?: string; // PAGE only
	contentBinary?: Uint8Array; // PAGE only
	visibility?: DocumentVisibilityEnum;
	tags?: ITag[];
	categoryIds?: ID[];
	importToKnowledge?: boolean;
	mentionEmployeeIds?: ID[];
}

/**
 * Document update input interface
 */
export interface IDocumentUpdateInput extends Partial<Omit<IDocumentCreateInput, 'kind'>> {}

/**
 * Document move input interface
 */
export interface IDocumentMoveInput extends IBasePerTenantAndOrganizationEntityModel {
	parentId: ID | null; // Null = move to root
	index: number; // Target sibling position
}

/**
 * Document link create input interface
 */
export interface IDocumentLinkCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	documentId: ID;
	entity: BaseEntityEnum;
	entityId: ID;
	metadata?: JsonData;
}
