import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
	AfterViewChecked,
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnDestroy,
	OnInit,
	QueryList,
	TemplateRef,
	ViewChildren
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';
import { GuiDrag, LayoutWithDraggableObject } from '@gauzy/ui-core/common';
import { WindowComponent } from '../window/window.component';
import { WindowService } from '../window/window.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-window-layout',
	templateUrl: './window-layout.component.html',
	styleUrls: ['./window-layout.component.scss']
})
export class WindowLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy
{
	@Input() set windows(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}

	@ViewChildren(WindowComponent) listWindows: QueryList<GuiDrag>;

	constructor(private windowService: WindowService, private readonly cdr: ChangeDetectorRef) {
		super();
	}

	ngAfterViewInit(): void {
		this.listWindows.changes
			.pipe(
				tap((listWindows: QueryList<GuiDrag>) => (this.windowService.windows$ = listWindows.toArray())),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewChecked(): void {
		this.cdr.detectChanges();
	}

	ngOnInit(): void {
		this.windowService.windowsRef = this.draggableObject;
	}

	protected drop(event: CdkDragDrop<number, number, any>): void {
		moveItemInArray(this.draggableObject, event.previousContainer.data, event.container.data);
		this.windowService.windowsRef = this.draggableObject;
		this.windowService.save();
	}

	get windows() {
		if (this.windowService.windowsRef.length > 0 && this.draggableObject !== this.windowService.windowsRef)
			this.draggableObject = this.windowService.windowsRef;
		return this.draggableObject;
	}

	ngOnDestroy(): void {}
}
