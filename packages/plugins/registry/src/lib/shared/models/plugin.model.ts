import type { ID, PluginStatus, PluginType } from '@gauzy/contracts';
import { IPlugin as PluginModel } from '@gauzy/contracts';
import type {
	IPluginSubscriptionPlanCreateInput,
	IPluginSubscriptionPlanUpdateInput
} from './plugin-subscription.model';
import type { IPluginVersion, IPluginVersionUpdate } from './plugin-version.model';

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

export interface IPlugin extends PluginModel {
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
