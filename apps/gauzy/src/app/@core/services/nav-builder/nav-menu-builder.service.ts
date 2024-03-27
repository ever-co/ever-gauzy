import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay } from 'rxjs';
import {
	NavMenuItem,
	NavMenuItemsConfig,
	NavMenuSection,
	NavMenuSectionConfig,
} from './nav-builder-types';

@Injectable({
	providedIn: 'root'
})
export class NavMenuBuilderService {
	// Declare an observable property menuConfig$ of type Observable<NavMenuSection[]>
	public menuConfig$: Observable<NavMenuSection[]>;

	// Initial configuration of the navigation menu
	private initialNavMenuConfig$ = new BehaviorSubject<NavMenuSection[]>([]);
	// Additional sections that can be added to the navigation menu
	private addedNavMenuSections: Array<NavMenuSectionConfig> = [];
	// Additional menu items that can be added to the navigation menu
	private addedNavMenuItems: Array<NavMenuItemsConfig> = [];

	constructor() {
		this.setupStreams();
	}

	/**
	 * Defines the navigation menu sections.
	 *
	 * @param config An array of NavMenuSection objects representing the navigation menu sections.
	 */
	defineNavMenuSections(config: NavMenuSection[]) {
		this.initialNavMenuConfig$.next(config);
	}

	/**
	 * Adds a new navigation menu section.
	 * @param config The configuration object representing the new navigation menu section to add.
	 * @param before (Optional) The identifier of the section before which the new section should be added.
	 */
	addNavMenuSection(config: NavMenuSection, before?: string) {
		// Push the new section configuration along with its positioning information into the addedNavMenuSections array
		this.addedNavMenuSections.push({ config, before });
	}

	/**
	 * Adds a new navigation menu item.
	 * @param config The configuration object representing the new navigation menu item to add.
	 * @param sectionId The identifier of the section to which the new item should be added.
	 * @param before (Optional) The identifier of the item before which the new item should be added.
	 */
	addNavMenuItem(config: NavMenuItem, sectionId: string, before?: string) {
		// Push the new item configuration along with its positioning information into the addedNavMenuItems array
		this.addedNavMenuItems.push({ config, sectionId, before });
	}

	/**
	 * Sets up streams to dynamically configure the navigation menu based on initial configuration and additions.
	 */
	private setupStreams(): void {
		// Create an observable for section additions
		const sectionAdditions$ = of(this.addedNavMenuSections);

		// Combine the initial configuration and section additions
		const combinedConfig$ = combineLatest([this.initialNavMenuConfig$, sectionAdditions$]).pipe(
			map(([sections, additions]) => {
				const configMap = new Map<string, NavMenuSection>();

				// Add initial configurations to the map
				sections.forEach((config: NavMenuSection) => configMap.set(config.id, config));

				// Update or add sections from additions
				for (const { config, before } of additions) {
					if (configMap.has(config.id)) {
						configMap.set(config.id, config); // Update existing config
					} else {
						const beforeIndex = before ? sections.findIndex((c) => c.id === before) : -1;
						if (beforeIndex !== -1) {
							sections.splice(beforeIndex, 0, config); // Insert before specified section
						} else {
							sections.push(config); // Append if before section not found
						}
						configMap.set(config.id, config); // Add to map
					}
				}

				return [...configMap.values()];
			}),
			shareReplay(1),
		);

		// Create an observable for item additions
		const itemAdditions$ = of(this.addedNavMenuItems);

		// Combine the combined configuration with item additions to produce the final menu configuration
		this.menuConfig$ = combineLatest([combinedConfig$, itemAdditions$]).pipe(
			map(([sections, additions]) => {
				const sectionMap = new Map<string, NavMenuSection>();

				// Populate section map for quick lookup
				sections.forEach((section) => sectionMap.set(section.id, section));

				// Process item additions
				additions.forEach((item: NavMenuItemsConfig) => {
					const section = sectionMap.get(item.sectionId);
					if (section) {
						const { config, before } = item;
						const itemIndex = section.items.findIndex((i) => i.id === config.id);

						if (itemIndex !== -1) {
							section.items[itemIndex] = config; // Update existing item
						} else {
							const beforeIndex = before ? section.items.findIndex((i) => i.id === before) : -1;
							if (beforeIndex !== -1) {
								section.items.splice(beforeIndex, 0, config); // Insert before specified item
							} else {
								section.items.push(config); // Append if before item not found
							}
						}
					} else {
						console.error(`Could not add menu item "${item.config.id}", section "${item.sectionId}" does not exist`);
					}
				});

				return sections;
			})
		);
	}
}
