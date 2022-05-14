import {
	AfterViewChecked,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import { IMenuItem } from './menu-items/inteface/menu-item.interface';

@Component({
	selector: 'ga-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements OnInit, AfterViewChecked {
	private _selectedItem: IMenuItem;
	@Input() menu: IMenuItem[];
	constructor(private cdr: ChangeDetectorRef) {}

	ngAfterViewChecked(): void {}

	public focusOn(event: IMenuItem) {
		this.selectedItem = event;
		this.cdr.detectChanges();
	}

	ngOnInit(): void {}

	public get selectedItem() {
		return this._selectedItem;
	}

	public set selectedItem(value: IMenuItem) {
		this._selectedItem = value;
	}
}
