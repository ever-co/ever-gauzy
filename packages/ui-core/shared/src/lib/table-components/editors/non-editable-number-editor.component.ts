import { Component, Input, OnInit } from '@angular/core';
import { Cell, DefaultEditor } from 'angular2-smart-table';

@Component({
    template: `
		<div>
			{{ cellValue }}
		</div>
	`,
    standalone: false
})
export class NonEditableNumberEditorComponent extends DefaultEditor implements OnInit {
	cellValue!: string | number;

	@Input() cell!: Cell;

	ngOnInit() {
		const value = this.cell.getValue();
		if (value === null || value === undefined) {
			console.warn('Cell value is null or undefined');
			this.cellValue = '';
		} else if (typeof value === 'number' || typeof value === 'string') {
			this.cellValue = value;
		} else {
			console.error('Unexpected cell value type:', typeof value);
			this.cellValue = '';
		}
	}
}
