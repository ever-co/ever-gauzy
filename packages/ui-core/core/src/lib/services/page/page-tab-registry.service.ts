import { Injectable, Type } from '@angular/core';
import { TabsetRegistryId } from '../../common/component-registry.types';
import { IPageTabRegistry, PageTabRegistryConfig } from './page-tab-registry.types';

@Injectable({
	providedIn: 'root'
})
export class PageTabRegistryService implements IPageTabRegistry {
	/**
	 * Registry for storing page tab configurations.
	 *
	 * This Map stores arrays of PageTabRegistryConfig objects, keyed by TabsetRegistryId.
	 */
	private readonly registry = new Map<TabsetRegistryId, PageTabRegistryConfig[]>();

	/**
	 * Register a single page tab configuration.
	 *
	 * This method registers a new page tab configuration in the service's internal registry.
	 * It ensures that the configuration has a valid tabset property and checks if a tab
	 * with the same tabsetId already exists to prevent duplicate entries. If the configuration
	 * is valid and unique, it adds it to the registry.
	 *
	 * @param config The configuration for the page tab.
	 * @throws Will throw an error if the configuration does not have a location property.
	 * @throws Will throw an error if a tab with the same location has already been registered.
	 */
	public registerPageTab(config: PageTabRegistryConfig): void {
		// Check if the configuration has a location property
		if (!config.tabsetId) {
			throw new Error('Page tab configuration must have a tabsetId property');
		}

		config.order = config?.order ?? 0; // Set the default order to 0 if not provided
		config.hide = config?.hide ?? false; // Set the default hide to false if not provided
		config.responsive = config?.responsive ?? true; // Set the default responsive to true if not provided

		// Get all registered tabs for the specified location
		const tabs = this.registry.get(config.tabsetId) || [];

		// Check if a tab with the same location and path already exists
		const isMatchingTab = tabs.some(
			(tab: PageTabRegistryConfig) => tab.tabsetId === config.tabsetId && tab.tabId === config.tabId
		);

		// Check if a tab with the same location already exists
		if (isMatchingTab) {
			throw new Error(
				`A page with the tabsetId "${config.tabsetId}" and tabId "${config.tabId}" has already been registered`
			);
		}

		// Add the new tab configuration to the list of tabs for the specified location
		tabs.push(config);

		// Update the registry with the new list of tabs for the specified location
		this.registry.set(config.tabsetId, tabs);
	}

	/**
	 * Register multiple page tab configurations.
	 *
	 * This method registers multiple new page tab configurations in the service's internal registry.
	 * It ensures that each configuration has a valid tabset property and checks if a tab with the same
	 * tabsetId already exists to prevent duplicate entries. If the configurations are valid and unique,
	 * it adds them to the registry.
	 *
	 * @param configs The array of configurations for the page tabs.
	 * @throws Will throw an error if a tab with the same location and path has already been registered.
	 */
	public registerPageTabs(configs: PageTabRegistryConfig[]): void {
		configs.forEach((config: PageTabRegistryConfig) => this.registerPageTab(config));
	}

	/**
	 * Get all page tabs for a specified tabset, sorted by their order.
	 *
	 * This method retrieves the registered tabs for a given `tabsetId` from the registry,
	 * sorts them based on their `order` property, and returns the sorted array.
	 * If no tabs are registered for the specified `tabsetId`, it returns an empty array.
	 *
	 * @param tabsetId The identifier for the tabset.
	 * @returns An array of `PageTabRegistryConfig` objects, sorted by their `order` property.
	 */
	private getPageTabsByOrder(tabsetId: TabsetRegistryId): PageTabRegistryConfig[] {
		// Retrieve the tabs for the specified tabsetId from the registry
		const tabs = this.registry.get(tabsetId) || [];

		// If tabs exist, sort them by the 'order' property; otherwise, return an empty array
		return tabs?.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];
	}

	/**
	 * Get all unique page tabs for a specified tabset.
	 *
	 * @param tabsetId The identifier for the tabset.
	 * @returns An array of unique page tabs for the specified tabset.
	 */
	public getPageTabset(tabsetId: TabsetRegistryId): PageTabRegistryConfig[] {
		// Get all registered tabs for the specified tabset
		let tabs = this.getPageTabsByOrder(tabsetId);

		// Create a map to track unique tabs based on tabId
		const uniqueTabsMap = new Map<string, PageTabRegistryConfig>();

		// Iterate through tabs and add them to the map if not already present
		tabs.forEach((tab) => {
			if (!uniqueTabsMap.has(tab.tabId)) {
				uniqueTabsMap.set(tab.tabId, tab);
			}
		});

		// Convert the map values to an array
		return Array.from(uniqueTabsMap.values());
	}

	/**
	 * @description
	 *
	 * Retrieves the component associated with a specific tab id for a given tabset.
	 * @param location - The TabsetRegistryId to retrieve tabs for.
	 * @param tabId - The tab identifier.
	 * @returns The component associated with the tab id.
	 */
	public getComponentForTab(tabsetId: TabsetRegistryId, tabId: string): Type<any> | undefined {
		// Retrieve the tabs for the specified tabsetId
		const tabs = this.getPageTabset(tabsetId);
		// Find the tab with the specified tabId
		const tab = tabs.find((t) => t.tabId === tabId);
		// Return the component associated with the tab id or undefined if not found
		return tab?.component || undefined;
	}

	/**
	 * Clears the registry.
	 *
	 * This method clears all entries in the registry map, removing all stored page tab configurations.
	 */
	clear(): void {
		// Clear the registry
		this.registry.clear();
	}
}
