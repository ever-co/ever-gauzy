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
import { WidgetComponent } from '../widget/widget.component';
import { WidgetService } from '../widget/widget.service';

@Component({
	selector: 'ga-widget-layout',
	templateUrl: './widget-layout.component.html',
	styleUrls: ['./widget-layout.component.scss']
})
export class WidgetLayoutComponent
	extends LayoutWithDraggableObject
	implements OnInit, AfterViewInit, AfterViewChecked
{
	@Input()
	set widgets(value: TemplateRef<HTMLElement>[]) {
		this.draggableObject = value;
	}
	@ViewChildren(WidgetComponent) listWidgets: QueryList<GuiDrag>;

	constructor(
		private readonly widgetService: WidgetService,
		private readonly cdr: ChangeDetectorRef
	) {
		super();
	}
	ngAfterViewChecked(): void {
		this.cdr.detectChanges();
	}

	ngAfterViewInit(): void {
		this.listWidgets.changes.subscribe(
			(listwidgets: QueryList<GuiDrag>) => {
				if (this.widgetService.widgets.length === 0) {
					if (!this.widgetService.deSerialize()) {
						this.widgetService.widgets = listwidgets.toArray();
					} else {
						this.widgetService
							.deSerialize()
							.forEach((buffer: Partial<GuiDrag>) => {
								listwidgets
									.toArray()
									.forEach((widget: GuiDrag) => {
										if (widget.title === buffer.title) {
											widget.isCollapse =
												buffer.isCollapse;
											widget.isExpand = buffer.isExpand;
											this.widgetService.widgets.push(
												widget
											);
											this.widgetService.widgetsRef.push(
												widget.templateRef
											);
										}
									});
							});
					}
				} else {
					this.widgetService.widgets = listwidgets.toArray();
				}
			}
		);
	}

	protected drop(event: CdkDragDrop<number>): void {
		moveItemInArray(
			this.draggableObject,
			event.previousContainer.data,
			event.container.data
		);
		this.widgetService.widgetsRef = this.draggableObject;
	}

	ngOnInit(): void {}

	get widgets() {
		if (
			this.widgetService.widgetsRef.length > 0 &&
			this.draggableObject !== this.widgetService.widgetsRef
		)
			this.draggableObject = this.widgetService.widgetsRef;
		return this.draggableObject;
	}
}
