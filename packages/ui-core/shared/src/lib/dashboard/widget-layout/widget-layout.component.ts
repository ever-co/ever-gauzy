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
import { WidgetComponent } from '../widget/widget.component';
import { WidgetService } from '../widget/widget.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-widget-layout',
	templateUrl: './widget-layout.component.html',
	styleUrls: ['./widget-layout.component.scss']
})
export class WidgetLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy
{
	@Input()
	set widgets(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}
	@ViewChildren(WidgetComponent) listWidgets: QueryList<GuiDrag>;

	constructor(private readonly widgetService: WidgetService, private readonly cdr: ChangeDetectorRef) {
		super();
	}
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
		this.widgetService.widgetsRef = this.draggableObject;
		this.widgetService.save();
	}

	ngOnInit(): void {
		this.widgetService.widgetsRef = this.draggableObject;
	}

	get widgets() {
		if (this.widgetService.widgetsRef.length > 0 && this.draggableObject !== this.widgetService.widgetsRef)
			this.draggableObject = this.widgetService.widgetsRef;
		return this.draggableObject;
	}

	ngOnDestroy(): void {}
}
