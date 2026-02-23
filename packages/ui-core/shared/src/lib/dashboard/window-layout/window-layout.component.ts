import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	inject,
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
	styleUrls: ['./window-layout.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class WindowLayoutComponent extends LayoutWithDraggableObject implements OnInit, AfterViewInit, OnDestroy {
	private readonly windowService = inject(WindowService);
	private readonly cdr = inject(ChangeDetectorRef);

	@ViewChildren(WindowComponent) listWindows: QueryList<GuiDrag>;

	@Input()
	set windows(value: TemplateRef<any>[]) {
		this.draggableObject = value as any;
	}

	get windows() {
		if (
			this.windowService.windowsRef.length > 0 &&
			(this.draggableObject as any) !== this.windowService.windowsRef
		) {
			this.draggableObject = this.windowService.windowsRef as any;
		}
		return this.draggableObject as any;
	}

	ngOnInit(): void {
		this.windowService.windowsRef = this.draggableObject as any;
	}

	ngAfterViewInit(): void {
		this.listWidgets();
	}

	protected drop(event: CdkDragDrop<number, number, any>): void {
		moveItemInArray(this.draggableObject, event.previousContainer.data, event.container.data);
		this.windowService.windowsRef = this.draggableObject as any;
		this.windowService.save();
		this.cdr.markForCheck();
	}

	/**
	 * Subscribe to list windows changes
	 */
	private listWidgets(): void {
		this.listWindows.changes
			.pipe(
				tap((listWindows: QueryList<GuiDrag>) => {
					this.windowService.windows$ = listWindows.toArray();
					this.cdr.markForCheck();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
