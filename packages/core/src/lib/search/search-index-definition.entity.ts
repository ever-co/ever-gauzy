import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DecimalString, ISearchIndexDefinition, ISearchIndexField, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonArrayColumn, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmSearchIndexDefinitionRepository } from './repository/mikro-orm-search-index-definition.repository';

/**
 * Which fields of which entity the global search index holds, and how much each of them counts.
 *
 * The declaration is **data**, not code: an operator can re-weight a field, add one or switch an
 * entity off without a deployment, and every domain is indexed through the same mechanism instead of
 * through an indexer of its own. `entity` is the value a search request passes as its entity filter,
 * and it is a logical key rather than a foreign key — a definition describes a class of rows, and the
 * classes that exist are exactly those a package registers.
 *
 * A definition belongs to the platform rather than to one domain, which is why it lives in core: the
 * index covers contacts, invoices, expenses, products, orders, projects, tasks, employees and
 * documents alike, and an index that only one domain could declare would make every other domain
 * depend on that domain's package.
 */
@MultiORMEntity('search_index_definition', {
	mikroOrmRepository: () => MikroOrmSearchIndexDefinitionRepository
})
export class SearchIndexDefinition extends TenantOrganizationBaseEntity implements ISearchIndexDefinition {
	/**
	 * The entity key being indexed, in the platform's own vocabulary: `product`, `product_variant`,
	 * `organization_contact`, `invoice`, `expense`, `project`, `task`, `employee`, `document`, `order`…
	 * Unique per organization and per engine.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(128)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 128 })
	entity: string;

	/**
	 * Human readable name, used wherever searchable entities are listed.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	label: string;

	/**
	 * The registered search-engine provider key this definition is written for; null means the
	 * built-in database provider, which is what makes search work with nothing configured.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	engineKey?: string;

	/**
	 * The indexed fields. Each entry declares where its value is read from, how much it weighs, and
	 * whether it may be searched, filtered or faceted — so a declaration that states the wrong kind
	 * fails at write time rather than producing an index that silently never matches.
	 */
	@ApiProperty({ type: () => Array })
	@JsonArrayColumn<ISearchIndexField>()
	fields: ISearchIndexField[];

	/**
	 * Weight applied to a field that declares none.
	 */
	@ApiProperty({ type: () => String, default: '1' })
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, default: 1 })
	defaultWeight: DecimalString;

	/**
	 * Template producing the document title, for example `{{name}} — {{code}}`. Null falls back to the
	 * searchable text field with the highest weight.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	@MultiORMColumn({ type: 'varchar', length: 512, nullable: true })
	titleTemplate?: string;

	/**
	 * Template producing the document body. Null joins the remaining searchable fields in declaration
	 * order.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ type: 'varchar', length: 1024, nullable: true })
	bodyTemplate?: string;

	/**
	 * Which indexed fields are promoted into the document's filterable token list. It is what gives
	 * MySQL and SQLite an index-served filter path where the attribute index does not exist.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonArrayColumn<string>({ nullable: true })
	keywordFields?: string[];

	/**
	 * The column whose value is copied into the document's `sourceUpdatedAt`, which is what lets an
	 * index run skip a source row that has not moved.
	 */
	@ApiProperty({ type: () => String, default: 'updatedAt' })
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, default: 'updatedAt' })
	sourceUpdatedAtField: string;

	/**
	 * A seeded definition: its weights may be edited, but it may not be deleted, because deleting it
	 * would silently remove an entity from every search.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isSystem: boolean;

	/**
	 * Bumped whenever the fields or a template change. A document built at an older version is rebuilt
	 * on the next run, which is how a weight change takes effect without a full operator-triggered
	 * reindex.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/**
	 * Engine mapping overrides, per-entity locale and tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
