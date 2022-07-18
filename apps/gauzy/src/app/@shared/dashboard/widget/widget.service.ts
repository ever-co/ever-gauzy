import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class WidgetService {
	private _widgets: any[] = [];

	constructor() {}

	public get widgets(): any[] {
		return this._widgets;
	}
	public set widgets(value: any[]) {
		this._widgets = value;
	}
}
