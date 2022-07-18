import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
	AfterViewChecked,
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit,
	QueryList,
	TemplateRef,
	ViewChildren
} from '@angular/core';
import { GuiDrag } from '../interfaces/gui-drag.abstract';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';
import { WindowComponent } from '../window/window.component';
import { WindowService } from '../window/window.service';

@Component({
	selector: 'ga-window-layout',
	templateUrl: './window-layout.component.html',
	styleUrls: ['./window-layout.component.scss']
})
export class WindowLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit, AfterViewInit, AfterViewChecked
{
	@Input()
	set windows(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}
	@ViewChildren(WindowComponent) listWindows: QueryList<GuiDrag>;

	constructor(
		private windowService: WindowService,
		private readonly cdr: ChangeDetectorRef
	) {
		super();
	}
	ngAfterViewInit(): void {
		this.listWindows.changes.subscribe(
			(listWindows: QueryList<GuiDrag>) => {
				if (this.windowService.windows.length === 0) {
					if (!this.windowService.deSerialize()) {
						this.windowService.windows = listWindows.toArray();
					} else {
						this.windowService
							.deSerialize()
							.forEach((buffer: Partial<GuiDrag>) => {
								listWindows
									.toArray()
									.forEach((window: GuiDrag) => {
										if (window.title === buffer.title) {
											window.isCollapse =
												buffer.isCollapse;
											window.isExpand = buffer.isExpand;
											this.windowService.windows.push(
												window
											);
											this.windowService.windowsRef.push(
												window.templateRef
											);
										}
									});
							});
					}
				} else {
					this.windowService.windows = this.listWindows.toArray();
				}
			}
		);
	}
	ngAfterViewChecked(): void {
		this.cdr.detectChanges();
	}

	ngOnInit(): void {}

	protected drop(event: CdkDragDrop<number, number, any>): void {
		moveItemInArray(
			this.draggableObject,
			event.previousContainer.data,
			event.container.data
		);
		this.windowService.windowsRef = this.draggableObject;
	}

	get windows() {
		if (
			this.windowService.windowsRef.length > 0 &&
			this.draggableObject !== this.windowService.windowsRef
		)
			this.draggableObject = this.windowService.windowsRef;
		return this.draggableObject;
	}
}
