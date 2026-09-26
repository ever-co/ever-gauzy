import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { parseToBoolean } from '@gauzy/utils';
import { API_QUERY_LIMITS } from '../../api/query-ast';

/**
 * The page parameters of the query protocol.
 *
 * `number` and `limit` are the offset style and are one-based, matching every list route the
 * platform already has. `after` and `before` are the cursor style. The two styles are mutually
 * exclusive and the pipe refuses a request that asks for both, rather than choosing one.
 */
export class ApiPageDTO {
	/**
	 * The one-based page number.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: API_QUERY_LIMITS.maxPageNumber })
	@IsOptional()
	@Min(1)
	@Max(API_QUERY_LIMITS.maxPageNumber)
	@Transform(({ value }) => toNumber(value))
	readonly number?: number;

	/**
	 * The page size.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: API_QUERY_LIMITS.maxPageSize })
	@IsOptional()
	@Min(1)
	@Max(API_QUERY_LIMITS.maxPageSize)
	@Transform(({ value }) => toNumber(value))
	readonly limit?: number;

	/**
	 * The cursor to resume after.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly after?: string;

	/**
	 * The cursor to resume before.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly before?: string;
}

/** Reads a numeric parameter, leaving an absent one absent. */
function toNumber(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The query protocol's parameters, as they arrive on the wire.
 *
 * This DTO is the *wire* contract and nothing more: every field is optional, every field is the
 * value the query string carried, and none of them is validated here beyond its own type. What a
 * value may contain depends on the resource being read — which fields may be filtered, which may be
 * sorted, how deep a filter may nest — so it is validated by the query pipe against the resource's
 * declared schema, where those answers live. A DTO that hard-coded them would be a second, weaker
 * copy of the declaration.
 *
 * The DTO is a sibling of the base query DTO, never a replacement. A route that has not adopted the
 * protocol keeps the base DTO and today's behaviour in full.
 */
export class ApiQueryDTO {
	/**
	 * Filter conditions, for example `filter[status][in]=CONFIRMED,PROCESSING` or
	 * `filter[customer.name][ilike]=%25nordwind%25`.
	 */
	@ApiPropertyOptional({
		type: Object,
		description:
			'Filter conditions. A field may name an operator, for example {"status":{"in":["CONFIRMED"]}}, or carry a value, which means equality. Boolean groups are $and and $or.'
	})
	@IsOptional()
	readonly filter?: Record<string, unknown>;

	/**
	 * Sort keys, for example `-createdAt,name`.
	 */
	@ApiPropertyOptional({ type: () => String, example: '-createdAt,name' })
	@IsOptional()
	readonly sort?: string;

	/**
	 * The page to read.
	 */
	@ApiPropertyOptional({ type: () => ApiPageDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ApiPageDTO)
	readonly page?: ApiPageDTO;

	/**
	 * Sparse fieldset, for example `id,title,lines.sku`.
	 */
	@ApiPropertyOptional({ type: () => String, example: 'id,title,customer.name' })
	@IsOptional()
	readonly fields?: string;

	/**
	 * Relations to expand, for example `customer,lines.variant`.
	 */
	@ApiPropertyOptional({ type: () => String, example: 'customer,lines.variant' })
	@IsOptional()
	readonly expand?: string;

	/**
	 * Free text over the resource's declared searchable fields.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly q?: string;

	/**
	 * Whether soft-deleted rows are included.
	 */
	@ApiPropertyOptional({ type: 'boolean', default: false })
	@IsOptional()
	@Transform(({ value }) => parseToBoolean(value))
	readonly withDeleted?: boolean;

	/**
	 * Response language for translatable resources.
	 */
	@ApiPropertyOptional({ type: () => String, example: 'de-DE' })
	@IsOptional()
	readonly locale?: string;

	/**
	 * Currency for prices and totals.
	 */
	@ApiPropertyOptional({ type: () => String, example: 'EUR' })
	@IsOptional()
	readonly currency?: string;

	/**
	 * The channel the request is scoped to.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly channelId?: string;

	/**
	 * The region the request is scoped to.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly regionId?: string;

	/**
	 * The legacy single-JSON parameter, kept so that existing callers keep working.
	 *
	 * @deprecated Use the protocol's own parameters. The alias is translated into them, and every
	 * response to a request that used it says so in `X-Deprecated-Param`.
	 */
	@ApiPropertyOptional({
		type: Object,
		deprecated: true,
		description: 'Deprecated. The historical { relations, findInput } payload, translated into the protocol.'
	})
	@IsOptional()
	readonly data?: Record<string, unknown>;
}
