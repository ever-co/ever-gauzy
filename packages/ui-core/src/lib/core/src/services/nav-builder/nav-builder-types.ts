import { ActivatedRoute } from "@angular/router";
import { NbMenuItem } from "@nebular/theme";
import { FeatureEnum, PermissionsEnum } from "@gauzy/contracts";

// Define a type NavMenuBadgeType representing different types of badges.
export type NavMenuBadgeType = 'basic' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'control';

/**
 * A NavMenuSection is a grouping of links in the main (left-hand side) navigation menu bar.
 */
export interface NavMenuSectionItem extends NbMenuItem {
    id: string; // Unique identifier for the section
    class?: string; // Additional class for styling (optional)
    items?: NavMenuSectionItem[]; // Array of NavMenuItem objects representing the links within the section (optional)
    onClick?: (event: MouseEvent) => void; // Function to be called when the menu item is clicked (optional)
    data: NavMenuItemData; // Data associated with the section
}

/**
 * Data associated with a NavMenuItem or NavMenuSection.
 */
export interface NavMenuItemData {
    translationKey: string; // Translation key for the title, mandatory for all items
    permissionKeys?: PermissionsEnum[]; // Permissions required to display the item (optional)
    featureKey?: FeatureEnum; // Feature key required to display the item (optional)
    hide?: () => boolean | boolean; // Function to determine if the item should be hidden (optional)
    add?: string;
}

/**
 * Represents the configuration for navigation menu sections.
 */
export interface NavMenuSectionConfig {
    config: NavMenuSectionItem; // Configuration for the navigation menu section
    before?: string; // (Optional) Identifier of the section before which this section should be inserted
}

/**
 * Represents the configuration for navigation menu items.
 */
export interface NavMenuItemsConfig {
    config: NavMenuSectionItem; // Configuration for the navigation menu item
    sectionId: string; // Identifier of the section to which this item belongs
    before?: string; // (Optional) Identifier of the item before which this item should be inserted
}

/**
 * A function or array that represents a router link definition for a NavMenuItem.
 *
 * @description
 * This type defines a function that takes an ActivatedRoute as input and returns an array representing
 * the router link for a NavMenuItem. Alternatively, it can be an array directly representing the router link.
 */
export type RouterLinkDefinition = ((route: ActivatedRoute) => any[]) | any[];
