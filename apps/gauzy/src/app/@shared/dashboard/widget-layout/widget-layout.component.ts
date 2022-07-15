import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';

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

	constructor() {
		super();
	}

	ngOnInit(): void {}

	get widgets() {
		return this.draggableObject;
	}
}
