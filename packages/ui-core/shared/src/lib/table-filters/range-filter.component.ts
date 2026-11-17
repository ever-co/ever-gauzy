import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ListFilterStateService } from '@gauzy/ui-core/core';
import { DefaultFilter } from 'angular2-smart-table';
import { debounceTime, distinctUntilChanged, filter, Subscription, tap } from 'rxjs';

@Component({
	selector: 'ga-range-filter-selector',
	template: `
		<div class="d-flex">
			<input
				[formControl]="rangeControl.controls.min"
				class="form-control me-2"
				placeholder="Min"
				type="number"
				aria-label="Minimum value"
			/>

			<span aria-hidden="true">-</span>
			<input
				[formControl]="rangeControl.controls.max"
				class="form-control"
				placeholder="Max"
				type="number"
				aria-label="Maximum value"
			/>
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class RangeFilterComponent extends DefaultFilter implements OnInit, OnDestroy {
	public rangeControl = new FormGroup({
		min: new FormControl(),
		max: new FormControl()
	});
	private subscription: Subscription;
	private readonly _listFilterState = inject(ListFilterStateService);

	constructor() {
		super();
	}

	ngOnInit() {
		// Subscribe to both min and max value changes with optimized operators
		this.subscription = this.rangeControl.valueChanges
			.pipe(
				debounceTime(this.debounceTime), // Reduce unnecessary requests
				distinctUntilChanged((prev, curr) => prev.min === curr.min && prev.max === curr.max), // Compare min and max values
				// Remember the range for a later Back; one cleared of both bounds is forgotten, so Back does not
				// bring the old bounds back.
				tap(({ min, max }) =>
					this._listFilterState.record(this.column.id, this._isEmptyRange(min, max) ? null : { min, max })
				),
				filter(({ min, max }) => !this._isEmptyRange(min, max)), // Only filter when at least one bound is set
				tap(({ min, max }) => this.column.filterFunction({ min, max }, this.column.id))
			)
			.subscribe();

		// The list was opened by Back or Forward: the range the user left comes back, through the same path as a typed one.
		const restored = this._listFilterState.restore(this.column.id) as
			| { min: number | null; max: number | null }
			| undefined;
		if (restored) {
			this.rangeControl.setValue({ min: restored.min ?? null, max: restored.max ?? null });
		}
	}

	ngOnDestroy() {
		// Cleanup subscription to avoid memory leaks
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}

	/** Neither bound is set (a cleared number input reports null). */
	private _isEmptyRange(min: number | null | undefined, max: number | null | undefined): boolean {
		return (min === null || min === undefined) && (max === null || max === undefined);
	}
}
