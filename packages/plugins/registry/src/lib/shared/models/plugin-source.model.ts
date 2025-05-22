import {
	FileStorageProviderEnum,
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	PluginOSArch,
	PluginOSType,
	PluginSourceType
} from '@gauzy/contracts';
import { IPluginVersion } from './plugin-version.model';

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
}
