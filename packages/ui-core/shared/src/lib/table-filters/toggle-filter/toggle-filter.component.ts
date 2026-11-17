import { Component, OnChanges, OnInit, type SimpleChanges, ChangeDetectionStrategy, inject } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { ListFilterStateService } from '@gauzy/ui-core/core';
import { faCheck, faBan, faTimes } from '@fortawesome/free-solid-svg-icons';

@Component({
	selector: 'ga-toggle-filter',
	templateUrl: './toggle-filter.component.html',
	styleUrls: ['./toggle-filter.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ToggleFilterComponent extends DefaultFilter implements OnInit, OnChanges {
	private readonly _listFilterState = inject(ListFilterStateService);
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
		this._listFilterState.record(this.column.id, this.isChecked);
		this.column.filterFunction(this.isChecked, this.column.id);
	}

	override ngOnInit(): void {
		super.ngOnInit();
		// The list was opened by Back or Forward: the choice the user left comes back, through the same path as a click.
		const restored = this._listFilterState.restore(this.column.id) as boolean | null | undefined;
		if (restored === true || restored === false) {
			this.choice = restored ? 'accept' : 'deny';
			this.onChange();
		}
	}

	ngOnChanges(changes: SimpleChanges): void {}
}
