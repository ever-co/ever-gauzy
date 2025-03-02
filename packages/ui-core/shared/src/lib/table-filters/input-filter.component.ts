import { Component, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs/internal/Subscription';
import { DefaultFilter } from 'angular2-smart-table';

@Component({
	selector: 'ga-input-filter-selector',
	template: ` <input [formControl]="inputControl" class="form-control" [placeholder]="column.title" /> `
})
export class InputFilterComponent extends DefaultFilter implements OnInit, OnDestroy, OnChanges {
	public inputControl = new FormControl();
	private subscription: Subscription;

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
				tap((value: string) => this.column.filterFunction(value, this.column.id))
			)
			// Subscribe to the observable
			.subscribe();
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
