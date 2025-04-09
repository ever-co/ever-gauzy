/**
 * Base interface for tenant and organization-scoped entities
 */
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { FileStorageProviderEnum } from './file-provider';

/**
 * Defines the possible states of a plugin
 */
export enum PluginStatus {
	ACTIVE = 'ACTIVE', // Plugin is available for use
	INACTIVE = 'INACTIVE', // Plugin is not available for use
	DEPRECATED = 'DEPRECATED', // Plugin is supported but will be removed in future
	ARCHIVED = 'ARCHIVED' // Plugin is no longer available for new installations
}

/**
 * Defines the supported platform targets for plugins
 */
export enum PluginType {
	DESKTOP = 'DESKTOP', // Native desktop application plugin
	WEB = 'WEB', // Browser-based plugin
	MOBILE = 'MOBILE' // Added mobile support
}

export enum PluginSourceType {
	CDN = 'CDN',
	NPM = 'NPM',
	GAUZY = 'GAUZY'
}

/**
 * Common interface for all source types
 */
export interface IPluginSource extends IBasePerTenantAndOrganizationEntityModel {
	type: PluginSourceType; // Discriminator field for the source type
}

/**
 * CDN-hosted plugin source configuration
 */
export interface ICDNSource extends IPluginSource {
	type: PluginSourceType.CDN;
	url: string; // URL to the plugin bundle
	integrity?: string; // SRI hash for security verification
	crossOrigin?: string; // CORS setting ('anonymous' | 'use-credentials')
}

/**
 * NPM-hosted plugin source configuration
 */
export interface INPMSource extends IPluginSource {
	type: PluginSourceType.NPM;
	name: string; // Package name
	registry?: string; // Optional custom NPM registry URL
	authToken?: string; // Optional auth token for private packages
	scope?: string; // Optional package scope (e.g., '@organization')
}

/**
 * Gauzy-hosted plugin source configuration
 */
export interface IGauzySource extends IPluginSource {
	type: PluginSourceType.GAUZY;
	url?: string; // URL to the plugin bundle
	file?: File; // File to upload
}

/**
 * Main plugin interface definition
 */
export interface IPlugin extends IBasePerTenantAndOrganizationEntityModel {
	name: string; // Plugin name
	description?: string; // Optional description
	type: PluginType; // Type of the plugin
	status: PluginStatus; // Status of the plugin
	versions: IPluginVersion[]; // List of plugin versions
	version?: IPluginVersion; // Current version

	installed: boolean; // Whether the plugin is currently installed

	author?: string; // Optional author information
	license?: string; // Optional license information
	homepage?: string; // Optional homepage URL
	repository?: string; // Optional repository URL

	uploadedBy?: IEmployee; // Employee who uploaded the plugin
	uploadedById?: ID; // ID reference for the employee who uploaded the plugin
	uploadedAt?: Date; // Optional date when the plugin was uploaded

	source?: IPluginSource; // Optional reference to the plugin's source

	downloadCount: number; // Number of times the plugin has been downloaded
	lastDownloadedAt?: Date; // Optional date when the plugin was last downloaded
}

/**
 * Interface for creating a new plugin
 */
export interface ICreatePlugin
	extends Omit<IPlugin, 'id' | 'downloadCount' | 'uploadedAt' | 'lastDownloadedAt' | 'versions'> {}

/**
 * Interface for updating an existing plugin
 */
export interface IUpdatePlugin extends Partial<ICreatePlugin> {}

export interface IPluginVersion extends IBasePerTenantAndOrganizationEntityModel {
	number: string; // SemVer formatted string
	changelog: string; // Description of changes in the version
	releaseDate?: Date; // Optional ISO 8601 formatted date
	downloadCount?: number; // Optional, defaults to 0
	source?: IPluginSource; // Optional reference to the plugin's source
	sourceId?: ID; // ID reference for the plugin's source

	plugin?: IPlugin; // Optional reference to plugin
	pluginId?: ID; // ID reference for plugin

	// Security and integrity
	checksum?: string; // Verification hash
	signature?: string; // Digital signature for verification
}

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

export enum PluginInstallationStatus {
	INSTALLED = 'INSTALLED',
	UNINSTALLED = 'UNINSTALLED',
	FAILED = 'FAILED',
	IN_PROGRESS = 'IN_PROGRESS'
}
/**
 * Plugin installation record
 */
export interface IPluginInstallation extends IBasePerTenantAndOrganizationEntityModel {
	plugin: IPlugin; // Installed plugin entity
	pluginId?: ID; // ID reference for the installed plugin

	version: IPluginVersion; // Installed version of the plugin
	versionId?: ID; // ID reference for the installed plugin version

	installedBy?: IEmployee; // Employee who installed the plugin
	installedById?: ID; // ID reference for the employee who installed the plugin

	installedAt?: Date; // Optional date when the plugin was installed
	uninstalledAt?: Date; // Optional date when the plugin was uninstalled

	status: PluginInstallationStatus; // Status of the plugin installation
}
