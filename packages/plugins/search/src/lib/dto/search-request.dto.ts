import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested
} from 'class-validator';
import {
	ID,
	ISearchFilter,
	ISearchSort,
	SearchFilterOperator,
	SearchMatchMode,
	SearchReindexScope,
	SearchSortDirection
} from '@gauzy/contracts';
import { SEARCH_SETTING_DEFAULTS } from '../search.settings';

/** Reads a numeric parameter, leaving an absent one absent. */
function toNumber(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);

	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Reads a boolean parameter, leaving an absent one absent. */
function toBoolean(value: unknown): boolean | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	return value === true || String(value).toLowerCase() === 'true';
}

/** Splits a comma-separated parameter into its members. */
function toList(value: unknown): string[] | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => String(entry));
	}

	return String(value)
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/**
 * One filter predicate as it arrives on the wire.
 *
 * The shape is the contract's, not a second copy of it: a filter names a declared field of the entity
 * it applies to, and the provider refuses one that names a field no declaration in scope provides.
 * That refusal is the point — a filter that silently matches nothing is indistinguishable from a
 * filter that is spelled wrong.
 */
export class SearchFilterDTO implements ISearchFilter {
	@ApiProperty({ type: () => String, example: 'status' })
	@IsString()
	@MaxLength(128)
	attribute: string;

	@ApiProperty({ enum: SearchFilterOperator, example: SearchFilterOperator.EQ })
	@IsEnum(SearchFilterOperator)
	operator: SearchFilterOperator;

	@ApiProperty({
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'array', items: {} }],
		example: 'ACTIVE'
	})
	value: string | number | boolean | Array<string | number>;

	@ApiPropertyOptional({ type: () => String, description: 'The entity the attribute belongs to.' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	entity?: string;
}

/**
 * How a result set is ordered.
 */
export class SearchSortDTO implements ISearchSort {
	@ApiPropertyOptional({ type: () => String, default: 'score' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	attribute: string;

	@ApiPropertyOptional({ enum: SearchSortDirection, default: SearchSortDirection.DESC })
	@IsOptional()
	@IsEnum(SearchSortDirection)
	direction: SearchSortDirection;
}

/**
 * A search request, as it arrives over REST.
 *
 * Every member is optional except the query itself, and the service refuses a request that carries
 * neither text nor a filter: a search with no question in it is an unbounded listing, which is what
 * the resource endpoints are for.
 */
export class SearchQueryDTO {
	@ApiPropertyOptional({ type: () => String, example: 'nordwind' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	q?: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Entity keys to search, comma separated. Empty means every entity the caller may see.'
	})
	@IsOptional()
	@Transform(({ value }) => toList(value))
	entities?: string[];

	@ApiPropertyOptional({ enum: SearchMatchMode, default: SearchMatchMode.ANY })
	@IsOptional()
	@IsEnum(SearchMatchMode)
	matchMode?: SearchMatchMode;

	@ApiPropertyOptional({ type: () => [SearchFilterDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SearchFilterDTO)
	filters?: SearchFilterDTO[];

	@ApiPropertyOptional({ type: () => String, description: 'Facet attribute names, comma separated.' })
	@IsOptional()
	@Transform(({ value }) => toList(value))
	facets?: string[];

	@ApiPropertyOptional({ type: () => SearchSortDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => SearchSortDTO)
	sort?: SearchSortDTO;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform(({ value }) => toNumber(value))
	skip?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: SEARCH_SETTING_DEFAULTS.resultPageSizeLimit })
	@IsOptional()
	@Min(1)
	@Max(SEARCH_SETTING_DEFAULTS.resultPageSizeLimit)
	@Transform(({ value }) => toNumber(value))
	take?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	channelId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	organizationId?: ID;
}

/**
 * A type-ahead request.
 */
export class SearchSuggestQueryDTO {
	@ApiProperty({ type: () => String, example: 'nor' })
	@IsString()
	@MaxLength(128)
	q: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Transform(({ value }) => toList(value))
	entities?: string[];

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: SEARCH_SETTING_DEFAULTS.suggestLimit })
	@IsOptional()
	@Min(1)
	@Max(SEARCH_SETTING_DEFAULTS.suggestLimit)
	@Transform(({ value }) => toNumber(value))
	limit?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	channelId?: ID;
}

/**
 * A facet request: the same question as a search, asked for its breakdown.
 */
export class SearchFacetQueryDTO extends SearchQueryDTO {
	@ApiProperty({ type: () => String, description: 'Facet attribute names, comma separated.' })
	@Transform(({ value }) => toList(value))
	facets: string[];
}

/**
 * What to rebuild.
 */
export class SearchReindexDTO {
	@ApiProperty({ enum: SearchReindexScope, example: SearchReindexScope.ALL })
	@IsEnum(SearchReindexScope)
	scope: SearchReindexScope;

	@ApiPropertyOptional({ type: () => String, description: 'Required for the entity scope.' })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	entity?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Required for the channel scope.' })
	@IsOptional()
	@IsString()
	channelId?: ID;

	@ApiPropertyOptional({ type: () => [String], description: 'Rebuild only these source ids.' })
	@IsOptional()
	@IsArray()
	ids?: ID[];

	@ApiPropertyOptional({ type: () => String, description: 'Rebuild only rows whose source moved after this moment.' })
	@IsOptional()
	@IsDateString()
	since?: string;
}

/**
 * What to drop.
 */
export class DropSearchIndexQueryDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	entity?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	channelId?: ID;
}

/**
 * One indexed field, as an operator may re-weight it.
 */
export class SearchIndexFieldDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(128)
	name: string;

	@ApiProperty({ type: () => String, description: 'TEXT, KEYWORD, NUMBER, DATE, BOOLEAN or ENTITY.' })
	@IsString()
	kind: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform(({ value }) => toNumber(value))
	weight?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }) => toBoolean(value))
	searchable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }) => toBoolean(value))
	filterable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }) => toBoolean(value))
	facetable?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	source?: string;
}

/**
 * How an operator re-weights a definition.
 *
 * The members an operator does *not* own are absent rather than ignored: the entity a declaration
 * describes, whether it is shipped, and the version its documents are stamped with are derived from
 * the declaration and from what changed, so a request that states them is not a request this surface
 * accepts.
 */
export class UpdateSearchIndexDefinitionDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	label?: string;

	@ApiPropertyOptional({ type: () => [SearchIndexFieldDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SearchIndexFieldDTO)
	fields?: SearchIndexFieldDTO[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	titleTemplate?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	bodyTemplate?: string;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	keywordFields?: string[];

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform(({ value }) => toNumber(value))
	defaultWeight?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	sourceUpdatedAtField?: string;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether the entity is indexed and queried.' })
	@IsOptional()
	@Transform(({ value }) => toBoolean(value))
	isActive?: boolean;
}

/**
 * The list filters of the definition collection.
 */
export class SearchIndexDefinitionQueryDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	entity?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }) => toBoolean(value))
	isActive?: boolean;
}

/**
 * The list filters of the index-status report.
 */
export class SearchIndexStatusQueryDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Transform(({ value }) => toList(value))
	entities?: string[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	channelId?: ID;
}
