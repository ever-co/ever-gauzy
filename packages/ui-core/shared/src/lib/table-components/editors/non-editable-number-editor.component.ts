import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Cell, DefaultEditor } from 'angular2-smart-table';

@Component({
	template: `
		<div>
			{{ cellValue }}
		</div>
	`
})
export class NonEditableNumberEditorComponent extends DefaultEditor implements OnInit {
	cellValue!: string;

	@Input() cell!: Cell;

	ngOnInit() {
		this.cellValue = this.cell.getValue();
	}
}
