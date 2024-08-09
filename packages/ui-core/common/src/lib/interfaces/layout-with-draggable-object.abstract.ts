import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TemplateRef } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { Subject } from 'rxjs/internal/Subject';

export abstract class LayoutWithDraggableObject {
	protected draggableObject: TemplateRef<HTMLElement>[] = [];
	private _event: Subject<any> = new Subject<any>();
	protected drop(event: CdkDragDrop<number>): void {}
	protected onDragEnded(event: Object) {
		this._event.next(event);
	}

	protected get event(): Observable<any> {
		return this._event.asObservable();
	}
}
