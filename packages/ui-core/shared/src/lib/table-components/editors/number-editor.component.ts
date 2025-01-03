import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Cell, DefaultEditor } from 'angular2-smart-table';

@Component({
    template: `<input
		class="form-control"
		[min]="0"
		[type]="'number'"
		[(ngModel)]="cellValue"
		(input)="onInputChange($event)"
		[name]="cell.getId()"
	/>`,
    standalone: false
})
export class NumberEditorComponent extends DefaultEditor implements OnInit {
	cellValue!: number;

	@Input() cell!: Cell;
	@Output() onConfirm: EventEmitter<number> = new EventEmitter<number>();

	constructor() {
		super();
	}

	ngOnInit() {
		// Get the value from the cell
		if (this.cell.getValue()) {
			// Set the cell value to the new raw value
			this.cellValue = this.cell.getNewRawValue();
			// Set the value on the cell
			this.cell.setValue(this.cell.getNewRawValue());
		}
	}

	/**
	 * Handles the input change event.
	 *
	 * @param event - The input change event.
	 */
	onInputChange(event: Event): void {
		// Get the input element
		const inputElement = event.target as HTMLInputElement;
		// Get the value from the input element
		const value = inputElement.value;

		// Set the value on the cell
		this.cell.setValue(value);
	}
}
