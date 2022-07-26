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
export class WidgetService {
	private _widgetsRef: TemplateRef<HTMLElement>[] = [];
	private _widgets: GuiDrag[] = [];
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

	public get widgetsRef(): TemplateRef<HTMLElement>[] {
		return this._widgetsRef;
	}
	public set widgetsRef(value: TemplateRef<HTMLElement>[]) {
		this._widgetsRef = value;
		this.sorting();
	}

	protected sorting(): void {
		const buffers: GuiDrag[] = [];
		this.widgetsRef.forEach((widgetRef: TemplateRef<HTMLElement>) => {
			this.widgets.forEach((widget: GuiDrag) => {
				if (widgetRef === widget.templateRef) {
					buffers.push(widget);
				}
			});
		});
		this.widgets = buffers;
	}

	public get widgets(): GuiDrag[] {
		return this._widgets;
	}
	public set widgets(value: GuiDrag[]) {
		this._widgets = value;
	}
	public save(): void {
		if (this.widgets.length === 0) return;
		this._layoutPersistance.state = this.widgets;
		this._persistanceTakers.strategy = this._localStorage;
		this._persistanceTakers.addPersistance(this._layoutPersistance.save());
		this.store.widgets =
			this._persistanceTakers.strategy.serialize() as Partial<GuiDrag>[];
	}

	public retrieve(): Partial<GuiDrag>[] {
		this._persistanceTakers.strategy = this._localStorage;
		return this._persistanceTakers.strategy.deSerialize(
			this.store.widgets,
			this.widgets
		);
	}
}
