import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';
import { WidgetService } from '../widget/widget.service';

@Component({
	selector: 'ga-widget-layout',
	templateUrl: './widget-layout.component.html',
	styleUrls: ['./widget-layout.component.scss']
})
export class WidgetLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit
{
	@Input()
	set widgets(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}

	constructor(private readonly widgetService: WidgetService) {
		super();
	}

	protected drop(event: CdkDragDrop<number>): void {
		moveItemInArray(
			this.draggableObject,
			event.previousContainer.data,
			event.container.data
		);
		this.widgetService.widgets = this.draggableObject;
	}

	ngOnInit(): void {}

	get widgets() {
		if (
			this.widgetService.widgets.length > 0 &&
			this.draggableObject !== this.widgetService.widgets
		)
			this.draggableObject = this.widgetService.widgets;
		return this.draggableObject;
	}
}
