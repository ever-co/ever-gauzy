import { PluginStatus, PluginType } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { parseToBoolean } from '@gauzy/utils';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { IPlugin } from '../models';

/**
 * DTO for plugin search and filtering functionality
 */
export class PluginSearchFilterDTO extends PartialType(BaseQueryDTO<IPlugin>) {
	@ApiPropertyOptional({
		description: 'Search text to filter plugins by name, description, or author',
		example: 'time tracking'
	})
	@IsOptional()
	@IsString()
	readonly search?: string;

	@ApiPropertyOptional({
		description: 'Filter by plugin name (exact match)',
		example: 'Gauzy Time Tracker'
	})
	@IsOptional()
	@IsString()
	readonly name?: string;

	@ApiPropertyOptional({
		description: 'Filter by plugin description (partial match)',
		example: 'track time'
	})
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({
		description: 'Filter by plugin type',
		enum: PluginType,
		example: PluginType.DESKTOP
	})
	@IsOptional()
	@IsEnum(PluginType)
	readonly type?: PluginType;

	@ApiPropertyOptional({
		description: 'Filter by plugin status',
		enum: PluginStatus,
		example: PluginStatus.ACTIVE
	})
	@IsOptional()
	@IsEnum(PluginStatus)
	readonly status?: PluginStatus;

	@ApiPropertyOptional({
		description: 'Filter by active state',
		example: true
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => parseToBoolean(value))
	readonly isActive?: boolean;

	@ApiPropertyOptional({
		description: 'Filter by plugin category ID',
		example: 'uuid-string'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Category ID must be a valid UUID' })
	readonly categoryId?: string;

	@ApiPropertyOptional({
		description: 'Filter by plugin author',
		example: 'Gauzy Team'
	})
	@IsOptional()
	@IsString()
	readonly author?: string;

	@ApiPropertyOptional({
		description: 'Filter by plugin license',
		example: 'MIT'
	})
	@IsOptional()
	@IsString()
	readonly license?: string;

	@ApiPropertyOptional({
		description: 'Filter by user who uploaded the plugin',
		example: 'uuid-string'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Uploaded by ID must be a valid UUID' })
	readonly uploadedById?: string;

	@ApiPropertyOptional({
		description: 'Filter plugins uploaded after this date',
		example: '2024-01-01T00:00:00.000Z'
	})
	@IsOptional()
	readonly uploadedAfter?: Date;

	@ApiPropertyOptional({
		description: 'Filter plugins uploaded before this date',
		example: '2024-12-31T23:59:59.999Z'
	})
	@IsOptional()
	readonly uploadedBefore?: Date;

	@ApiPropertyOptional({
		description: 'Filter plugins downloaded after this date',
		example: '2024-01-01T00:00:00.000Z'
	})
	@IsOptional()
	readonly downloadedAfter?: Date;

	@ApiPropertyOptional({
		description: 'Filter plugins downloaded before this date',
		example: '2024-12-31T23:59:59.999Z'
	})
	@IsOptional()
	readonly downloadedBefore?: Date;

	@ApiPropertyOptional({
		description: 'Filter by minimum download count',
		example: 10,
		minimum: 0
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Minimum downloads must be a valid number' })
	@Min(0, { message: 'Minimum downloads must be at least 0' })
	readonly minDownloads?: number;

	@ApiPropertyOptional({
		description: 'Filter by maximum download count',
		example: 1000,
		minimum: 0
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Maximum downloads must be a valid number' })
	@Min(0, { message: 'Maximum downloads must be at least 0' })
	readonly maxDownloads?: number;

	@ApiPropertyOptional({
		description: 'Filter by version number',
		example: '1.0.0'
	})
	@IsOptional()
	@IsString()
	readonly version?: string;

	@ApiPropertyOptional({
		description: 'Filter by plugin tags',
		example: ['time-tracking', 'productivity'],
		type: [String]
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly tags?: string[];

	@ApiPropertyOptional({
		description: 'Include only plugins with installations',
		example: true
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => parseToBoolean(value))
	readonly hasInstallations?: boolean;

	@ApiPropertyOptional({
		description: 'Include only verified plugins',
		example: true
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => parseToBoolean(value))
	readonly isVerified?: boolean;

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
		enum: ['name', 'author', 'uploadedAt', 'lastDownloadedAt', 'downloadCount', 'createdAt', 'updatedAt']
	})
	@IsOptional()
	@IsString()
	readonly sortBy?:
		| 'name'
		| 'author'
		| 'uploadedAt'
		| 'lastDownloadedAt'
		| 'downloadCount'
		| 'createdAt'
		| 'updatedAt';

	@ApiPropertyOptional({
		description: 'Sort direction',
		example: 'ASC',
		enum: ['ASC', 'DESC']
	})
	@IsOptional()
	@IsString()
	readonly sortDirection?: 'ASC' | 'DESC';
}
