import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay } from 'rxjs';
import { NavMenuSectionItem, NavMenuItemsConfig, NavMenuSectionConfig } from './nav-builder-types';

@Injectable({
	providedIn: 'root'
})
export class NavMenuBuilderService {
	// Declare an observable property menuConfig$ of type Observable<NavMenuSection[]>
	public menuConfig$: Observable<NavMenuSectionItem[]>;

	// Initial configuration of the navigation menu
	private initialNavMenuConfig$ = new BehaviorSubject<NavMenuSectionItem[]>([]);

	// Additional sections that can be added to the navigation menu
	private addedNavMenuSections: NavMenuSectionConfig[] = [];
	private addedNavMenuSectionsSubject = new BehaviorSubject<NavMenuSectionConfig[]>(this.addedNavMenuSections);
	public addedNavMenuSections$: Observable<NavMenuSectionConfig[]> = this.addedNavMenuSectionsSubject.asObservable();

	// Additional menu items that can be added to the navigation menu
	private addedNavMenuItems: NavMenuItemsConfig[] = [];
	private removedNavMenuItems: NavMenuItemsConfig[] = [];
	private addedNavMenuItemsSubject = new BehaviorSubject<NavMenuItemsConfig[]>(this.addedNavMenuItems);
	public addedNavMenuItems$: Observable<NavMenuItemsConfig[]> = this.addedNavMenuItemsSubject.asObservable();

	constructor() {
		this.setupStreams();
	}

	/**
	 * Defines the navigation menu sections.
	 *
	 * @param config An array of NavMenuSection objects representing the navigation menu sections.
	 */
	defineNavMenuSections(config: NavMenuSectionItem[]) {
		this.initialNavMenuConfig$.next(config);
	}

	/**
	 * Adds a new navigation menu section.
	 *
	 * @param config The configuration object representing the new navigation menu section to add.
	 * @param before (Optional) The identifier of the section before which the new section should be added.
	 */
	addNavMenuSection(config: NavMenuSectionItem, before?: string) {
		// Push the new section configuration along with its positioning information into the addedNavMenuSections array
		this.addedNavMenuSections.push({ config, before });
		// Emit the updated addedNavMenuSections array to all subscribers
		this.addedNavMenuSectionsSubject.next(this.addedNavMenuSections);
	}

	/**
	 * Adds multiple navigation menu sections.
	 *
	 * @param configs An array of configuration objects representing the new navigation menu sections to add.
	 * @param before (Optional) The identifier of the section before which the new section(s) should be added.
	 */
	addNavMenuSections(configs: NavMenuSectionItem[], before?: string) {
		configs.forEach((config: NavMenuSectionItem) => {
			// Push the new section configuration along with its positioning information into the addedNavMenuSections array
			this.addedNavMenuSections.push({ config, before });
		});
		// Emit the updated addedNavMenuSections array to all subscribers
		this.addedNavMenuSectionsSubject.next(this.addedNavMenuSections);
	}

	/**
	 * Adds a new navigation menu item.
	 *
	 * @param config The configuration object representing the new navigation menu item to add.
	 * @param sectionId The identifier of the section to which the new item should be added.
	 * @param before (Optional) The identifier of the item before which the new item should be added.
	 */
	addNavMenuItem(config: NavMenuSectionItem, sectionId: string, before?: string) {
		// Check if the item already exists
		const existingIndex = this.addedNavMenuItems.findIndex(
			(item) => item.config.id === config.id && item.sectionId === sectionId
		);

		if (existingIndex !== -1) {
			// Item exists, replace it with the new config
			this.addedNavMenuItems[existingIndex] = { config, sectionId, before };
		} else {
			// Push each new item configuration along with its positioning information into the addedNavMenuItems array
			this.addedNavMenuItems.push({ config, sectionId, before });
		}
		// Emit the updated addedNavMenuItems array to all subscribers
		this.addedNavMenuItemsSubject.next([...this.addedNavMenuItems]);
	}

