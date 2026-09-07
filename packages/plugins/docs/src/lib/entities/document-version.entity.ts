import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID, IDocument, IDocumentVersion, IEmployee, JsonData } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmDocumentVersionRepository } from '../repositories/mikro-orm-document-version.repository';
import { binaryColumnType, jsonColumnType } from './column-types';
import { Document } from './document.entity';

@MultiORMEntity('document_version', { mikroOrmRepository: () => MikroOrmDocumentVersionRepository })
@ColumnIndex('IDX_document_version_doc_saved', ['documentId', 'lastSavedAt'])
export class DocumentVersion extends TenantOrganizationBaseEntity implements IDocumentVersion {
	/**
	 * Document title at capture time (titles are versioned here even though the live title
	 * lives on `document.name`).
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	name: string;

	/**
	 * Snapshot of the canonical TipTap JSON document.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: jsonColumnType(), nullable: true })
	contentJson?: JsonData;

	/**
	 * Snapshot of the render cache.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	contentHtml?: string;

	/**
	 * Snapshot of the CRDT state (only when the live column was populated).
	 */
	@ApiPropertyOptional({ type: () => 'string', format: 'binary' })
	@IsOptional()
	@MultiORMColumn({ type: binaryColumnType(), nullable: true })
	contentBinary?: Buffer;

	/**
	 * Capture timestamp; history ordering key (no per-row version number — `document.version`
	 * is the counter).
	 */
	@ApiProperty({ type: () => Date })
	@IsDateString()
	@MultiORMColumn()
	lastSavedAt: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The document this snapshot belongs to.
	 */
	@MultiORMManyToOne(() => Document, (it) => it.versions, {
		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	document?: IDocument;

	/**
	 * The UUID of the snapshotted document.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentVersion) => it.document)
	@MultiORMColumn({ relationId: true })
	documentId: ID;

	/**
	 * The editor whose save triggered the capture (`NULL` for system writes).
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	createdBy?: IEmployee;

	/**
	 * The UUID of the capturing Employee.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DocumentVersion) => it.createdBy)
	@MultiORMColumn({ nullable: true, relationId: true })
	createdById?: ID;
}
