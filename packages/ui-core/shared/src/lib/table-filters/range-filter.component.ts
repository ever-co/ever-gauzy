import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
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
	standalone: false
})
export class RangeFilterComponent extends DefaultFilter implements OnInit, OnDestroy {
	public rangeControl = new FormGroup({
		min: new FormControl(),
		max: new FormControl()
	});
	private subscription: Subscription;

	constructor() {
		super();
	}

	ngOnInit() {
		// Subscribe to both min and max value changes with optimized operators
		this.subscription = this.rangeControl.valueChanges
			.pipe(
				debounceTime(this.debounceTime), // Reduce unnecessary requests
				distinctUntilChanged((prev, curr) => prev.min === curr.min && prev.max === curr.max), // Compare min and max values
				filter(({ min, max }) => min !== null || max !== null), // Only process when at least one value is provided
				tap(({ min, max }) => this.column.filterFunction({ min, max }, this.column.id))
			)
			.subscribe();
	}

	ngOnDestroy() {
		// Cleanup subscription to avoid memory leaks
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