	/**
	 * Adds multiple new navigation menu items.
	 *
	 * @param configs An array of configuration objects representing the new navigation menu items to add.
	 * @param sectionId The identifier of the section to which the new items should be added.
	 * @param before (Optional) The identifier of the item before which the new items should be added.
	 */
	addNavMenuItems(configs: NavMenuSectionItem[], sectionId: string, before?: string) {
		configs.forEach((config: NavMenuSectionItem) => {
			// Check if the item already exists
			const existingIndex = this.addedNavMenuItems.findIndex(
				(item) => item.config.id === config.id && item.sectionId === sectionId
			);

			if (existingIndex !== -1) {
				// If the item exists, replace it with the new config
				this.addedNavMenuItems[existingIndex] = { config, sectionId, before };
			} else {
				// Push each new item configuration along with its positioning information into the addedNavMenuItems array
				this.addedNavMenuItems.push({ config, sectionId, before });
			}
		});

		// Emit the updated addedNavMenuItems array to all subscribers
		this.addedNavMenuItemsSubject.next([...this.addedNavMenuItems]);
	}

	/**
	 * Removes a navigation menu item.
	 *
	 * @param itemId The identifier of the item to be removed.
	 * @param sectionId The identifier of the section from which the item should be removed.
	 */
	removeNavMenuItem(itemId: string, sectionId: string): void {
		const itemIndex = this.addedNavMenuItems.findIndex(
			(item) => item.config.id === itemId && item.sectionId === sectionId
		);
		if (itemIndex !== -1) {
			// Check if the item is already present in the removedNavMenuItems array
			const existingIndex = this.removedNavMenuItems.findIndex(
				(item) => item.config.id === itemId && item.sectionId === sectionId
			);
			if (existingIndex === -1) {
				// Push the removed item into the removedNavMenuItems array
				this.removedNavMenuItems.push(this.addedNavMenuItems[itemIndex]);
			}
			// Remove the item from the addedNavMenuItems array
			this.addedNavMenuItems.splice(itemIndex, 1);
			// Emit the updated array to subscribers
			this.addedNavMenuItemsSubject.next([...this.addedNavMenuItems]);
		}
	}

	/**
	 * Removes multiple navigation menu items.
	 *
	 * @param itemIds An array of identifiers of the items to be removed.
	 * @param sectionId The identifier of the section from which the items should be removed.
	 */
	removeNavMenuItems(itemIds: string[], sectionId: string): void {
		itemIds.forEach((itemId: string) => {
			this.removeNavMenuItem(itemId, sectionId);
		});
	}

	/**
	 * Sets up streams to dynamically configure the navigation menu based on initial configuration and additions.
	 */
	private setupStreams(): void {
		// Create an observable for section additions
		const sectionAdditions$ = this.addedNavMenuSections$;
		// Create an observable for item additions
		const itemAdditions$ = this.addedNavMenuItems$;

		// Combine the initial configuration and section additions
		const combinedConfig$ = combineLatest([this.initialNavMenuConfig$, sectionAdditions$]).pipe(
			map(([sections, additions]) => {
				const configMap = new Map<string, NavMenuSectionItem>();

				// Add initial configurations to the map
				sections.forEach((config: NavMenuSectionItem) => configMap.set(config.id, config));

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
			shareReplay(1)
		);

		// Combine the combined configuration with item additions to produce the final menu configuration
		this.menuConfig$ = combineLatest([combinedConfig$, itemAdditions$, of(this.removedNavMenuItems)]).pipe(
			map(([sections, additions, removals]) => {
				const sectionMap = new Map<string, NavMenuSectionItem>();

				// Populate section map for quick lookup
				sections.forEach((section) => sectionMap.set(section.id, section));

				// Process item deletions
				removals.forEach((item: NavMenuItemsConfig) => {
					const sectionId = item.sectionId;
					const itemIdToRemove = item.config.id;
					const section = sectionMap.get(sectionId);
					if (section) {
						const itemIndex = section.items.findIndex((item) => item.id === itemIdToRemove);
						if (itemIndex !== -1) {
							section.items.splice(itemIndex, 1); // Remove item from the section
						}
					}
				});

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
						console.error(
							`Could not add menu item "${item.config.id}", section "${item.sectionId}" does not exist`
						);
					}
				});

				return sections;
			})
		);
	}
}
