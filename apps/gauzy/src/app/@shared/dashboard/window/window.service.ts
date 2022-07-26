import { Injectable, TemplateRef } from '@angular/core';
import { Store } from '../../../@core';
import { LayoutPersistance } from '../concretes/contexts/layout-persistance.class';
import { PersistanceTakers } from '../concretes/contexts/persistance-takers.class';
import { DatabaseStrategy } from '../concretes/strategies/database-strategy.class';
import { LocalstorageStrategy } from '../concretes/strategies/localstorage-strategy.class';
import { BackupStrategy } from '../interfaces/backup-strategy.interface';
import { GuiDrag } from '../interfaces/gui-drag.abstract';

@Injectable({
	providedIn: 'root'
})
export class WindowService {
	private _windowsRef: TemplateRef<HTMLElement>[] = [];
	private _windows: GuiDrag[] = [];
	private _layoutPersistance: LayoutPersistance;
	private _persistanceTakers: PersistanceTakers;
	private _localStorage: BackupStrategy;
	private _dataBaseStorage: BackupStrategy;

	constructor(private readonly store: Store) {
		this._layoutPersistance = new LayoutPersistance();
		this._localStorage = new LocalstorageStrategy();
		this._dataBaseStorage = new DatabaseStrategy();
		this._persistanceTakers = new PersistanceTakers();
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
	public save(): void {
		if (this.windows.length === 0) return;
		this._layoutPersistance.state = this.windows;
		this._persistanceTakers.strategy = this._localStorage;
		this._persistanceTakers.addPersistance(this._layoutPersistance.save());
		this.store.windows =
			this._persistanceTakers.strategy.serialize() as Partial<GuiDrag>[];
	}

	public retrieve(): Partial<GuiDrag>[] {
		this._persistanceTakers.strategy = this._localStorage;
		return this._persistanceTakers.strategy.deSerialize(
			this.store.windows,
			this.windows
		);
	}

	public undoDrag() {
		this._persistanceTakers.strategy = this._localStorage;
		this._persistanceTakers.undo();
		if (this._persistanceTakers.lastPersistance) {
			this.windows =
				this._persistanceTakers.lastPersistance.restore() as GuiDrag[];
			this.sortingReverse();
		}
	}

	protected sortingReverse(): void {
		const buffers: TemplateRef<HTMLElement>[] = [];
		this.windows.forEach((widget: GuiDrag) => {
			this.windowsRef.forEach((widgetRef: TemplateRef<HTMLElement>) => {
				if (widgetRef === widget.templateRef) {
					buffers.push(widgetRef);
				}
			});
		});
		this.windowsRef = buffers;
	}
}
