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
		this.serialize();
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
		return this.store.windows;
	}
}
