import { Type } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { TabsetRegistryId } from '../../common/component-registry.types';

/**
 * Page tab configuration options.
 */
export interface PageTabRegistryConfig extends NbRouteTab {
	/**
	 * @description
	 * The tabset identifier for the page tabset.
	 */
	tabsetId: TabsetRegistryId;

	/**
	 * @description
	 * The identifier for the tab.
	 */
	tabId: string;

	/**
	 * @description
	 * The translatable key for the tab title.
	 */
	tabTitle: string | (() => string);

	/**
	 * @description
	 * The icon name or icon configuration for the tab.
	 */
	tabIcon?: string;

	/**
	 * @description
	 * The component to be loaded in the tab. This can be a component reference or a string identifier
	 * for lazy loading the component.
	 */
	component?: Type<any>;

	/**
	 * @description
	 * The order of the tab in the tabs bar.
	 * If not provided, the tab will be added to the end of the tabs bar.
	 */
	order?: number;

	/**
	 * @description
	 * Type of tabset to use. Can be 'route' for NbRouteTabsetComponent or 'standard' for NbTabsetComponent.
	 */
	tabsetType: 'route' | 'standard';

	/**
	 * @description
	 * Specifies if the tab is active.
	 */
	active?: boolean;

	/**
	 * @description
	 * Specifies if the tab is hidden for any reason.
	 */
	hide?: boolean;
}

/**
 * Page registry service interface.
 */
export interface IPageTabRegistry {
	registerPageTab(config: PageTabRegistryConfig): void; // Register a single page tab configuration.
	registerPageTabs(configs: PageTabRegistryConfig[]): void; // Register multiple page tab configurations.
}
