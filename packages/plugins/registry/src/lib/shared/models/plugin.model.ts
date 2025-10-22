import type { BaseEntityModel, ID, IUser, PluginStatus, PluginType } from '@gauzy/contracts';
import type { IPluginSetting } from './plugin-setting.model';
import type { IPluginSource } from './plugin-source.model';
import type { IPluginTenant } from './plugin-tenant.model';
import type { IPluginVersion, IPluginVersionUpdate } from './plugin-version.model';
// Re-export PluginBillingPeriod for external consumers (e.g., DTOs)
export { PluginBillingPeriod } from './plugin-subscription.model';

export enum PluginPricingType {
	FREE = 'free',
	ONE_TIME = 'one_time',
	SUBSCRIPTION = 'subscription',
	FREEMIUM = 'freemium',
	USAGE_BASED = 'usage_based'
}

export interface IPluginUpdate {
	id: ID;
	name?: string;
	description?: string;
	type?: PluginType;
	status?: PluginStatus;
	author?: string;
	license?: string;
	homepage?: string;
	repository?: string;
	version?: IPluginVersionUpdate;
}

export interface IPlugin extends BaseEntityModel {
	name: string; // Plugin name
	description?: string; // Optional description
	type: PluginType; // Type of the plugin
	status: PluginStatus; // Status of the plugin
	versions: IPluginVersion[]; // List of plugin versions
	version?: IPluginVersion; // Current version

	author?: string; // Optional author information
	license?: string; // Optional license information
	homepage?: string; // Optional homepage URL
	repository?: string; // Optional repository URL

	uploadedBy?: IUser; // User who uploaded the plugin
	uploadedById?: ID; // ID reference for the user who uploaded the plugin
	uploadedAt?: Date; // Optional date when the plugin was uploaded

	source?: IPluginSource; // Optional reference to the plugin's source

	installed: boolean; // Flag indicating if the plugin is installed
	downloadCount: number; // Number of times the plugin has been downloaded
	lastDownloadedAt?: Date; // Optional date when the plugin was last downloaded
	tenants?: IPluginTenant[]; // List of tenants using the plugin
	settings?: IPluginSetting[]; // List of global plugin settings
}
