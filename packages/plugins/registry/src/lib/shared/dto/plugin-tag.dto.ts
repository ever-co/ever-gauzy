import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMinSize,
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsUUID,
    Max,
    Min
} from 'class-validator';
import {
    IPluginTagBulkCreateInput,
    IPluginTagBulkDeleteInput,
    IPluginTagCreateInput,
    IPluginTagFindInput,
    IPluginTagUpdateInput,
    IPluginsByTagsQuery,
    ITagsByPluginsQuery
} from '../models/plugin-tag.model';

/**
 * Data Transfer Object for creating plugin-tag relationships
 */
export class CreatePluginTagDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
	implements IPluginTagCreateInput
{
	@ApiProperty({
		type: String,
		description: 'Plugin ID to associate with the tag',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	readonly pluginId: ID;

	@ApiProperty({
		type: String,
		description: 'Tag ID to associate with the plugin',
		format: 'uuid',
		example: '987fcdeb-51a2-43d1-9f4e-123456789abc'
	})
	@IsNotEmpty({ message: 'Tag ID is required' })
	@IsUUID(4, { message: 'Tag ID must be a valid UUID' })
	readonly tagId: ID;
}

/**
 * Data Transfer Object for updating plugin-tag relationships
 */
export class UpdatePluginTagDTO
	extends PartialType(CreatePluginTagDTO)
	implements IPluginTagUpdateInput
{
	@ApiPropertyOptional({
		type: Number,
		description: 'Priority or weight of this tag association',
		minimum: 0,
		maximum: 100,
		example: 75
	})
	@IsOptional()
	@IsNumber({}, { message: 'Priority must be a number' })
	@Min(0, { message: 'Priority must be at least 0' })
	@Max(100, { message: 'Priority must be at most 100' })
	@Type(() => Number)
	readonly priority?: number;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether this tag association is featured',
		example: false
	})
	@IsOptional()
	@IsBoolean({ message: 'Is featured must be a boolean' })
	@Transform(({ value }) => value === 'true' || value === true)
	readonly isFeatured?: boolean;
}

/**
 * Data Transfer Object for finding plugin-tag relationships
 */
