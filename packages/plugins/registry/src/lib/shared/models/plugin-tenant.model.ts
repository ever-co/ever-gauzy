import { IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';
import { PluginScope } from './plugin-scope.model';
import { IPlugin } from './plugin.model';

export interface IPluginTenant extends IBasePerTenantAndOrganizationEntityModel {
	// The scope of the plugin (e.g., tenant, organization, user)
	scope: PluginScope;
	// Indicates whether the plugin is enabled for the tenant
	enabled: boolean;
	// The ID of the plugin
	pluginId: string;
	// The associated plugin entity
	plugin: IPlugin;
}
