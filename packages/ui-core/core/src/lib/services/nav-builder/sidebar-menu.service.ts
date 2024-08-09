import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class SidebarMenuService {
	private _selectedItem: any;
	get selectedItem(): any {
		return this._selectedItem;
	}

	set selectedItem(value: any) {
		this._selectedItem = value;
	}

	constructor() {}
}
