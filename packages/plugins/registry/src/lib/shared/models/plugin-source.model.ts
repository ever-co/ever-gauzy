import type {
	FileStorageProviderEnum,
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	PluginOSArch,
	PluginOSType,
	PluginSourceType
} from '@gauzy/contracts';
import type { IPluginVersion } from './plugin-version.model';

export interface IPluginSourceUpdate extends Partial<Omit<IPluginSource, 'storageProvider' | 'versions' | 'fullName'>> {
	id: ID;
}

export interface IPluginSource extends IBasePerTenantAndOrganizationEntityModel {
	type: PluginSourceType; // Type of the plugin source (CDN, NPM, File Upload)
	operatingSystem: PluginOSType; // Operating system type
	architecture: PluginOSArch; // CPU architecture
	fullName?: string; // Full name of the plugin source

	// CDN Source
	url?: string; // URL of the plugin source
	integrity?: string; // Integrity hash for the CDN source
	crossOrigin?: string; // Cross-origin policy for the CDN source

	// NPM Source
	name?: string; // NPM package name
	registry?: string; // NPM registry URL
	private?: boolean; // NPM authentication token
	scope?: string; // NPM scope

	// File Upload (Gauzy source)
	filePath?: string; // Path to the uploaded plugin file
	fileName?: string; // Name of the uploaded plugin file (must end with `.zip`)
	fileSize?: number; // File size in bytes (max 1GB)
	mimeType?: string; // Must be `application/zip`
	fileKey?: string; // Unique key for the uploaded file

	// Storage
	storageProvider?: FileStorageProviderEnum;

	// Associated version
	version: IPluginVersion; // Associated plugin version
	versionId?: ID; // Associated plugin version ID

	// Business Logic Methods
	isCdnSource(): boolean;
	isNpmSource(): boolean;
	isGauzySource(): boolean;
	getDownloadUrl(): string | undefined;
	getHumanReadableSize(): string;
	supportsCurrentPlatform(currentOS: PluginOSType, currentArch: PluginOSArch): boolean;
	isFileSizeValid(): boolean;
	hasValidFileExtension(): boolean;
	hasValidMimeType(): boolean;
	getDisplayName(): string;
	requiresNpmAuth(): boolean;
	validate(): { isValid: boolean; errors: string[] };
}

/**
 * Static methods interface for PluginSource class
 */
export interface IPluginSourceStatic {
	create(data: Partial<IPluginSource>): IPluginSource;
	createCdnSource(
		url: string,
		operatingSystem?: PluginOSType,
		architecture?: PluginOSArch,
		options?: { integrity?: string; crossOrigin?: string }
	): IPluginSource;
	createNpmSource(
		name: string,
		operatingSystem?: PluginOSType,
		architecture?: PluginOSArch,
		options?: { registry?: string; scope?: string; private?: boolean }
	): IPluginSource;
	createFileSource(
		fileName: string,
		filePath: string,
		fileSize: number,
		operatingSystem?: PluginOSType,
		architecture?: PluginOSArch,
		options?: { mimeType?: string; fileKey?: string }
	): IPluginSource;
	isValidUrl(url: string): boolean;
	isValidNpmName(name: string): boolean;
	isValidFileSize(size: number): boolean;
	formatFileSize(bytes: number): string;
	filterByType(sources: IPluginSource[], type: PluginSourceType): IPluginSource[];
	filterByOS(sources: IPluginSource[], os: PluginOSType): IPluginSource[];
	filterByArchitecture(sources: IPluginSource[], arch: PluginOSArch): IPluginSource[];
	filterByPlatform(sources: IPluginSource[], os: PluginOSType, arch: PluginOSArch): IPluginSource[];
	getCdnSources(sources: IPluginSource[]): IPluginSource[];
	getNpmSources(sources: IPluginSource[]): IPluginSource[];
	getFileSources(sources: IPluginSource[]): IPluginSource[];
	groupByType(sources: IPluginSource[]): Record<PluginSourceType, IPluginSource[]>;
	getCurrentPlatform(): { os: PluginOSType; arch: PluginOSArch };
	findBestSourceForPlatform(sources: IPluginSource[]): IPluginSource | undefined;
	getStatistics(sources: IPluginSource[]): {
		total: number;
		byType: Record<PluginSourceType, number>;
		byOS: Record<PluginOSType, number>;
		byArch: Record<PluginOSArch, number>;
		totalSize: number;
	};
}
