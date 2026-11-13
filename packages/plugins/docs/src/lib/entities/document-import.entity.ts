import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { isMySQL } from '@gauzy/config';
import {
	DocumentImportLayoutEnum,
	DocumentImportPhaseEnum,
	DocumentImportStatusEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum,
	ID,
	IDocument,
	IDocumentImport,
	IDocumentImportReport,
	IOrganizationTeam
} from '@gauzy/contracts';
import {
	ColumnIndex,
	ExportRedacted,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmDocumentImportRepository } from '../repositories/mikro-orm-document-import.repository';
import { Document } from './document.entity';

/**
 * One import of an exported workspace (a Markdown vault or an HTML export zip) — `docs-import-export` plan §3.
 *
 * The row is the job's source of truth: the queue only carries its id and the tenant snapshot, so a resumed run reads
 * the target, the decisions taken on the request thread (`optionsJson`) and the zip's storage key from here.
 *
 * 🛑 Like every entity of this plugin, only `varchar` and `text` carry an explicit `type:` — dates, booleans and
 * integers are inferred, because an explicit `timestamp` crash-loops the SQLite (demo) boot. The two JSON payloads
 * are `text` columns the service parses, so the three dialects behave alike without a subscriber.
 */
@MultiORMEntity('document_import', { mikroOrmRepository: () => MikroOrmDocumentImportRepository })
@ColumnIndex('IDX_document_import_tenant_org_creator', ['tenantId', 'organizationId', 'createdByUserId'])
export class DocumentImport extends TenantOrganizationBaseEntity implements Omit<IDocumentImport, 'report'> {
	@ApiProperty({ type: () => String, enum: DocumentImportStatusEnum })
	@IsEnum(DocumentImportStatusEnum)
	@ColumnIndex('IDX_document_import_status')
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentImportStatusEnum.QUEUED })
	status: DocumentImportStatusEnum;

	@ApiPropertyOptional({ type: () => String, enum: DocumentImportPhaseEnum })
	@IsOptional()
	@IsEnum(DocumentImportPhaseEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	phase?: DocumentImportPhaseEnum | null;

	@ApiPropertyOptional({ type: () => String, enum: DocumentImportLayoutEnum })
	@IsOptional()
	@IsEnum(DocumentImportLayoutEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	layout?: DocumentImportLayoutEnum | null;

	/** The uploaded file's name — data, never a path. */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	fileName: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	fileSize?: number | null;

	/** The provider the zip was stored with (it is deleted when the import ends). */
	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'varchar', length: 20, nullable: true })
	storageProvider?: FileStorageProviderEnum | null;

	/** The server-generated key of the stored zip (`documents/<tenant>/<org>/imports/<uuid>.zip`). */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'varchar', length: 1024, nullable: true })
	storageKey?: string | null;

	/** The page or folder the tree lands under; null = the top of the space. */
	@MultiORMManyToOne(() => Document, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	parent?: IDocument | null;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DocumentImport) => it.parent)
	@ColumnIndex('IDX_document_import_parentId')
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID | null;

	@ApiPropertyOptional({ type: () => String, enum: DocumentVisibilityEnum })
	@IsOptional()
	@IsEnum(DocumentVisibilityEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	visibility?: DocumentVisibilityEnum | null;

	/** The team of a `TEAM` space; a deleted team leaves the row without one. */
	@MultiORMManyToOne(() => OrganizationTeam, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	organizationTeam?: IOrganizationTeam | null;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DocumentImport) => it.organizationTeam)
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID | null;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ default: 0 })
	totalItems: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ default: 0 })
	processedItems: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ default: 0 })
	importedCount: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ default: 0 })
	skippedCount: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ default: 0 })
	failedCount: number;

	/** Runs started so far; an import that failed `DOCS_IMPORT_MAX_RUNS` runs stays FAILED. */
	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ default: 0 })
	attempts: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	errorCode?: string | null;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	errorMessage?: string | null;

	/** The decisions taken on the request thread (quota, knowledge default, the initiating employee), as JSON text. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'text', nullable: true })
	optionsJson?: string | null;

	/**
	 * The report (`IDocumentImportReport`) as JSON text. `longtext` on MySQL, whose `text` stops at 64 KiB — a report of a
	 * thousand pages is past that; PostgreSQL and SQLite `text` have no such limit.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: isMySQL() ? 'longtext' : 'text', nullable: true })
	reportJson?: string | null;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	finishedAt?: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastProgressAt?: Date | null;

	/** `reportJson` parsed; null when there is none (or it does not parse). Not a column. */
	get report(): IDocumentImportReport | null {
		if (!this.reportJson) {
			return null;
		}
		try {
			const parsed = JSON.parse(this.reportJson);
			return parsed && Array.isArray(parsed.items) ? (parsed as IDocumentImportReport) : null;
		} catch {
			return null;
		}
	}
}
