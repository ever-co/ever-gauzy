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
import { filter, tap } from 'rxjs/operators';
import { GuiDrag } from '../interfaces/gui-drag.abstract';
import { LayoutWithDraggableObject } from '../interfaces/layout-with-draggable-object.abstract';
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
		this.listWindows.changes
			.pipe(
				tap(
					(listWindows: QueryList<GuiDrag>) =>
						(this.windowService.windows = listWindows.toArray())
				),
				filter(() => this.windowService.windowsRef.length === 0),
				tap(() => {
					this.windowService.deSerialize().length === 0
						? this.windowService.serialize()
						: this.windowService
								.deSerialize()
								.forEach((deserialized: GuiDrag) =>
									this.windowService.windowsRef.push(
										deserialized.templateRef
									)
								);
				}),
				untilDestroyed(this)
			)
			.subscribe();
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
		this.windowService.serialize();
	}

	get windows() {
		if (
			this.windowService.windowsRef.length > 0 &&
			this.draggableObject !== this.windowService.windowsRef
		)
			this.draggableObject = this.windowService.windowsRef;
		return this.draggableObject;
	}

	ngOnDestroy(): void {}
}
