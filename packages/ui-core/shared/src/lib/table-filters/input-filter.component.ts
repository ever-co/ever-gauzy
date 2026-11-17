import {
	Component,
	OnChanges,
	OnDestroy,
	OnInit,
	type SimpleChanges,
	ChangeDetectionStrategy,
	inject
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { DefaultFilter } from 'angular2-smart-table';
import { ListFilterStateService } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-input-filter-selector',
	template: ` <input [formControl]="inputControl" class="form-control" [placeholder]="column.title" /> `,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class InputFilterComponent extends DefaultFilter implements OnInit, OnDestroy, OnChanges {
	public inputControl = new FormControl();
	private subscription: Subscription;
	private readonly _listFilterState = inject(ListFilterStateService);

	constructor() {
		super();
	}

	ngOnInit() {
		// Subscribe to value changes of the inputControl
		this.subscription = this.inputControl.valueChanges
			.pipe(
				// Apply a debounce time to reduce the frequency of value changes
				debounceTime(this.debounceTime),
				// Ensure distinct values to avoid redundant operations
				distinctUntilChanged(),
				// Use tap to perform a side effect, invoking the filterFunction of the column
				tap((value: string) => {
					this._listFilterState.record(this.column.id, value);
					this.column.filterFunction(value, this.column.id);
				})
			)
			// Subscribe to the observable
			.subscribe();

		// The list was opened by Back or Forward: the filter the user left comes back, through the same path as a
		// typed one, so the input and the list's query agree.
		const restored = this._listFilterState.restore(this.column.id);
		if (restored) {
			this.inputControl.setValue(restored);
		}
	}

	/**
	 *
	 * @param changes
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 * Lifecycle hook called just before the component is destroyed.
	 */
	ngOnDestroy() {
		// Unsubscribe from the subscription to avoid memory leaks.
		this.subscription.unsubscribe();
	}
}
