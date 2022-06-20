import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'gauzy-visibility',
	templateUrl: './visibility.component.html',
	styleUrls: ['./visibility.component.scss']
})
export class VisibilityComponent implements OnInit, ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
	@Output()
	visibilityChange: EventEmitter<boolean> = new EventEmitter();
	constructor() {}

	ngOnInit(): void {}

	onCheckedChange(event: boolean) {
		this.visibilityChange.emit(event);
	}
}
