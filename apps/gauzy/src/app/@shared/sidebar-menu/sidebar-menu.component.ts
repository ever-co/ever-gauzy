import {
	AfterViewChecked,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import { IMenuItem } from './menu-items/interface/menu-item.interface';
import { SidebarMenuService } from './sidebar-menu.service';

@Component({
	selector: 'ga-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements OnInit, AfterViewChecked {
	@Input() items: IMenuItem[] = [];

	constructor(
		private readonly cdr: ChangeDetectorRef,
		private readonly _sidebarMenuService: SidebarMenuService
	) {}

	ngOnInit(): void {}
	ngAfterViewChecked(): void {}

	public get selectedItem() {
		return this._sidebarMenuService.selectedItem;
	}

	public set selectedItem(value: IMenuItem) {
		this._sidebarMenuService.selectedItem = value;
	}

	public focusOn(event: IMenuItem) {
		this._sidebarMenuService.selectedItem = event;
		this.cdr.detectChanges();
	}
}
