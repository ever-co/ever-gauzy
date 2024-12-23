import { Provider, inject, provideAppInitializer } from '@angular/core';
import { NavMenuSectionItem } from '../services/nav-builder/nav-builder-types';
import { NavMenuBuilderService } from '../services/nav-builder';

/**
 * Factory function to create a provider for adding a navigation menu section (parent menu).
 *
 * @param config The configuration object representing the new navigation menu section to add.
 * @param before (Optional) The identifier of the section before which the new section should be added.
 *
 * @example
 *
 * const beforeSectionId = 'dashboard';
 *
 * export default [
 *     addNavMenuSection({
 *         id: 'reports',
 *         label: 'Reports',
 *         menuCategory: 'settings', // Optional, can be 'main', 'settings', or 'accordion'
 *         items: [
 *             {
 *                 id: 'report1',
 *                 label: 'Report 1',
 *                 link: '/reports/report1'
 *             },
 *             {
 *                 id: 'report2',
 *                 label: 'Report 2',
 *                 link: '/reports/report2'
 *             }
 *         ]
 *     }, beforeSectionId)
 * ];
 *
 * @returns The provider configuration.
 */
export function addNavMenuSection(config: NavMenuSectionItem, before?: string): Provider {
	return provideAppInitializer(() => {
        const initializerFn = ((navBuilderService: NavMenuBuilderService) => () => {
			navBuilderService.addNavMenuSection(config, before);
		})(inject(NavMenuBuilderService));
        return initializerFn();
      });
}

/**
 * Factory function to create a provider for adding a navigation menu item (child menu).
 *
 * @param config The configuration object representing the new navigation menu item to add.
 * @param sectionId The identifier of the section to which the new item should be added.
 * @param before (Optional) The identifier of the item before which the new item should be added.
 *
 * @example
 *
 * const beforeItemId = 'item1';
 *
 * export default [
 *     addNavMenuItem({
 *         id: 'new-menu-item',
 *         label: 'New Menu Item',
 *         link: '/new-menu-item',
 *     }, 'section1', beforeItemId)
 * ];
 *
 * @returns The provider configuration.
 */
export function addNavMenuItem(config: NavMenuSectionItem, sectionId: string, before?: string): Provider {
	return provideAppInitializer(() => {
        const initializerFn = ((navBuilderService: NavMenuBuilderService) => () => {
			navBuilderService.addNavMenuItem(config, sectionId, before);
		})(inject(NavMenuBuilderService));
        return initializerFn();
      });
}
