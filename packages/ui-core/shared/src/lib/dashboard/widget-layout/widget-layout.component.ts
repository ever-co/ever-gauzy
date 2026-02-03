import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
	AfterViewChecked,
	AfterViewInit,
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
import { WidgetComponent } from '../widget/widget.component';
import { WidgetService } from '../widget/widget.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-widget-layout',
	templateUrl: './widget-layout.component.html',
	styleUrls: ['./widget-layout.component.scss'],
	standalone: false
})
export class WidgetLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy
{
	private readonly widgetService = inject(WidgetService);
	private readonly cdr = inject(ChangeDetectorRef);

	@Input()
	set widgets(value: TemplateRef<any>[]) {
		this.draggableObject = value as any;
	}
	@ViewChildren(WidgetComponent) listWidgets: QueryList<GuiDrag>;

	ngAfterViewChecked(): void {
		this.cdr.detectChanges();
	}

	ngAfterViewInit(): void {
		this.listWidgets.changes
			.pipe(
				tap((listWidgets: QueryList<GuiDrag>) => (this.widgetService.widgets$ = listWidgets.toArray())),
				untilDestroyed(this)
			)
			.subscribe();
	}

	protected drop(event: CdkDragDrop<number>): void {
		moveItemInArray(this.draggableObject, event.previousContainer.data, event.container.data);
		this.widgetService.widgetsRef = this.draggableObject as any;
		this.widgetService.save();
	}

	ngOnInit(): void {
		this.widgetService.widgetsRef = this.draggableObject as any;
	}

	get widgets() {
		if (this.widgetService.widgetsRef.length > 0 && (this.draggableObject as any) !== this.widgetService.widgetsRef)
			this.draggableObject = this.widgetService.widgetsRef as any;
		return this.draggableObject as any;
	}

	ngOnDestroy(): void {}
}
