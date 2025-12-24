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
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { MikroOrmPluginSourceRepository } from '../repositories/mikro-orm-plugin-source.repository';
import { PluginVersion } from './plugin-version.entity';

@MultiORMEntity('plugin_sources', { mikroOrmRepository: () => MikroOrmPluginSourceRepository })
@Index(['versionId', 'operatingSystem', 'architecture', 'tenantId', 'organizationId'], { unique: true })
@Index(['tenantId', 'organizationId'])
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

	// Business Logic Methods

	/**
	 * Check if this is a CDN source
	 */
	public isCdnSource(): boolean {
		return this.type === PluginSourceType.CDN;
	}

	/**
	 * Check if this is an NPM source
	 */
	public isNpmSource(): boolean {
		return this.type === PluginSourceType.NPM;
	}

	/**
	 * Check if this is a Gauzy file upload source
	 */
	public isGauzySource(): boolean {
		return this.type === PluginSourceType.GAUZY;
	}

	/**
	 * Get the download URL based on source type
	 */
	public getDownloadUrl(): string | undefined {
		switch (this.type) {
			case PluginSourceType.CDN:
				return this.url;
			case PluginSourceType.NPM:
				return this.registry ? `${this.registry}/${this.name}` : undefined;
			case PluginSourceType.GAUZY:
				return this.filePath;
			default:
				return undefined;
		}
	}

	/**
	 * Get human-readable file size
	 */
	public getHumanReadableSize(): string {
		if (!this.fileSize) {
			return 'Unknown';
		}

		const units = ['B', 'KB', 'MB', 'GB'];
		let size = this.fileSize;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(2)} ${units[unitIndex]}`;
	}

	/**
	 * Check if the source supports the current platform
	 */
	public supportsCurrentPlatform(currentOS: PluginOSType, currentArch: PluginOSArch): boolean {
		if (this.operatingSystem === PluginOSType.UNIVERSAL) {
			return true;
		}

		return this.operatingSystem === currentOS && this.architecture === currentArch;
	}

	/**
	 * Check if file size is within allowed limits
	 */
	public isFileSizeValid(): boolean {
		if (!this.fileSize) {
			return true; // No file size restriction for non-file sources
		}

		const maxSize = 1073741824; // 1GB in bytes
		return this.fileSize <= maxSize && this.fileSize > 0;
	}

	/**
	 * Check if file name has valid extension
	 */
	public hasValidFileExtension(): boolean {
		if (!this.fileName) {
			return true; // No file name restriction for non-file sources
		}

		return this.fileName.endsWith('.zip');
	}

	/**
	 * Check if MIME type is valid
	 */
	public hasValidMimeType(): boolean {
		if (!this.mimeType) {
			return true; // No MIME type restriction for non-file sources
		}

		return this.mimeType === 'application/zip';
	}

	/**
	 * Generate display name for the source
	 */
	public getDisplayName(): string {
		switch (this.type) {
			case PluginSourceType.CDN:
				return `CDN: ${this.url}`;
			case PluginSourceType.NPM:
				return `NPM: ${this.scope ? `@${this.scope}/` : ''}${this.name}`;
			case PluginSourceType.GAUZY:
				return `File: ${this.fileName || 'Unknown'}`;
			default:
				return 'Unknown Source';
		}
	}

	/**
	 * Check if NPM source requires authentication
	 */
	public requiresNpmAuth(): boolean {
		return this.isNpmSource() && this.private === true;
	}

	/**
	 * Validate source data integrity
	 */
	public validate(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!this.type) {
			errors.push('Source type is required');
		}

		if (!this.operatingSystem) {
			errors.push('Operating system is required');
		}

		if (!this.architecture) {
			errors.push('Architecture is required');
		}

		// Validate based on source type
		switch (this.type) {
			case PluginSourceType.CDN:
				if (!this.url) {
					errors.push('URL is required for CDN sources');
				}
				break;
			case PluginSourceType.NPM:
				if (!this.name) {
					errors.push('Package name is required for NPM sources');
				}
				break;
			case PluginSourceType.GAUZY:
				if (!this.fileName) {
					errors.push('File name is required for Gauzy sources');
				}
				if (!this.hasValidFileExtension()) {
					errors.push('File must be a ZIP archive');
				}
				if (!this.hasValidMimeType()) {
					errors.push('MIME type must be application/zip');
				}
				if (!this.isFileSizeValid()) {
					errors.push('File size must be between 0 and 1GB');
				}
				break;
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	// Static Methods

	/**
	 * Create a new plugin source instance
	 */
	public static create(data: Partial<PluginSource>): PluginSource {
		const source = new PluginSource();
		Object.assign(source, {
			type: PluginSourceType.GAUZY,
			operatingSystem: PluginOSType.UNIVERSAL,
			architecture: PluginOSArch.X64,
			private: false,
			...data
		});
		return source;
	}

	/**
	 * Create a CDN source
	 */
	public static createCdnSource(
		url: string,
		operatingSystem: PluginOSType = PluginOSType.UNIVERSAL,
		architecture: PluginOSArch = PluginOSArch.X64,
		options?: { integrity?: string; crossOrigin?: string }
	): PluginSource {
		return this.create({
			type: PluginSourceType.CDN,
			url,
			operatingSystem,
			architecture,
			...options
		});
	}

	/**
	 * Create an NPM source
	 */
	public static createNpmSource(
		name: string,
		operatingSystem: PluginOSType = PluginOSType.UNIVERSAL,
		architecture: PluginOSArch = PluginOSArch.X64,
		options?: { registry?: string; scope?: string; private?: boolean }
	): PluginSource {
		return this.create({
			type: PluginSourceType.NPM,
			name,
			operatingSystem,
			architecture,
			...options
		});
	}

	/**
	 * Create a Gauzy file source
	 */
	public static createFileSource(
		fileName: string,
		filePath: string,
		fileSize: number,
		operatingSystem: PluginOSType = PluginOSType.UNIVERSAL,
		architecture: PluginOSArch = PluginOSArch.X64,
		options?: { mimeType?: string; fileKey?: string }
	): PluginSource {
		return this.create({
			type: PluginSourceType.GAUZY,
			fileName,
			filePath,
			fileSize,
			operatingSystem,
			architecture,
			mimeType: 'application/zip',
			...options
		});
	}

	/**
	 * Validate URL format
	 */
	public static isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Validate NPM package name
	 */
	public static isValidNpmName(name: string): boolean {
		if (!name || typeof name !== 'string') return false;
		// NPM package name rules: lowercase, can contain hyphens, dots, underscores
		return /^[a-z0-9._-]+$/.test(name) && name.length <= 214;
	}

	/**
	 * Validate file size
	 */
	public static isValidFileSize(size: number): boolean {
		return typeof size === 'number' && size > 0 && size <= 1073741824; // 1GB
	}

	/**
	 * Convert bytes to human readable format
	 */
	public static formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(2)} ${units[unitIndex]}`;
	}

	/**
	 * Filter sources by type
	 */
	public static filterByType(sources: PluginSource[], type: PluginSourceType): PluginSource[] {
		return sources.filter((source) => source.type === type);
	}

	/**
	 * Filter sources by operating system
	 */
	public static filterByOS(sources: PluginSource[], os: PluginOSType): PluginSource[] {
		return sources.filter(
			(source) => source.operatingSystem === os || source.operatingSystem === PluginOSType.UNIVERSAL
		);
	}

	/**
	 * Filter sources by architecture
	 */
	public static filterByArchitecture(sources: PluginSource[], arch: PluginOSArch): PluginSource[] {
		return sources.filter(
			(source) => source.architecture === arch || source.operatingSystem === PluginOSType.UNIVERSAL
		);
	}

	/**
	 * Filter sources by platform (OS and architecture)
	 */
	public static filterByPlatform(sources: PluginSource[], os: PluginOSType, arch: PluginOSArch): PluginSource[] {
		return sources.filter((source) => source.supportsCurrentPlatform(os, arch));
	}

	/**
	 * Get CDN sources only
	 */
	public static getCdnSources(sources: PluginSource[]): PluginSource[] {
		return this.filterByType(sources, PluginSourceType.CDN);
	}

	/**
	 * Get NPM sources only
	 */
	public static getNpmSources(sources: PluginSource[]): PluginSource[] {
		return this.filterByType(sources, PluginSourceType.NPM);
	}

	/**
	 * Get Gauzy file sources only
	 */
	public static getFileSources(sources: PluginSource[]): PluginSource[] {
		return this.filterByType(sources, PluginSourceType.GAUZY);
	}

	/**
	 * Group sources by type
	 */
	public static groupByType(sources: PluginSource[]): Record<PluginSourceType, PluginSource[]> {
		const groups = Object.values(PluginSourceType).reduce((acc, type) => {
			acc[type] = [];
			return acc;
		}, {} as Record<PluginSourceType, PluginSource[]>);

		sources.forEach((source) => {
			if (groups[source.type]) {
				groups[source.type].push(source);
			}
		});

		return groups;
	}

	/**
	 * Get source statistics
	 */
	public static getStatistics(sources: PluginSource[]): {
		total: number;
		byType: Record<PluginSourceType, number>;
		byOS: Record<PluginOSType, number>;
		byArch: Record<PluginOSArch, number>;
		totalSize: number;
	} {
		const stats = {
			total: sources.length,
			byType: Object.values(PluginSourceType).reduce(
				(acc, type) => ({ ...acc, [type]: 0 }),
				{} as Record<PluginSourceType, number>
			),
			byOS: Object.values(PluginOSType).reduce(
				(acc, os) => ({ ...acc, [os]: 0 }),
				{} as Record<PluginOSType, number>
			),
			byArch: Object.values(PluginOSArch).reduce(
				(acc, arch) => ({ ...acc, [arch]: 0 }),
				{} as Record<PluginOSArch, number>
			),
			totalSize: 0
		};

		sources.forEach((source) => {
			stats.byType[source.type]++;
			stats.byOS[source.operatingSystem]++;
			stats.byArch[source.architecture]++;
			stats.totalSize += source.fileSize || 0;
		});

		return stats;
	}
}
