import { Injectable, TemplateRef } from '@angular/core';
import { GuiDrag } from '../interfaces/gui-drag.abstract';

@Injectable({
	providedIn: 'root'
})
export class WidgetService {
	private _widgetsRef: TemplateRef<HTMLElement>[] = [];
	private _widgets: GuiDrag[] = [];

	constructor() {}

	public get widgetsRef(): TemplateRef<HTMLElement>[] {
		return this._widgetsRef;
	}
	public set widgetsRef(value: TemplateRef<HTMLElement>[]) {
		this._widgetsRef = value;
	}

	public get widgets(): GuiDrag[] {
		return this._widgets;
	}
	public set widgets(value: GuiDrag[]) {
		this._widgets = value;
	}
}
