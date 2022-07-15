import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';

@Component({
	selector: 'ga-window-layout',
	templateUrl: './window-layout.component.html',
	styleUrls: ['./window-layout.component.scss']
})
export class WindowLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit
{
	@Input()
	set windows(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}

	constructor() {
		super();
	}

	ngOnInit(): void {}

	get windows() {
		return this.draggableObject;
	}
}
