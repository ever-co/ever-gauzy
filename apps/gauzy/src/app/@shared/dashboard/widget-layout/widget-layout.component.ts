import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit, TemplateRef } from '@angular/core';

@Component({
	selector: 'ga-widget-layout',
	templateUrl: './widget-layout.component.html',
	styleUrls: ['./widget-layout.component.scss']
})
export class WidgetLayoutComponent implements OnInit {
	@Input()
	widgets: TemplateRef<HTMLElement>[] = [];

	constructor() {}

	ngOnInit(): void {}

	drop(event: CdkDragDrop<number>): void {
		moveItemInArray(
			this.widgets,
			event.previousContainer.data,
			event.container.data
		);
	}
}
