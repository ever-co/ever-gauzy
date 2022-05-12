import { Component, Input, OnInit } from '@angular/core';
import { NbMenuItem } from '@nebular/theme';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { Router } from '@angular/router';

interface IMenuItem extends NbMenuItem {
	class?: string;
	data: {
		translationKey: string; //Translation key for the title, mandatory for all items
		permissionKeys?: PermissionsEnum[]; //Check permissions and hide item if any given permission is not present
		featureKey?: FeatureEnum; //Check permissions and hide item if any given permission is not present
		withOrganizationShortcuts?: boolean; //Declare if the sidebar item has organization level shortcuts
		hide?: () => boolean; //Hide the menu item if this returns true
	};
}

@Component({
	selector: 'gauzy-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements OnInit {
	@Input() menu: IMenuItem[];
	constructor(private readonly router: Router) {}

	ngOnInit(): void {}

	public redirectTo(link: string) {
		this.router.navigateByUrl(link);
	}
}
