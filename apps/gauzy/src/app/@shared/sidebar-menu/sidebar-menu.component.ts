import { AfterContentChecked, ChangeDetectorRef, Component, Input } from '@angular/core';
import { IMenuItem } from './menu-items/interface/menu-item.interface';
import { SidebarMenuService } from './sidebar-menu.service';

@Component({
	selector: 'ga-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements AfterContentChecked {
	@Input() items: IMenuItem[] = [];

	public get selectedItem() {
		return this._sidebarMenuService.selectedItem;
	}
	public set selectedItem(value: IMenuItem) {
		this._sidebarMenuService.selectedItem = value;
		this._cdr.detectChanges();
	}

	constructor(private readonly _cdr: ChangeDetectorRef, private readonly _sidebarMenuService: SidebarMenuService) {}

	ngAfterContentChecked(): void {
		this._cdr.detectChanges();
	}

	/**
	 * Sets the selected item in the sidebar menu and triggers change detection.
	 *
	 * @param event The menu item to focus on.
	 */
	public focusOn(event: IMenuItem): void {
		// Set the selected item in the sidebar menu
		this._sidebarMenuService.selectedItem = event;

		// Trigger change detection
		this._cdr.detectChanges();
	}
}
