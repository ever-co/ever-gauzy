import { ID, IPluginSetting as PluginSettingModel } from '@gauzy/contracts';

/**
 * Interface for plugin settings
 */
export interface IPluginSetting extends PluginSettingModel {}

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
