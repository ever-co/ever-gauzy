import { Injectable, TemplateRef } from '@angular/core';
import { Store } from '../../../@core';
import { LayoutPersistance } from '../interfaces/layout-persistance.abstract';
import { GuiDrag } from '../interfaces/gui-drag.abstract';

@Injectable({
	providedIn: 'root'
})
export class WidgetService extends LayoutPersistance {
	private _widgetsRef: TemplateRef<HTMLElement>[] = [];
	private _widgets: GuiDrag[] = [];

	constructor(private readonly store: Store) {
		super();
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
	public serialize(): void {
		if (this.widgets.length === 0) return;
		this.store.widgets = this.toObject(this.widgets);
	}

	public deSerialize(): Partial<GuiDrag>[] {
		return this.store.widgets
			.flatMap((serialized: Partial<GuiDrag>) => {
				return this.widgets.map((widget: GuiDrag) => {
					if (widget.title === serialized.title) {
						widget.isCollapse = serialized.isCollapse;
						widget.isExpand = serialized.isExpand;
						return widget;
					}
				});
			})
			.filter((deserialized: GuiDrag) => deserialized);
	}
}
