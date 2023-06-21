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

	@Output()
	visibilityChange: EventEmitter<boolean>;

	private _rowData: any;

	constructor() {
		this.visibilityChange = new EventEmitter();
	}

	ngOnInit(): void {}

	onCheckedChange(event: boolean) {
		this.visibilityChange.emit(event);
	}

	@Input()
	public set rowData(value: any) {
		if (value) {
			this._rowData = value;
		}
	}

	public get rowData() {
		return this._rowData;
	}
}
