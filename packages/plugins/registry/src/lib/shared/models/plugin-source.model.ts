import type {
	FileStorageProviderEnum,
	ID,
	PluginOSArch,
	PluginOSType,
	IPluginSource as PluginSourceModel,
	PluginSourceType
} from '@gauzy/contracts';

export interface IPluginSourceUpdate extends Partial<Omit<IPluginSource, 'storageProvider' | 'versions' | 'fullName'>> {
	id: ID;
}

export interface IPluginSource extends PluginSourceModel {
	// Storage
	storageProvider?: FileStorageProviderEnum;
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
