/**
 * Base interface for tenant and organization-scoped entities
 */
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';
import { ITag } from './tag.model';

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
	version: string; // Semantic version
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
	// Core properties
	name: string; // Human-readable plugin name
	description?: string; // Brief description of plugin functionality
	type: PluginType; // Platform target
	status: PluginStatus; // Current lifecycle status
	versions: string[]; // Semantic version (following semver)

	// Source information
	source: ICDNSource | INPMSource | IGauzySource; // Distribution source

	// Security and integrity
	checksum?: string; // Verification hash
	signature?: string; // Digital signature for verification

	// Metadata
	author?: string; // Plugin author
	license?: string; // License type (e.g., MIT, GPL)
	homepage?: string; // Plugin documentation URL
	repository?: string; // Source code repository URL

	// Usage tracking
	uploadedBy?: IEmployee; // Employee who uploaded the plugin
	uploadedAt?: Date; // When the plugin was uploaded
	downloadCount: number; // Number of times downloaded/installed
	lastDownloadedAt?: Date; // Most recent download timestamp

	// Additional configuration
	tags?: ITag[]; // Categorization tags
}

/**
 * Interface for creating a new plugin
 */
export interface ICreatePlugin
	extends Omit<IPlugin, 'id' | 'downloadCount' | 'uploadedAt' | 'lastDownloadedAt' | 'versions'> {
	version: string;
}

/**
 * Interface for updating an existing plugin
 */
export interface IUpdatePlugin extends Partial<ICreatePlugin> {}
