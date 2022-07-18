import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
	AfterViewInit,
	Component,
	Input,
	OnInit,
	QueryList,
	TemplateRef,
	ViewChildren
} from '@angular/core';
import { GuiDrag } from '../interfaces/gui-drag.abstract';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';
import { WidgetComponent } from '../widget/widget.component';
import { WidgetService } from '../widget/widget.service';

@Component({
	selector: 'ga-widget-layout',
	templateUrl: './widget-layout.component.html',
	styleUrls: ['./widget-layout.component.scss']
})
export class WidgetLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit, AfterViewInit
{
	@Input()
	set widgets(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}
	@ViewChildren(WidgetComponent) listWidgets: QueryList<GuiDrag>;

	constructor(private readonly widgetService: WidgetService) {
		super();
	}

	ngAfterViewInit(): void {
		this.listWidgets.changes.subscribe(
			(listwidgets: QueryList<GuiDrag>) => {
				this.widgetService.widgets = listwidgets.toArray();
			}
		);
	}

	protected drop(event: CdkDragDrop<number>): void {
		moveItemInArray(
			this.draggableObject,
			event.previousContainer.data,
			event.container.data
		);
		this.widgetService.widgetsRef = this.draggableObject;
	}

	ngOnInit(): void {}

	get widgets() {
		if (
			this.widgetService.widgetsRef.length > 0 &&
			this.draggableObject !== this.widgetService.widgetsRef
		)
			this.draggableObject = this.widgetService.widgetsRef;
		return this.draggableObject;
	}
}
