import { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import { IPlugin } from './plugin.model';
import { IPluginTenant } from './plugin-tenant.model';

// Forward declaration to avoid circular dependency
interface IPluginCategory {
	id: string;
	name: string;
	slug: string;
}

/**
 * Interface for plugin settings
 */
export interface IPluginSetting extends IBasePerTenantAndOrganizationEntityModel {
	// Setting key/name
	key: string;

	// Setting value (stored as JSON string for flexibility)
	value: string;

	// Setting data type for validation
	dataType: PluginSettingDataType;

	// Whether the setting is required
	isRequired: boolean;

	// Whether the setting is encrypted/sensitive
	isEncrypted: boolean;

	// Default value for the setting
	defaultValue?: string;

	// Setting description/help text
	description?: string;

	// Setting category/group
	category?: string;

	// Display order for UI
	order?: number;

	// Validation rules (JSON string)
	validationRules?: string;

	// The plugin this setting belongs to
	plugin: IPlugin;
	pluginId: ID;

	// Optional plugin tenant relationship for tenant-specific settings
	pluginTenant?: IPluginTenant;
	pluginTenantId?: string;

	// Plugin Category relationship (for default category settings)
	pluginCategory?: IPluginCategory;
	pluginCategoryId?: string;
}

/**
 * Enum for plugin setting data types
 */
export enum PluginSettingDataType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
	ARRAY = 'array',
	DATE = 'date',
	EMAIL = 'email',
	URL = 'url',
	PASSWORD = 'password',
	FILE = 'file'
}

/**
 * Interface for creating plugin settings
 */
export interface IPluginSettingCreateInput
	extends Omit<IPluginSetting, 'id' | 'createdAt' | 'updatedAt' | 'plugin' | 'pluginTenant'> {
	pluginId: ID;
	pluginTenantId?: ID;
}

/**
 * Interface for updating plugin settings
 */
export interface IPluginSettingUpdateInput extends Partial<Omit<IPluginSettingCreateInput, 'pluginId'>> {}

/**
 * Interface for finding plugin settings
 */
export interface IPluginSettingFindInput
	extends Partial<Pick<IPluginSetting, 'key' | 'category' | 'pluginId' | 'pluginTenantId'>> {}
