import { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import { IPlugin } from './plugin.model';
import { IPluginTenant } from './plugin-tenant.model';
import { IPluginCategory } from './plugin-category.model';

export enum PluginSettingDataType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
	FILE = 'file'
}

/**
 * Interface for plugin settings
 */
export interface IPluginSetting extends IBasePerTenantAndOrganizationEntityModel {
	// Setting key/name
	key: string;

	// Setting value (stored as JSON object for flexibility)
	value: Record<string, any>;

	// Data type of the setting
	dataType: PluginSettingDataType;

	// Default value for the setting
	defaultValue?: string;

	// Whether the setting is required
	isRequired: boolean;

	// Whether the setting is encrypted/sensitive
	isEncrypted: boolean;

	// Setting description/help text
	description?: string;

	// Display order for UI
	order?: number;

	// The plugin this setting belongs to
	plugin: IPlugin;

	// Foreign key to the plugin
	pluginId: ID;

	// Optional plugin tenant relationship for tenant-specific settings
	pluginTenant?: IPluginTenant;

	// Foreign key to the plugin tenant
	pluginTenantId?: string;

	// Plugin Category relationship (for default category settings)
	category?: IPluginCategory;

	// Foreign key to the category
	categoryId?: string;
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
