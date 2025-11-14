import type { BaseEntityModel, ID, IUser, PluginStatus, PluginType } from '@gauzy/contracts';
import type { IPluginSetting } from './plugin-setting.model';
import type { IPluginSource } from './plugin-source.model';
import type {
	IPluginSubscriptionPlanCreateInput,
	IPluginSubscriptionPlanUpdateInput
} from './plugin-subscription.model';
import type { IPluginTag } from './plugin-tag.model';
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
	requiresSubscription?: boolean;
	version?: IPluginVersionUpdate;
	subscriptionPlans?: Array<IPluginSubscriptionPlanCreateInput | (IPluginSubscriptionPlanUpdateInput & { id: ID })>;
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
	requiresSubscription?: boolean; // Flag indicating if subscription plans are enable

	installed: boolean; // Flag indicating if the plugin is installed
	hasPlan: boolean; // Flag indicating if the plugin has at least one subscription plan
	downloadCount: number; // Number of times the plugin has been downloaded
	lastDownloadedAt?: Date; // Optional date when the plugin was last downloaded
	tenants?: IPluginTenant[]; // List of tenants using the plugin
	settings?: IPluginSetting[]; // List of global plugin settings
	pluginTags?: IPluginTag[]; // List of plugin-tag relationships for this plugin

	// Business Logic Methods
	isPublished(): boolean;
	getLatestVersion(): IPluginVersion | undefined;
	requiresPayment(): boolean;
	isUploadedBy(userId: ID): boolean;
	markAsDownloaded(): void;
	canBeActivated(): boolean;
	getTotalDownloadCount(): number;
	hasValidSubscriptionPlans(): boolean;
	validate(): { isValid: boolean; errors: string[] };
}

/**
 * Static methods interface for Plugin class
 */
export interface IPluginStatic {
	create(data: Partial<IPlugin>): IPlugin;
	createForPlatform(name: string, type: PluginType, description?: string): IPlugin;
	createDesktopPlugin(name: string, description?: string): IPlugin;
	createWebPlugin(name: string, description?: string): IPlugin;
	createMobilePlugin(name: string, description?: string): IPlugin;
	isValidName(name: string): boolean;
	isValidStatus(status: string): status is PluginStatus;
	isValidType(type: string): type is PluginType;
	getAvailableStatuses(): PluginStatus[];
	getAvailableTypes(): PluginType[];
	getPublishedStatuses(): PluginStatus[];
	compareName(a: IPlugin, b: IPlugin): number;
	compareUploadDate(a: IPlugin, b: IPlugin): number;
	compareDownloadCount(a: IPlugin, b: IPlugin): number;
	filterByStatus(plugins: IPlugin[], status: PluginStatus): IPlugin[];
	filterByType(plugins: IPlugin[], type: PluginType): IPlugin[];
	filterPublished(plugins: IPlugin[]): IPlugin[];
	filterPaid(plugins: IPlugin[]): IPlugin[];
	filterFree(plugins: IPlugin[]): IPlugin[];
	search(plugins: IPlugin[], query: string): IPlugin[];
	filterByUploader(plugins: IPlugin[], uploaderId: ID): IPlugin[];
	groupByType(plugins: IPlugin[]): Record<PluginType, IPlugin[]>;
	groupByStatus(plugins: IPlugin[]): Record<PluginStatus, IPlugin[]>;
	getStatistics(plugins: IPlugin[]): {
		total: number;
		published: number;
		byType: Record<PluginType, number>;
		byStatus: Record<PluginStatus, number>;
		paid: number;
		free: number;
		totalDownloads: number;
	};
}
