import { Injectable, TemplateRef } from '@angular/core';
import { Store } from '../../../@core';
import { DashboardPersistance } from '../interfaces/dashboard-persistance.abstract';
import { GuiDrag } from '../interfaces/gui-drag.abstract';

@Injectable({
	providedIn: 'root'
})
export class WindowService extends DashboardPersistance {
	private _windowsRef: TemplateRef<HTMLElement>[] = [];
	private _windows: GuiDrag[] = [];

	constructor(private readonly store: Store) {
		super();
	}

	public get windowsRef(): any[] {
		return this._windowsRef;
	}
	public set windowsRef(value: any[]) {
		const buffers: GuiDrag[] = [];
		this.windowsRef.forEach((windowsRef: TemplateRef<HTMLElement>) => {
			this.windows.forEach((window: GuiDrag) => {
				if (windowsRef === window.templateRef) {
					buffers.push(window);
				}
			});
		});
		this.windows = buffers;
		this.serialize(this.windows);
		this._windowsRef = value;
	}
	public get windows(): GuiDrag[] {
		return this._windows;
	}
	public set windows(value: GuiDrag[]) {
		this._windows = value;
	}
	public serialize(values: GuiDrag[]): void {
		if (values.length === 0) return;
		const toJson: Partial<GuiDrag>[] = values.map(
			(value: Partial<GuiDrag>) => {
				return {
					position: value.position,
					isCollapse: value.isCollapse,
					isExpand: value.isExpand,
					hide: value.hide,
					title: value.title
				};
			}
		);
		this.store.windows = toJson;
	}

	public deSerialize(): Partial<GuiDrag>[] {
		return this.store.windows;
	}
}
