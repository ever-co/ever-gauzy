import { FactoryProvider, inject, provideAppInitializer } from '@angular/core';
import {
	ISidebarActionConfig,
	ISidebarConfig,
	NavigationBuilderService
} from './navigation-builder.service';

export function addSidebarActionItem(
	config: ISidebarActionConfig
): FactoryProvider {
	return provideAppInitializer(() => {
        const initializerFn = ((
			navigationBuilderService: NavigationBuilderService
		) => () => {
			navigationBuilderService.addSidebarActionItem(config);
		})(inject(NavigationBuilderService));
        return initializerFn();
      });
}

export function registerSidebarWidget(
	id: string,
	config: ISidebarConfig
): FactoryProvider {
	return provideAppInitializer(() => {
        const initializerFn = ((
			navigationBuilderService: NavigationBuilderService
		) => () => {
			navigationBuilderService.registerSidebar(id, config);
		})(inject(NavigationBuilderService));
        return initializerFn();
      });
}
