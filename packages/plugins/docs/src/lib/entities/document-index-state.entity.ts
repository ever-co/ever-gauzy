import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID, IDocumentIndexState } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmDocumentIndexStateRepository } from '../repositories/mikro-orm-document-index-state.repository';
import { Document } from './document.entity';

@MultiORMEntity('document_index_state', { mikroOrmRepository: () => MikroOrmDocumentIndexStateRepository })
@ColumnIndex('IDX_document_index_state_document', ['documentId'], { unique: true })
@ColumnIndex('IDX_document_index_state_model', ['tenantId', 'organizationId', 'embeddingModel'])
export class DocumentIndexState extends TenantOrganizationBaseEntity implements IDocumentIndexState {
	/**
	 * Model id used at index time (e.g. the value of `GAUZY_DOCS_EMBEDDING_MODEL`).
	 * Indexed so a model-flip sweep is one indexed scan.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	@MultiORMColumn({ type: 'varchar', length: 100 })
	embeddingModel: string;

	/**
	 * Vector dimensionality at index time (1536 default).
	 */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1)
	@MultiORMColumn()
	embeddingDims: number;

	/**
	 * Chunks written in the last successful index run.
	 */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ default: 0 })
	chunkCount: number;

	/**
	 * Last successful index completion.
	 */
	@ApiProperty({ type: () => Date })
	@IsDateString()
	@MultiORMColumn()
	lastIndexedAt: Date;

	/**
	 * SHA-256 of the exact text that was chunked (`extractedText` or serialized page markdown).
	 * The pipeline skips embed+index when unchanged.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	contentHash: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The indexed document — exactly one bookkeeping row per document (upserted by the `index` job).
	 */
	@MultiORMManyToOne(() => Document, {
		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	document?: Document;

	/**
	 * The UUID of the indexed document.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentIndexState) => it.document)
	@MultiORMColumn({ relationId: true })
	documentId: ID;
}
