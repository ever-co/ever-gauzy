import { APP_INITIALIZER, FactoryProvider } from '@angular/core';
import {
	ISidebarActionConfig,
	ISidebarConfig,
	NavigationBuilderService
} from './navigation-builder.service';

export function addSidebarActionItem(
	config: ISidebarActionConfig
): FactoryProvider {
	return {
		provide: APP_INITIALIZER,
		multi: true,
		useFactory: (
			navigationBuilderService: NavigationBuilderService
		) => () => {
			navigationBuilderService.addSidebarActionItem(config);
		},
		deps: [NavigationBuilderService]
	};
}

export function registerSidebarWidget(
	id: string,
	config: ISidebarConfig
): FactoryProvider {
	return {
		provide: APP_INITIALIZER,
		multi: true,
		useFactory: (
			navigationBuilderService: NavigationBuilderService
		) => () => {
			navigationBuilderService.registerSidebar(id, config);
		},
		deps: [NavigationBuilderService]
	};
}
