import { Injectable, TemplateRef } from '@angular/core';
import { Store } from '../../../@core';
import { LayoutPersistance } from '../interfaces/layout-persistance.abstract';
import { GuiDrag } from '../interfaces/gui-drag.abstract';

@Injectable({
	providedIn: 'root'
})
export class WindowService extends LayoutPersistance {
	private _windowsRef: TemplateRef<HTMLElement>[] = [];
	private _windows: GuiDrag[] = [];

	constructor(private readonly store: Store) {
		super();
	}

	public get windowsRef(): any[] {
		return this._windowsRef;
	}
	public set windowsRef(value: any[]) {
		this._windowsRef = value;
		this.sorting();
	}
	protected sorting(): void {
		const buffers: GuiDrag[] = [];
		this.windowsRef.forEach((windowsRef: TemplateRef<HTMLElement>) => {
			this.windows.forEach((window: GuiDrag) => {
				if (windowsRef === window.templateRef) {
					buffers.push(window);
				}
			});
		});
		this.windows = buffers;
	}
	public get windows(): GuiDrag[] {
		return this._windows;
	}
	public set windows(value: GuiDrag[]) {
		this._windows = value;
	}
	public serialize(): void {
		if (this.windows.length === 0) return;
		this.store.windows = this.toObject(this.windows);
	}

	public deSerialize(): Partial<GuiDrag>[] {
		return this.store.windows
			? this.store.windows
					.flatMap((serialized: Partial<GuiDrag>) => {
						return this.windows.map((window: GuiDrag) => {
							if (window.position === serialized.position) {
								window.isCollapse = serialized.isCollapse;
								window.isExpand = serialized.isExpand;
								window.title = serialized.title;
								window.hide = serialized.hide;
								return window;
							}
						});
					})
					.filter((deserialized: GuiDrag) => deserialized)
			: [];
	}
}
