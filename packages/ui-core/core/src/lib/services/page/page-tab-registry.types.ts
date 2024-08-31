import { TemplateRef, Type } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { I18nService } from '@gauzy/ui-core/i18n';
import { PageTabsetRegistryId } from '../../common/component-registry.types';

/**
 * Custom page tab configuration options.
 */
export interface CustomNbRouteTab extends NbRouteTab {
	/**
	 * @description
	 * The identifier for the tab.
	 */
	tabId?: string;

	/**
	 * @description
	 * Specifies if the tab is active.
	 */
	active?: boolean;

	/**
	 * @description
	 * The component to be loaded in the tab. This can be a component reference or a string identifier
	 * for lazy loading the component.
	 */
	component?: Type<any>;

	/**
	 * @description
	 * The template to be rendered in the tab. This is an alternative to the component.
	 */
	template?: TemplateRef<any>;
}

/**
 * Page tab configuration options.
 */
export interface PageTabRegistryConfig extends CustomNbRouteTab {
	/**
	 * @description
	 * The tabset identifier for the page tabset.
	 */
	tabsetId: PageTabsetRegistryId;

	/**
	 * @description
	 * The translatable key for the tab title.
	 */
	tabTitle: string | ((_: I18nService) => string);

	/**
	 * @description
	 * The icon name or icon configuration for the tab.
	 */
	tabIcon?: string;

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
	 * Specifies if the tab is hidden for any reason.
	 */
	hide?: boolean;
}

/**
 * Tab registry service interface.
 *
 * This interface defines the contract for services that manage tab registrations,
 * including methods for registering single and multiple tabs.
 */
export interface IPageTabRegistry {
	/**
	 * Registers a single tab with the service.
	 *
	 * This method adds a single tab configuration to the registry. If the tab ID
	 * already exists, an error will be thrown, but the tab will still be registered.
	 *
	 * @param config The configuration object for the tab to be registered.
	 */
	registerPageTab(config: PageTabRegistryConfig): void;

	/**
	 * Registers multiple tabs with the service.
	 *
	 * This method adds multiple tab configurations to the registry. If any tab
	 * within the provided configurations already exists, an error will be thrown for that
	 * specific tab, but other tabs will still be registered.
	 *
	 * @param configs An array of configuration objects for the tabs to be registered.
	 */
	registerPageTabs(configs: PageTabRegistryConfig[]): void;
}
