import { PluginSourceType } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, Matches } from 'class-validator';
import { MikroOrmPluginSourceRepository } from '../repositories/mikro-orm-plugin-source-repository';

@MultiORMEntity('plugin_source', { mikroOrmRepository: () => MikroOrmPluginSourceRepository })
export class PluginSource extends TenantOrganizationBaseEntity {
	@MultiORMColumn({
		type: 'enum',
		enum: PluginSourceType
	})
	@ApiProperty({ enum: PluginSourceType, description: 'Type of the plugin source' })
	@IsNotEmpty({ message: 'Plugin source type is required' })
	type: PluginSourceType;

	// For CDN sources
	@ApiProperty({ type: String, description: 'URL of the plugin source (CDN)' })
	@IsOptional()
	@IsString({ message: 'URL must be a string' })
	@MultiORMColumn({ nullable: true })
	url?: string;

	@ApiProperty({ type: String, description: 'Integrity hash for the CDN source' })
	@IsOptional()
	@IsString({ message: 'Integrity hash must be a string' })
	@MultiORMColumn({ nullable: true })
	integrity?: string;

	@ApiProperty({ type: String, description: 'Cross-origin policy for the CDN source' })
	@IsOptional()
	@IsString({ message: 'Cross-origin policy must be a string' })
	@MultiORMColumn({ nullable: true })
	crossOrigin?: string;

	// For NPM sources
	@ApiProperty({ type: String, description: 'NPM package name' })
	@IsOptional()
	@IsString({ message: 'Package name must be a string' })
	@MultiORMColumn({ nullable: true })
	name?: string;

	@ApiProperty({ type: String, description: 'NPM registry URL' })
	@IsOptional()
	@IsString({ message: 'Registry URL must be a string' })
	@MultiORMColumn({ nullable: true })
	registry?: string;

	@ApiProperty({ type: String, description: 'NPM authentication token (if required)' })
	@IsOptional()
	@IsString({ message: 'Authentication token must be a string' })
	@MultiORMColumn({ nullable: true })
	authToken?: string;

	@ApiProperty({ type: String, description: 'NPM scope (if applicable)' })
	@IsOptional()
	@IsString({ message: 'Scope must be a string' })
	@MultiORMColumn({ nullable: true })
	scope?: string;

	// For file uploads (Gauzy sources)
	@ApiProperty({ type: String, description: 'File path for uploaded plugin' })
	@IsOptional()
	@IsString({ message: 'File path must be a string' })
	@MultiORMColumn({ nullable: true })
	filePath?: string;

	@ApiProperty({ type: String, description: 'File name of the uploaded plugin' })
	@IsOptional()
	@IsString({ message: 'File name must be a string' })
	@Matches(/\.zip$/, { message: 'File name must end with .zip' })
	@MultiORMColumn({ nullable: true })
	fileName?: string;

	@ApiProperty({ type: Number, description: 'File size of the uploaded plugin (in bytes)' })
	@IsOptional()
	@IsNumber({}, { message: 'Size must be a number' })
	@Min(0, { message: 'Size must be greater than or equal to 0' })
	@Max(1073741824, { message: 'Size cannot exceed 1GB (1073741824 bytes)' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@IsNumber({}, { message: 'File size must be a number' })
	@MultiORMColumn({ nullable: true })
	fileSize?: number;

	@ApiProperty({ type: String, description: 'MIME type of the uploaded plugin file' })
	@IsOptional()
	@IsString({ message: 'MIME type must be a string' })
	@Matches(/^application\/zip$/, { message: 'MIME type must be application/zip' })
	@MultiORMColumn({ nullable: true })
	mimeType?: string;
}
