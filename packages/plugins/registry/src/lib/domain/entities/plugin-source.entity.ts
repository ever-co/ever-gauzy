import { FileStorageProviderEnum, ID, PluginOSArch, PluginOSType, PluginSourceType } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { MikroOrmPluginSourceRepository } from '../repositories/mikro-orm-plugin-source.repository';
import { PluginVersion } from './plugin-version.entity';

@MultiORMEntity('plugin_source', { mikroOrmRepository: () => MikroOrmPluginSourceRepository })
export class PluginSource extends TenantOrganizationBaseEntity implements IPluginSource {
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSourceType,
		default: PluginSourceType.GAUZY
	})
	@ApiProperty({ enum: PluginSourceType, description: 'Type of the plugin source' })
	@IsNotEmpty({ message: 'Plugin source type is required' })
	type: PluginSourceType;

	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginOSType,
		default: PluginOSType.UNIVERSAL
	})
	@ApiProperty({ enum: PluginOSType, description: 'Plugin Os type source' })
	@IsNotEmpty({ message: 'Operating system type is required' })
	operatingSystem: PluginOSType;

	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginOSArch,
		default: PluginOSArch.X64
	})
	@ApiProperty({ enum: PluginOSArch, description: 'Plugin Os type source architecture' })
	@IsNotEmpty({ message: 'Architecture type is required' })
	architecture: PluginOSArch;

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

	@ApiProperty({
		type: Boolean,
		description: 'Indicates if the package is private (requires NPM authentication token for access).',
		required: false,
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'private must be a boolean value' })
	@Transform(
		({ value }) => {
			if (value === 'true') return true;
			if (value === 'false') return false;
			return value;
		},
		{ toClassOnly: true }
	)
	@MultiORMColumn({ nullable: true, default: false })
	private?: boolean;

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

	@ApiProperty({ type: () => String, description: 'Plugin file identifier' })
	@IsOptional()
	@IsString({ message: 'File key must be a string' })
	@Matches(/^[\w-]+\.(zip)$/i, {
		message: 'File must be a valid ZIP format and contain only letters, numbers, and hyphens'
	})
	@MultiORMColumn({ nullable: true })
	fileKey?: string;

	@ApiProperty({ type: () => PluginVersion, description: 'Associated plugin version' })
	@MultiORMManyToOne(() => PluginVersion, (version) => version.sources, { onDelete: 'SET NULL' })
	@JoinColumn()
	version: IPluginVersion;

	@RelationId((source: PluginSource) => source.version)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	versionId?: ID;

	@ApiPropertyOptional({ enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum, { message: 'Invalid storage provider' })
	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: FileStorageProviderEnum })
	storageProvider?: FileStorageProviderEnum;

	// Computed property populated by PluginSourceSubscriber
	// Format varies by source type (e.g., "npm:package-name", "cdn:url", etc.)
	fullName?: string;
}
