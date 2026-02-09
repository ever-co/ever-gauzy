import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination, IPlugin, PluginSubscriptionStatus } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { map, Observable } from 'rxjs';

/**
 * Interface for subscribed plugin with subscription details
 */
export interface ISubscribedPlugin {
	plugin: IPlugin;
	subscriptionId: string;
	status: PluginSubscriptionStatus;
	/** Whether the plugin can be auto-installed without user interaction */
	canAutoInstall?: boolean;
	/** Whether the plugin is mandatory for the tenant/organization */
	isMandatory?: boolean;
}

/**
 * Query parameters for fetching subscribed plugins
 */
export interface ISubscribedPluginsQueryParams {
	status?: PluginSubscriptionStatus;
	skip?: number;
	take?: number;
	relations?: string[];
}

/**
 * Service to fetch plugins that the current user has subscribed to
 */
@Injectable({
	providedIn: 'root'
})
export class UserSubscribedPluginsService {
	private readonly endPoint = `${API_PREFIX}/plugins/subscriptions/me`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Get all plugins where the current user has an active subscription
	 * @param params Query parameters for filtering and pagination
	 * @returns Observable of paginated plugin results
	 */
	public getSubscribedPluginsPaginated(params: ISubscribedPluginsQueryParams = {}): Observable<IPagination<IPlugin>> {
		const queryParams = {
			...params,
			relations: params.relations?.join(',')
		};

		return this.http.get<IPagination<IPlugin>>(this.endPoint, {
			params: toParams(queryParams)
		});
	}

	/**
	 * Get all subscribed plugins as a flat array with subscription info
	 * @param params Query parameters for filtering
	 * @returns Observable of subscribed plugins with subscription details
	 */
	public getSubscribedPlugins(
		params: ISubscribedPluginsQueryParams = {}
	): Observable<IPagination<ISubscribedPlugin>> {
		const defaultParams: ISubscribedPluginsQueryParams = {
			take: 10, // Get a reasonable batch
			relations: ['version', 'version.sources', 'pluginTenant'],
			...params
		};

		return this.getSubscribedPluginsPaginated(defaultParams).pipe(
			map((response) => {
				if (!response?.items) {
					return { total: 0, items: [] };
				}

				return {
					total: response.total,
					items: response.items.map((plugin) => {
						// Extract pluginTenant info from the first subscription if available
						const subscription = plugin.subscriptions?.[0];
						const pluginTenant = subscription?.pluginTenant;

						return {
							plugin,
							subscriptionId: subscription?.id,
							status: subscription?.status || PluginSubscriptionStatus.SUSPENDED,
							// Check if plugin can be auto-installed (from pluginTenant configuration)
							canAutoInstall: pluginTenant?.autoInstall === true && pluginTenant?.enabled === true,
							// Check if plugin is mandatory for the tenant/organization
							isMandatory: pluginTenant?.isMandatory === true
						};
					})
				};
			})
		);
	}

	/**
	 * Get count of subscribed plugins
	 * @param params Query parameters for filtering
	 * @returns Observable of total count
	 */
	public getSubscribedPluginsCount(params: ISubscribedPluginsQueryParams = {}): Observable<number> {
		return this.getSubscribedPluginsPaginated({ ...params, take: 1 }).pipe(map((response) => response?.total || 0));
	}

	/**
	 * Check if user has any active subscriptions
	 * @returns Observable of boolean indicating if user has subscriptions
	 */
	public hasActiveSubscriptions(): Observable<boolean> {
		return this.getSubscribedPluginsCount({
			status: PluginSubscriptionStatus.ACTIVE
		}).pipe(map((count) => count > 0));
	}
}