export class FindPluginTagDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
	implements IPluginTagFindInput
{
	@ApiPropertyOptional({
		type: String,
		description: 'Filter by plugin ID',
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	readonly pluginId?: ID;

	@ApiPropertyOptional({
		type: String,
		description: 'Filter by tag ID',
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Tag ID must be a valid UUID' })
	readonly tagId?: ID;

	@ApiPropertyOptional({
		type: [String],
		description: 'Filter by multiple plugin IDs',
		example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-9f4e-123456789abc']
	})
	@IsOptional()
	@IsArray({ message: 'Plugin IDs must be an array' })
	@IsUUID(4, { each: true, message: 'Each plugin ID must be a valid UUID' })
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	readonly pluginIds?: ID[];

	@ApiPropertyOptional({
		type: [String],
		description: 'Filter by multiple tag IDs',
		example: ['456e7890-f12b-34c5-d678-901234567def', 'abc12345-6789-def0-1234-56789abcdef0']
	})
	@IsOptional()
	@IsArray({ message: 'Tag IDs must be an array' })
	@IsUUID(4, { each: true, message: 'Each tag ID must be a valid UUID' })
	@Transform(({ value }) => Array.isArray(value) ? value : [value])
	readonly tagIds?: ID[];
}

/**
 * Data Transfer Object for bulk creating plugin-tag relationships
 */
export class BulkCreatePluginTagDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
	implements IPluginTagBulkCreateInput
{
	@ApiProperty({
		type: String,
		description: 'Plugin ID to associate with multiple tags',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	readonly pluginId: ID;

	@ApiProperty({
		type: [String],
		description: 'Array of tag IDs to associate with the plugin',
		example: ['456e7890-f12b-34c5-d678-901234567def', 'abc12345-6789-def0-1234-56789abcdef0']
	})
	@IsNotEmpty({ message: 'Tag IDs are required' })
	@IsArray({ message: 'Tag IDs must be an array' })
	@ArrayNotEmpty({ message: 'Tag IDs array cannot be empty' })
	@ArrayMinSize(1, { message: 'At least one tag ID is required' })
	@IsUUID(4, { each: true, message: 'Each tag ID must be a valid UUID' })
	readonly tagIds: ID[];
}

/**
 * Data Transfer Object for bulk deleting plugin-tag relationships
 */
export class BulkDeletePluginTagDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
	implements IPluginTagBulkDeleteInput
{
	@ApiPropertyOptional({
		type: String,
		description: 'Plugin ID to remove tags from',
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	readonly pluginId?: ID;

	@ApiPropertyOptional({
		type: String,
		description: 'Tag ID to remove from plugins',
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Tag ID must be a valid UUID' })
	readonly tagId?: ID;

	@ApiPropertyOptional({
		type: [String],
		description: 'Specific plugin-tag relationship IDs to delete',
		example: ['rel123-456-789', 'rel987-654-321']
	})
	@IsOptional()
	@IsArray({ message: 'IDs must be an array' })
	@IsUUID(4, { each: true, message: 'Each ID must be a valid UUID' })
	readonly ids?: ID[];

	@ApiPropertyOptional({
		type: [String],
		description: 'Tag IDs to disassociate from a plugin',
		example: ['tag123-456-789', 'tag987-654-321']
	})
	@IsOptional()
	@IsArray({ message: 'Tag IDs must be an array' })
	@IsUUID(4, { each: true, message: 'Each tag ID must be a valid UUID' })
	readonly tagIds?: ID[];
}

/**
 * Data Transfer Object for finding plugins by tags
 */
export class FindPluginsByTagsDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
	implements IPluginsByTagsQuery
{
	@ApiProperty({
		type: [String],
		description: 'Array of tag IDs to filter plugins by',
		example: ['tag123-456-789', 'tag987-654-321']
	})
	@IsNotEmpty({ message: 'Tag IDs are required' })
	@IsArray({ message: 'Tag IDs must be an array' })
	@ArrayNotEmpty({ message: 'Tag IDs array cannot be empty' })
	@IsUUID(4, { each: true, message: 'Each tag ID must be a valid UUID' })
	readonly tagIds: ID[];

	@ApiPropertyOptional({
		enum: ['any', 'all'],
		description: 'Match type - "any" for plugins with any of the tags, "all" for plugins with all tags',
		example: 'any',
		default: 'any'
	})
	@IsOptional()
	@IsEnum(['any', 'all'], { message: 'Match type must be "any" or "all"' })
	readonly matchType?: 'any' | 'all';

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Include tag information in the response',
		example: false,
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'Include tags must be a boolean' })
	@Transform(({ value }) => value === 'true' || value === true)
	readonly includeTags?: boolean;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Include plugin details in the response',
		example: true,
		default: true
	})
	@IsOptional()
	@IsBoolean({ message: 'Include plugin details must be a boolean' })
	@Transform(({ value }) => value === 'true' || value === true)
	readonly includePluginDetails?: boolean;
}

/**
 * Data Transfer Object for finding tags by plugins
 */
export class FindTagsByPluginsDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
	implements ITagsByPluginsQuery
{
	@ApiProperty({
		type: [String],
		description: 'Array of plugin IDs to filter tags by',
		example: ['plugin123-456-789', 'plugin987-654-321']
	})
	@IsNotEmpty({ message: 'Plugin IDs are required' })
	@IsArray({ message: 'Plugin IDs must be an array' })
	@ArrayNotEmpty({ message: 'Plugin IDs array cannot be empty' })
	@IsUUID(4, { each: true, message: 'Each plugin ID must be a valid UUID' })
	readonly pluginIds: ID[];

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Include plugin information in the response',
		example: false,
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'Include plugins must be a boolean' })
	@Transform(({ value }) => value === 'true' || value === true)
	readonly includePlugins?: boolean;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Include tag statistics (usage count, etc.)',
		example: false,
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'Include statistics must be a boolean' })
	@Transform(({ value }) => value === 'true' || value === true)
	readonly includeStatistics?: boolean;
}

/**
 * Data Transfer Object for replacing all tags for a plugin
 */
export class ReplacePluginTagsDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO)
	)
{
	@ApiProperty({
		type: [String],
		description: 'New array of tag IDs to associate with the plugin (replaces all existing tags)',
		example: ['tag123-456-789', 'tag987-654-321']
	})
	@IsArray({ message: 'Tag IDs must be an array' })
	@IsUUID(4, { each: true, message: 'Each tag ID must be a valid UUID' })
	readonly tagIds: ID[];
}
