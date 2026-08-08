import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min
} from 'class-validator';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum,
	ID,
	IDocument,
	IDocumentCategory,
	IDocumentLink,
	IDocumentShare,
	IDocumentVersion,
	IEmployee,
	ITag,
	JsonData
} from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	Tag,
	TenantOrganizationBaseEntity,
	VirtualMultiOrmColumn
} from '@gauzy/core';
import { MikroOrmDocumentRepository } from '../repositories/mikro-orm-document.repository';
import { binaryColumnType, floatColumnType, jsonColumnType } from './column-types';
import { DocumentCategory } from './document-category.entity';
import { DocumentLink } from './document-link.entity';
import { DocumentShare } from './document-share.entity';
import { DocumentVersion } from './document-version.entity';

@MultiORMEntity('document', { mikroOrmRepository: () => MikroOrmDocumentRepository })
@ColumnIndex('IDX_document_tenant_org_parent', ['tenantId', 'organizationId', 'parentId', 'index'])
@ColumnIndex('IDX_document_tenant_org_updated', ['tenantId', 'organizationId', 'updatedAt'])
@ColumnIndex('IDX_document_tenant_org_kind', ['tenantId', 'organizationId', 'kind'])
@ColumnIndex('IDX_document_tenant_org_status', ['tenantId', 'organizationId', 'status'])
@ColumnIndex('IDX_document_tenant_org_knowledge', ['tenantId', 'organizationId', 'knowledgeStatus'])
@ColumnIndex('IDX_document_tenant_org_review', ['tenantId', 'organizationId', 'reviewStatus'])
@ColumnIndex('IDX_document_tenant_org_source', ['tenantId', 'organizationId', 'source'])
@ColumnIndex('IDX_document_tenant_org_visibility', ['tenantId', 'organizationId', 'visibility'])
@ColumnIndex('IDX_document_tenant_org_sha256', ['tenantId', 'organizationId', 'sha256'])
export class Document extends TenantOrganizationBaseEntity implements IDocument {
	/**
	 * The node kind of the Documents tree: `FOLDER` | `PAGE` | `FILE`.
	 * Immutable after create.
	 */
	@ApiProperty({ type: () => String, enum: DocumentKindEnum })
	@IsEnum(DocumentKindEnum)
	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind: DocumentKindEnum;

