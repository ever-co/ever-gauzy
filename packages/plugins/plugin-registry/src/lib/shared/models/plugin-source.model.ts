import {
	FileStorageProviderEnum,
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	PluginSourceType
} from '@gauzy/contracts';
import { IPlugin } from './plugin.model';

export interface IPluginSource extends IBasePerTenantAndOrganizationEntityModel {
	type: PluginSourceType; // Type of the plugin source (CDN, NPM, File Upload)

	// CDN Source
	url?: string; // URL of the plugin source
	integrity?: string; // Integrity hash for the CDN source
	crossOrigin?: string; // Cross-origin policy for the CDN source

	// NPM Source
	name?: string; // NPM package name
	registry?: string; // NPM registry URL
	authToken?: string; // NPM authentication token
	scope?: string; // NPM scope

	// File Upload (Gauzy source)
	filePath?: string; // Path to the uploaded plugin file
	fileName?: string; // Name of the uploaded plugin file (must end with `.zip`)
	fileSize?: number; // File size in bytes (max 1GB)
	mimeType?: string; // Must be `application/zip`
	fileKey?: string; // Unique key for the uploaded file

	// Storage
	storageProvider?: FileStorageProviderEnum;

	// Associated Plugin
	plugin?: IPlugin; // Associated plugin entity
	pluginId?: ID; // ID of the associated plugin
}
