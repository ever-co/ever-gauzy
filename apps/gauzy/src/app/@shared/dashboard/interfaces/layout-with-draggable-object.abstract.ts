import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TemplateRef } from '@angular/core';

export abstract class LayoutWithDraggableObject {
	protected draggableObject: TemplateRef<HTMLElement>[] = [];
	drop(event: CdkDragDrop<number>): void {
		moveItemInArray(
			this.draggableObject,
			event.previousContainer.data,
			event.container.data
		);
	}
}
