import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';
import { WindowService } from '../window/window.service';

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

	protected drop(event: CdkDragDrop<number, number, any>): void {
		moveItemInArray(
			this.draggableObject,
			event.previousContainer.data,
			event.container.data
		);
		this.windowService.windows = this.draggableObject;
	}

	constructor(private windowService: WindowService) {
		super();
	}

	ngOnInit(): void {}

	get windows() {
		if (
			this.windowService.windows.length > 0 &&
			this.draggableObject !== this.windowService.windows
		)
			this.draggableObject = this.windowService.windows;
		return this.draggableObject;
	}
}
