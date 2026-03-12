import { CommonModule } from '@angular/common';
import {
	AfterContentChecked,
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	inject,
	Input
} from '@angular/core';
import { MenuItemComponent } from './menu-items/concrete/menu-item/menu-item.component';
import { IMenuItem } from './menu-items/interface/menu-item.interface';
import { SidebarMenuService } from '../../services/nav-builder/sidebar-menu.service';

@Component({
	selector: 'ga-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [CommonModule, MenuItemComponent]
})
export class SidebarMenuComponent implements AfterContentChecked, AfterViewInit {
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

	public get selectedItem() {
		return this._sidebarMenuService.selectedItem;
	}
	public set selectedItem(value: IMenuItem) {
		this._sidebarMenuService.selectedItem = value;
		this._cdr.detectChanges();
	}

	ngAfterContentChecked(): void {
		this._cdr.detectChanges();
	}

	ngAfterViewInit(): void {
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
