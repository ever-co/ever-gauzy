import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs/internal/Subscription';
import { DefaultFilter } from 'angular2-smart-table';

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
	`
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
		// Subscribe to both min and max value changes
		this.subscription = this.rangeControl.valueChanges
			.pipe(
				debounceTime(this.debounceTime), // Reduce unnecessary requests
				distinctUntilChanged(), // Avoid redundant filtering
				tap(({ min, max }) => {
					if (min !== null || max !== null) {
						this.column.filterFunction({ min, max }, this.column.id);
					}
				})
			)
			.subscribe();
	}

	ngOnDestroy() {
		// Cleanup subscription to avoid memory leaks
		this.subscription.unsubscribe();
	}
}
