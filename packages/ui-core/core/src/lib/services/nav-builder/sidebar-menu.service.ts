import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class SidebarMenuService {
	/** The highlighted top-level row. */
	private _selectedItem: any;
	get selectedItem(): any {
		return this._selectedItem;
	}

	set selectedItem(value: any) {
		this._selectedItem = value;
	}

	/** The highlighted sub-row inside `selectedItem`, or null when a top-level row is selected on its own. */
	private _selectedChild: any = null;
	get selectedChild(): any {
		return this._selectedChild;
	}

	set selectedChild(value: any) {
		this._selectedChild = value;
	}

	constructor() {}
}
