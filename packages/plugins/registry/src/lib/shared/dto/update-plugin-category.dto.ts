import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	IsOptional,
	IsUUID,
	IsNumber,
	IsBoolean,
	MaxLength,
	MinLength,
	Matches,
	Min,
	Max
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IPluginCategoryUpdateInput } from '../models';

export class UpdatePluginCategoryDTO implements IPluginCategoryUpdateInput {
	@ApiPropertyOptional({
		description: 'Category name',
		example: 'Authentication',
		minLength: 2,
		maxLength: 100
	})
	@IsOptional()
	@IsString()
	@MinLength(2, { message: 'Category name must be at least 2 characters long' })
	@MaxLength(100, { message: 'Category name must not exceed 100 characters' })
	@Transform(({ value }) => value?.trim())
	readonly name?: string;

	@ApiPropertyOptional({
		description: 'Category description',
		example: 'Plugins for authentication and authorization',
		maxLength: 500
	})
	@IsOptional()
	@IsString()
	@MaxLength(500, { message: 'Description must not exceed 500 characters' })
	@Transform(({ value }) => value?.trim())
	readonly description?: string;

	@ApiPropertyOptional({
		description: 'Category slug for URL-friendly identification',
		example: 'authentication',
		pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
	})
	@IsOptional()
	@IsString()
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: 'Slug must contain only lowercase letters, numbers, and hyphens'
	})
	@MaxLength(50, { message: 'Slug must not exceed 50 characters' })
	readonly slug?: string;

	@ApiPropertyOptional({
		description: 'Category color for UI representation',
		example: '#007bff',
		pattern: '^#[0-9a-fA-F]{6}$'
	})
	@IsOptional()
	@IsString()
	@Matches(/^#[0-9a-fA-F]{6}$/, {
		message: 'Color must be a valid hex color code (e.g., #007bff)'
	})
	readonly color?: string;

	@ApiPropertyOptional({
		description: 'Category icon identifier',
		example: 'fas fa-shield-alt',
		maxLength: 50
	})
	@IsOptional()
	@IsString()
	@MaxLength(50, { message: 'Icon must not exceed 50 characters' })
	readonly icon?: string;

	@ApiPropertyOptional({
		description: 'Display order for sorting',
		example: 1,
		minimum: 0,
		maximum: 9999
	})
	@IsOptional()
	@IsNumber({}, { message: 'Order must be a valid number' })
	@Min(0, { message: 'Order must be at least 0' })
	@Max(9999, { message: 'Order must not exceed 9999' })
	@Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
	readonly order?: number;

	@ApiPropertyOptional({
		description: 'Whether the category is active',
		example: true
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) =>
		value === 'true' || value === true || value === 'false' || value === false
			? value === 'true' || value === true
			: undefined
	)
	readonly isActive?: boolean;

	@ApiPropertyOptional({
		description: 'Parent category ID for hierarchical structure',
		example: 'uuid-string'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Parent ID must be a valid UUID' })
	readonly parentId?: string;
}
