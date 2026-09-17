import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID, ISearchDocument, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonArrayColumn, JsonbColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmSearchDocumentRepository } from './repository/mikro-orm-search-document.repository';

/**
 * One indexed entity instance, as the built-in index holds it.
 *
 * The document is a **projection and never authoritative**: a hit carries an entity type and an id,
 * and every reader re-reads the entity from the domain that owns it, so no request ever takes a
 * price, a stock level, a balance, a status or a permission from here. That is what makes the index
 * disposable — dropping the table and rebuilding it reproduces the same content — and it is why the
 * entity id is a plain identifier with **no foreign key**: a projection is rebuilt, not cascaded, and
 * a document outlives a hard delete of its source until the next sweep removes it.
 *
 * The row is keyed by `(tenant, entity, entityId, engine)`, so indexing the same row twice is an
 * update rather than a duplicate and the outbox consumer that maintains it needs no bookkeeping of
 * its own.
 *
 * `searchVector` is deliberately not declared here: it is a Postgres-only generated column over
 * `title`, `body` and `keywords`, created by the table's migration in the Postgres branch alone, so
 * that the same entity maps on MySQL and SQLite where that column does not exist.
 */
@MultiORMEntity('search_document', { mikroOrmRepository: () => MikroOrmSearchDocumentRepository })
export class SearchDocument extends TenantOrganizationBaseEntity implements ISearchDocument {
	/**
	 * Entity key, the same vocabulary as the index definition's `entity`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(128)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 128 })
	entity: string;

	/**
	 * Id of the indexed row. No foreign key: see the note on the class.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	entityId: ID;

	/**
	 * Display title, produced by the definition's title template.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(512)
	@MultiORMColumn({ type: 'varchar', length: 512 })
	title: string;

	/**
	 * Searchable body, produced by the definition's body template.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	body?: string;

	/**
	 * Promoted tokens: facet values, codes, tags, category ids and the foreign keys the definition
	 * declared. Stored as text and read with a token predicate, which is the filter path that works on
	 * every dialect — the attribute index is Postgres-only.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonArrayColumn<string>({ nullable: true })
	keywords?: string[];

	/**
	 * The attribute map of the row, for example `{ "colour": ["red"], "inStock": true, "priceMin":
	 * 19.99 }`. Queried with an attribute index on Postgres and read whole elsewhere.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonbColumn<JsonData>({ nullable: true })
	attributes?: JsonData;

	/**
	 * The greatest `updatedAt` of the source row at index time: it is what lets an index run skip an
	 * unchanged row and what identifies a document as stale.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	sourceUpdatedAt?: Date;

	/**
	 * When the row was written.
	 */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
	indexedAt: Date;

	/**
	 * Null when the built-in database provider wrote the row; otherwise the provider that produced it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	engineKey?: string;

	/**
	 * The definition version in force when the row was built. A mismatch against the current
	 * definition is exactly what the reindex sweep looks for.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	definitionVersion: number;
}
