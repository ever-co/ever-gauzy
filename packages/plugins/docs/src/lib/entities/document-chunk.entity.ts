import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID, IDocumentChunk, IDocumentChunkMetadata } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmDocumentChunkRepository } from '../repositories/mikro-orm-document-chunk.repository';
import { Document } from './document.entity';

@MultiORMEntity('document_chunk', { mikroOrmRepository: () => MikroOrmDocumentChunkRepository })
@ColumnIndex('IDX_document_chunk_tenant_org_doc', ['tenantId', 'organizationId', 'documentId', 'chunkIndex'], {
	unique: true
})
export class DocumentChunk extends TenantOrganizationBaseEntity implements IDocumentChunk {
	/**
	 * 0-based position within the document.
	 */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(0)
	@MultiORMColumn()
	chunkIndex: number;

	/**
	 * Chunk text (~512-token heading-aware windows, 64-token overlap).
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'text' })
	content: string;

	/**
	 * Embedding vector. Declared `simple-json` at the entity level (a plain text column) so
	 * schema tooling, SQLite unit tests, and MySQL installs stay ignorant of pgvector; the
	 * PostgreSQL migration converts the column to `vector(1536)` and the vector write path
	 * bypasses the ORM entirely. `NULL` until embedded.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@MultiORMColumn({ type: 'simple-json', nullable: true })
	embedding?: number[];

	/**
	 * Token estimate for budget math.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ nullable: true })
	tokenCount?: number;

	/**
	 * Citation locators: `{ headingPath, page?, sheet?, charRange? }`.
	 * (De)serialized on the SQLite path by the owning service — chunk content never rides an
	 * entity serialization to the client, so no load-time subscriber exists.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'simple-json', nullable: true })
	metadata?: IDocumentChunkMetadata;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The chunked document. Deliberately no inverse navigation on `Document` — chunk content
	 * must never ride an entity serialization to the client.
	 */
	@MultiORMManyToOne(() => Document, {
		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	document?: Document;

	/**
	 * The UUID of the chunked document.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentChunk) => it.document)
	@MultiORMColumn({ relationId: true })
	documentId: ID;
}
