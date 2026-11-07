import { NbMenuItem } from '@nebular/theme';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';

export interface IMenuItemFocusChangeEvent {
	children: IMenuItem | null; // The sub-row that was picked, or null for a top-level row.
	parent: IMenuItem;
}

export interface IMenuItem extends NbMenuItem {
	id?: string; // Unique identifier for the menu item.
	class?: string;
	data: {
		translationKey: string; //Translation key for the title, mandatory for all items
		permissionKeys?: PermissionsEnum[]; //Check permissions and hide item if any given permission is not present
		featureKey?: FeatureEnum; //Check permissions and hide item if any given permission is not present
		withOrganizationShortcuts?: boolean; //Declare if the sidebar item has organization level shortcuts
		hide?: () => boolean; //Hide the menu item if this returns true,
		add?: string;
		activePaths?: string[]; // Extra paths the item is highlighted on besides its link, each matched with everything below it
	};
}
