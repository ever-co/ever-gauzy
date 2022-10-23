import {Component, OnChanges, SimpleChanges} from '@angular/core';
import {DefaultFilter} from "ng2-smart-table";

@Component({
	selector: 'ga-toggle-filter',
	template: `
		<div class="toggle">
			<nb-toggle [checked]="isChecked" (checkedChange)="onChange($event)"></nb-toggle>
		</div>`,
	styles: [
		`div.toggle {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
		}`
	]
})
export class ToggleFilterComponent extends DefaultFilter implements OnChanges {
	constructor() {
		super();
		this._isChecked = false;
	}

	private _isChecked: boolean;

	get isChecked(): boolean {
		return this._isChecked;
	}

	set isChecked(value: boolean) {
		this._isChecked = value;
	}

	public onChange(isChecked: boolean) {
		this.isChecked = isChecked;
		this.column.filterFunction(this.isChecked);
	}

	ngOnChanges(changes: SimpleChanges): void {
	}

}