	/**
	 * Sibling sort order within the parent.
	 */
	@ApiProperty({ type: () => Number, description: 'Sibling sort order within the parent' })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ default: 0 })
	index: number;

	/**
	 * Display name / page title.
	 */
	@ApiProperty({ type: () => String, description: 'Display name / page title' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	name: string;

	/**
	 * Emoji or icon name for tree/card chrome.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	icon?: string;

	/**
	 * Hex color for tree/card chrome.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	color?: string;

	/**
	 * Short plain-text description.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	description?: string;

	/**
	 * PAGE only. Canonical TipTap JSON document.
	 * Stored as `jsonb` (PostgreSQL) / `json` (MySQL) / `text` (SQLite — subscriber-serialized).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: jsonColumnType(), nullable: true })
	contentJson?: JsonData;

	/**
	 * PAGE only. Render cache + lexical-search extraction of `contentJson`.
	 * Derived; regenerated on save.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	contentHtml?: string;

	/**
	 * PAGE only. CRDT state for future realtime collaboration (P2).
	 * Written/served but not merged in v1.
	 */
	@ApiPropertyOptional({ type: () => 'string', format: 'binary' })
	@IsOptional()
	@MultiORMColumn({ type: binaryColumnType(), nullable: true })
	contentBinary?: Buffer;

	/**
	 * View-only lock on a PAGE.
	 */
	@ApiProperty({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isLocked: boolean;

	/**
	 * FILE only. Storage provider of the blob. Excluded from JSON output.
	 */
	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'varchar', length: 20, nullable: true })
	storageProvider?: FileStorageProviderEnum;

	/**
	 * FILE only. Provider object key. Excluded from JSON output.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'varchar', length: 1024, nullable: true })
	storageKey?: string;

	/**
	 * FILE only. Provider key of the generated thumbnail. Excluded from JSON output.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'varchar', length: 1024, nullable: true })
	thumbKey?: string;

	/**
	 * FILE only. Sniffed (magic-byte) canonical MIME — never the client header.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(127)
	@MultiORMColumn({ type: 'varchar', length: 127, nullable: true })
	mimeType?: string;

	/**
	 * FILE only. Size of the stored blob in bytes.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: isPostgres() || isMySQL() ? 'bigint' : 'integer',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	fileSize?: number;

	/**
	 * FILE only. Hex SHA-256 digest of the blob; dedup key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: isPostgres() || isMySQL() ? 'char' : 'varchar', length: 64, nullable: true })
	sha256?: string;

	/**
	 * FILE only. Original filename as uploaded; kept for download naming.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	originalFilename?: string;

	/**
	 * FILE: bumped on re-upload in place. PAGE: bumped when a `DocumentVersion` snapshot is captured.
	 */
	@ApiProperty({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ default: 1 })
	version: number;

	/**
	 * FILE only. Markdown extraction result (search + chunking input). Human-correctable.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	extractedText?: string;

	/**
	 * True after a human edits `extractedText`; the pipeline must never overwrite an edited extraction.
	 */
	@ApiProperty({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	extractedTextEdited: boolean;

	/**
	 * AI-generated 1–2 sentence summary.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	summary?: string;

	/**
	 * Processing status. Upload path sets `UPLOADED` explicitly; PAGE/FOLDER are born `READY`.
	 */
	@ApiProperty({ type: () => String, enum: DocumentStatusEnum })
	@IsEnum(DocumentStatusEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentStatusEnum.READY })
	status: DocumentStatusEnum;

	/**
	 * Failure reason, set with `FAILED`; truncated to 500 chars.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	statusMessage?: string;

	/**
	 * How the document entered the platform. Immutable after create.
	 */
	@ApiProperty({ type: () => String, enum: DocumentSourceEnum })
	@IsEnum(DocumentSourceEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentSourceEnum.UPLOAD })
	source: DocumentSourceEnum;

	/**
	 * AI knowledge lifecycle status. Importing into AI knowledge is a choice, not automatic.
	 */
	@ApiProperty({ type: () => String, enum: DocumentKnowledgeStatusEnum })
	@IsEnum(DocumentKnowledgeStatusEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentKnowledgeStatusEnum.NONE })
	knowledgeStatus: DocumentKnowledgeStatusEnum;

	/**
	 * Classification confidence 0–1 (clamped). NULL = never classified.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	@MultiORMColumn({ type: floatColumnType(), nullable: true })
	aiConfidence?: number;

	/**
	 * False = metadata-only search (content excluded from lexical search and content-search endpoints).
	 */
	@ApiProperty({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	searchable: boolean;

	/**
	 * Human review circuit-breaker status.
	 */
	@ApiProperty({ type: () => String, enum: DocumentReviewStatusEnum })
	@IsEnum(DocumentReviewStatusEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentReviewStatusEnum.NONE })
	reviewStatus: DocumentReviewStatusEnum;

	/**
	 * Why the document is pending review (kebab-case wire values). Machine-set with `PENDING`.
	 */
	@ApiPropertyOptional({ type: () => String, enum: DocumentReviewReasonEnum })
	@IsOptional()
	@IsEnum(DocumentReviewReasonEnum)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	reviewReason?: DocumentReviewReasonEnum;

	/**
	 * When the review decision was made.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	reviewedAt?: Date;

	/**
	 * Visibility scope: `ORGANIZATION` (default) or `PRIVATE`.
	 */
	@ApiProperty({ type: () => String, enum: DocumentVisibilityEnum })
	@IsEnum(DocumentVisibilityEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentVisibilityEnum.ORGANIZATION })
	visibility: DocumentVisibilityEnum;

	/**
	 * Importer/integration namespace (e.g. `'organization-document'`, `'help-center'`).
	 * Together with `externalId` it makes importers idempotent — the partial unique index
	 * `UQ_document_external_provenance` over (tenantId, organizationId, externalSource, externalId)
	 * is created by the core migration (WHERE "externalSource" IS NOT NULL).
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	externalSource?: string;

	/**
	 * Id inside `externalSource`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	externalId?: string;

	/**
	 * Catch-all provenance/extension dict (reserved keys: `email`, `chat`, `migration`, `deletion`).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: jsonColumnType(), nullable: true })
	metadata?: JsonData;

	/** Additional virtual columns */

	/**
	 * Virtual. Resolved by subscriber from `storageProvider` + `storageKey` (signed URL where supported).
	 */
	@VirtualMultiOrmColumn()
	fileUrl?: string;

	/**
	 * Virtual. Resolved by subscriber from `storageProvider` + `thumbKey`.
	 */
	@VirtualMultiOrmColumn()
	thumbUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Parent node of the tree (`NULL` = root). DB-level cascade is the safety net for hard purges;
	 * the service layer implements promote-children vs delete-subtree on soft delete.
	 */
	@MultiORMManyToOne(() => Document, (it) => it.children, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	parent?: IDocument;

	/**
	 * The UUID of the parent document node.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Document) => it.parent)
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * The Employee who approved/rejected the review.
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	reviewedBy?: IEmployee;

	/**
	 * The UUID of the reviewing Employee.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Document) => it.reviewedBy)
	@MultiORMColumn({ nullable: true, relationId: true })
	reviewedById?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Child nodes of the tree.
	 */
	@MultiORMOneToMany(() => Document, (it) => it.parent)
	children?: IDocument[];

	/**
	 * PAGE content snapshots.
	 */
	@MultiORMOneToMany(() => DocumentVersion, (it) => it.document, {
		/** Enables cascading persistence of versions with the document. */
		cascade: true
	})
	versions?: IDocumentVersion[];

	/**
	 * Overlay sharing grants for `visibility: PRIVATE` documents (P1).
	 */
	@MultiORMOneToMany(() => DocumentShare, (it) => it.document)
	shares?: IDocumentShare[];

	/**
	 * Polymorphic attachments to business records.
	 */
	@MultiORMOneToMany(() => DocumentLink, (it) => it.document)
	links?: IDocumentLink[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Free-form tags. One-sided M2M — no inverse property is added to the core `Tag` entity
	 * (established plugin precedent).
	 */
	@MultiORMManyToMany(() => Tag, {
		/**  Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'tag_document',
		/** Column in pivot table referencing 'document' primary key. */
		joinColumn: 'documentId',
		/** Column in pivot table referencing 'tag' primary key. */
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({ name: 'tag_document' })
	tags?: ITag[];

	/**
	 * Managed business-document categories (per-org controlled catalog).
	 */
	@MultiORMManyToMany(() => DocumentCategory, (it) => it.documents, {
		/**  Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'document_category_document',
		/** Column in pivot table referencing 'document' primary key. */
		joinColumn: 'documentId',
		/** Column in pivot table referencing 'document_category' primary key. */
		inverseJoinColumn: 'documentCategoryId'
	})
	@JoinTable({ name: 'document_category_document' })
	categories?: IDocumentCategory[];
}
