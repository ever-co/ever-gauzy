import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsIn, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Allowlist of columns that may appear in the SQL `ORDER BY` clause (prevents `sortBy` injection). */
export const PLUGIN_CATEGORY_SORTABLE_FIELDS = ['name', 'slug', 'order', 'createdAt', 'updatedAt'] as const;

/** Allowed SQL sort directions. */
export const PLUGIN_CATEGORY_SORT_DIRECTIONS = ['ASC', 'DESC'] as const;

export class PluginCategoryQueryDTO {
	@ApiPropertyOptional({
		description: 'Filter by category name',
		example: 'Authentication'
	})
	@IsOptional()
	@IsString()
	readonly name?: string;

	@ApiPropertyOptional({
		description: 'Filter by category slug',
		example: 'authentication'
	})
	@IsOptional()
	@IsString()
	readonly slug?: string;

	@ApiPropertyOptional({
		description: 'Filter by active status',
		example: true
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => value === 'true' || value === true)
	readonly isActive?: boolean;

	@ApiPropertyOptional({
		description: 'Filter by parent category ID',
		example: 'uuid-string'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Parent ID must be a valid UUID' })
	readonly parentId?: string;

	@ApiPropertyOptional({
		description: 'Page number for pagination',
		example: 1,
		minimum: 1
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Page must be a valid number' })
	@Min(1, { message: 'Page must be at least 1' })
	readonly page?: number;

	@ApiPropertyOptional({
		description: 'Number of items per page',
		example: 10,
		minimum: 1,
		maximum: 100
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Limit must be a valid number' })
	@Min(1, { message: 'Limit must be at least 1' })
	@Max(100, { message: 'Limit must not exceed 100' })
	readonly limit?: number;

	@ApiPropertyOptional({
		description: 'Sort field',
		example: 'name',
		enum: PLUGIN_CATEGORY_SORTABLE_FIELDS
	})
	@IsOptional()
	@IsIn(PLUGIN_CATEGORY_SORTABLE_FIELDS)
	readonly sortBy?: (typeof PLUGIN_CATEGORY_SORTABLE_FIELDS)[number];

	@ApiPropertyOptional({
		description: 'Sort direction',
		example: 'ASC',
		enum: PLUGIN_CATEGORY_SORT_DIRECTIONS
	})
	@IsOptional()
	// Normalize case so legacy clients sending `asc`/`desc` keep working, then enforce the allowlist.
	@Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
	@IsIn(PLUGIN_CATEGORY_SORT_DIRECTIONS)
	readonly sortDirection?: (typeof PLUGIN_CATEGORY_SORT_DIRECTIONS)[number];

	@ApiPropertyOptional({
		description: 'Relations to include',
		example: ['parent', 'children', 'plugins'],
		type: [String]
	})
	@IsOptional()
	readonly relations?: string[];
}
