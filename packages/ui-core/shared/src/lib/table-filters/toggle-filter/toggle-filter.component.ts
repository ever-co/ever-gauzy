import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { faCheck, faBan, faTimes } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'ga-toggle-filter',
    templateUrl: './toggle-filter.component.html',
    styleUrls: ['./toggle-filter.component.scss'],
    standalone: false
})
export class ToggleFilterComponent extends DefaultFilter implements OnChanges {
	faCheck = faCheck;
	faBan = faBan;
	faTimes = faTimes;
	choice;

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

	public onChange() {
		switch (this.choice) {
			case 'accept':
				this.isChecked = true;
				break;
			case 'deny':
				this.isChecked = false;
				break;
			default:
				this.isChecked = null;
		}
		this.column.filterFunction(this.isChecked, this.column.id);
	}

	ngOnChanges(changes: SimpleChanges): void {}
}
