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
	 * Retrieves the current tab registry.
	 *
	 * This method returns the internal map that stores the page tab configurations,
	 * keyed by their tabset identifiers.
	 *
	 * @returns A Map where the keys are tabset identifiers and the values are arrays
	 *          of page tab configurations associated with each tabset.
	 */
	public getRegistry(): Map<TabsetRegistryId, PageTabRegistryConfig[]> {
		return this.registry;
	}

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

		// Call addPageTab to handle the addition or update of the tab
		this.addPageTab(config, config.tabsetId);
	}

	/**
	 * Adds a new page tab to the specified tab set.
	 *
	 * @param config The configuration object representing the new tab to add.
	 * @param tabsetId The identifier of the tab set to which the new tab should be added.
	 */
	public addPageTab(config: PageTabRegistryConfig, tabsetId: TabsetRegistryId): void {
		// Check if the configuration has a location property
		if (!config.tabsetId) {
			throw new Error('Page tab configuration must have a tabsetId property');
		}

		// Get the list of tabs for the specified tab set from the registry, or initialize as an empty array if not found
		const tabs = this.registry.get(tabsetId) || [];

		// Ensure config is defined before accessing its properties
		config.order = config.order ?? 0; // Set the default order to 0 if not provided
		config.hide = config.hide ?? false; // Set the default hide to false if not provided
		config.responsive = config.responsive ?? true; // Set the default responsive to true if not provided

		// Find the index of an existing tab with the same tabId in the specified tab set
		const existing = tabs.findIndex((tab) => tab.tabId === config.tabId);

		if (existing !== -1) {
			// If the tab exists, replace it with the new configuration
			tabs[existing] = config;
		} else {
			// If the tab does not exist, add the new tab configuration to the list
			tabs.push(config);
		}

		// Update the registry with the modified list of tabs for the specified tabset
		this.registry.set(tabsetId, tabs);
	}

	/**
	 * Removes a page tab from the specified tab set.
	 *
	 * This method retrieves the list of tabs associated with the provided `tabsetId`,
	 * finds the tab with the specified `tabId`, removes it from the list, and updates
	 * the registry. If the tabset becomes empty after removal, it also removes the tabset
	 * entry from the registry.
	 *
	 * @param tabsetId The identifier of the tab set from which the tab should be removed.
	 * @param tabId The identifier of the tab to remove.
	 */
	public removePageTab(tabsetId: TabsetRegistryId, tabId: string): void {
		// Retrieve the list of tabs for the specified tabset, or initialize as an empty array if not found
		const tabs = this.registry.get(tabsetId) || [];

		// Find the index of the tab with the specified tabId
		const index = tabs.findIndex((tab) => tab.tabId === tabId);

		// If the tab exists in the list, remove it
		if (index !== -1) {
			// Remove the tab from the list
			tabs.splice(index, 1);

			// Update the registry with the modified list of tabs
			if (tabs.length > 0) {
				this.registry.set(tabsetId, tabs);
			} else {
				// Remove the tabset entry from the registry if no tabs are left
				this.registry.delete(tabsetId);
			}
		}
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
	 * Retrieves all unique page tabs for a specified tabset.
	 *
	 * This method first retrieves all the tabs associated with the given `tabsetId`, then
	 * ensures that each tab is unique based on its `tabId` by using a `Map`. Finally, it returns
	 * an array of these unique tabs.
	 *
	 * @param tabsetId The identifier for the tabset whose tabs are to be retrieved.
	 * @returns An array of unique page tabs for the specified tabset.
	 */
	public getPageTabset(tabsetId: TabsetRegistryId): PageTabRegistryConfig[] {
		// Get all registered tabs for the specified tabset, ordered as required
		const tabs = this.getPageTabsByOrder(tabsetId);

		// Create a map to track unique tabs based on tabId
		const uniqueTabsMap = new Map<string, PageTabRegistryConfig>();

		// Iterate through tabs and add them to the map if not already present
		tabs.forEach((tab) => {
			// Ensure only unique tabs are added
			uniqueTabsMap.set(tab.tabId, tab);
		});

		// Convert the map values to an array and return
		return Array.from(uniqueTabsMap.values());
	}

	/**
	 * @description
	 * Deletes a tabset from the registry.
	 *
	 * This method removes a tabset identified by the provided `tabsetId` from the internal registry.
	 * If the specified `tabsetId` does not exist in the registry, the function will simply return
	 * without making any changes.
	 *
	 * @param tabsetId The identifier for the tabset to delete.
	 */
	public deleteTabset(tabsetId: TabsetRegistryId): void {
		// Check if the tabset exists in the registry
		if (!this.registry.has(tabsetId)) {
			console.warn(`Tabset with id "${tabsetId}" does not exist in the registry.`);
			return;
		}

		// Remove the tabset from the registry
		this.registry.delete(tabsetId);
		console.log(`Tabset with id "${tabsetId}" has been successfully removed from the registry.`);
	}

	/**
	 * @description
	 * Retrieves the component associated with a specific tab ID for a given tabset.
	 *
	 * This method looks up the tabset using the provided `tabsetId`, then searches for the tab
	 * with the specified `tabId` within that tabset. If the tab is found, it returns the associated
	 * component; otherwise, it returns `undefined`.
	 *
	 * @param tabsetId The identifier of the tabset to retrieve tabs from.
	 * @param tabId The identifier of the tab whose component is to be retrieved.
	 * @returns The component associated with the specified tab ID, or `undefined` if the tab or component is not found.
	 */
	public getComponentForTab(tabsetId: TabsetRegistryId, tabId: string): Type<any> | undefined {
		// Retrieve the list of tabs for the specified tabsetId
		const tabs = this.getPageTabset(tabsetId);

		// Ensure that tabs is an array and check if the tab exists
		if (Array.isArray(tabs)) {
			// Find the tab with the specified tabId
			const tab = tabs.find((t) => t.tabId === tabId);

			// Return the component associated with the tab ID or undefined if not found
			return tab?.component;
		}

		// Return undefined if the tabs could not be retrieved or are not an array
		return undefined;
	}
}
