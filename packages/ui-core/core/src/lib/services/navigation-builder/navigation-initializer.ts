import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import {
	ISidebarActionConfig,
	ISidebarConfig,
	NavigationBuilderService
} from './navigation-builder.service';

/**
 * Adds a new action item to the sidebar navigation.
 *
 * @param config - The configuration object defining the properties of the sidebar action item.
 *
 * @returns An instance of `EnvironmentProviders` that initializes the sidebar action item during app setup.
 *
 * The function uses `provideAppInitializer` to ensure the action item is added
 * to the `NavigationBuilderService` during application initialization.
 */
export function addSidebarActionItem(
    config: ISidebarActionConfig
): EnvironmentProviders {
    return provideAppInitializer(() => {
        const initializerFn = (
            (navigationBuilderService: NavigationBuilderService) => () => {
                navigationBuilderService.addSidebarActionItem(config);
            }
        )(inject(NavigationBuilderService));

        return initializerFn();
    });
}

/**
 * Registers a new widget in the sidebar navigation.
 *
 * @param id - A unique identifier for the sidebar widget.
 *             Example: 'widget-id'
 *
 * @param config - The configuration object defining the properties and behavior of the sidebar widget.
 *
 * @returns An instance of `EnvironmentProviders` that initializes the sidebar widget during app setup.
 *
 * This function ensures that the widget is registered with the `NavigationBuilderService` during
 * the application initialization process.
 */
export function registerSidebarWidget(
    id: string,
    config: ISidebarConfig
): EnvironmentProviders {
    return provideAppInitializer(() => {
        const initializerFn = (
            (navigationBuilderService: NavigationBuilderService) => () => {
                navigationBuilderService.registerSidebar(id, config);
            }
        )(inject(NavigationBuilderService));

        return initializerFn();
    });
}
