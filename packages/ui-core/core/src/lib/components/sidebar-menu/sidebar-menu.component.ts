import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input } from '@angular/core';
import { IMenuItem } from './menu-items/interface/menu-item.interface';
import { MenuItemComponent } from './menu-items/concrete/menu-item/menu-item.component';
import { SidebarMenuService } from '../../services';

@Component({
	selector: 'ga-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [MenuItemComponent]
})
export class SidebarMenuComponent {
	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _sidebarMenuService = inject(SidebarMenuService);

	private _items: IMenuItem[] = [];

	@Input()
	public set items(value: IMenuItem[]) {
		this._items = value;
	}

	public get items(): IMenuItem[] {
		return this._items;
	}

	public get selectedItem(): IMenuItem {
		return this._sidebarMenuService.selectedItem;
	}

	/**
	 * Sets the selected item in the sidebar menu and triggers change detection.
	 *
	 * @param event The menu item to focus on.
	 */
	public focusOn(event: IMenuItem): void {
		this._sidebarMenuService.selectedItem = event;
		this._cdr.markForCheck();
	}
}
