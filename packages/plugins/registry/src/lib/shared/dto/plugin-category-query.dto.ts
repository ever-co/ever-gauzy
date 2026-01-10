import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
		enum: ['name', 'slug', 'order', 'createdAt', 'updatedAt']
	})
	@IsOptional()
	@IsString()
	readonly sortBy?: 'name' | 'slug' | 'order' | 'createdAt' | 'updatedAt';

	@ApiPropertyOptional({
		description: 'Sort direction',
		example: 'ASC',
		enum: ['ASC', 'DESC']
	})
	@IsOptional()
	@IsString()
	readonly sortDirection?: 'ASC' | 'DESC';

	@ApiPropertyOptional({
		description: 'Relations to include',
		example: ['parent', 'children', 'plugins'],
		type: [String]
	})
	@IsOptional()
	readonly relations?: string[];
}
