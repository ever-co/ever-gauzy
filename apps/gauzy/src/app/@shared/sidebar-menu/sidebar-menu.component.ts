import {
	AfterViewChecked,
	ChangeDetectorRef,
	Component,
	Input,
	OnDestroy,
	OnInit
} from '@angular/core';
import { NbMenuItem, NbSidebarService } from '@nebular/theme';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

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
export class SidebarMenuComponent
	implements OnInit, OnDestroy, AfterViewChecked
{
	@Input() menu: IMenuItem[];
	isExpand: boolean;
	constructor(
		private readonly router: Router,
		private readonly sidebarService: NbSidebarService,
		private readonly cdr: ChangeDetectorRef
	) {}
	ngAfterViewChecked(): void {
		this.sidebarService
			.getSidebarState('menu-sidebar')
			.pipe(
				tap(
					(state) =>
						(this.isExpand = state === 'expanded' ? true : false)
				)
			)
			.subscribe();
		this.cdr.detectChanges();
	}

	ngOnInit(): void {}

	public redirectTo(link: string) {
		this.router.navigateByUrl(link);
	}

	public selectedRoute(item: IMenuItem): boolean {
		return this.router.url === item.link;
	}

	public toggleSidebar() {
		if (!this.isExpand) this.sidebarService.toggle(false, 'menu-sidebar');
	}

	ngOnDestroy(): void {}
}
