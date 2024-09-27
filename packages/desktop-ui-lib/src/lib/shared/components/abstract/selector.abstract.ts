import { Component } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { SelectorService } from '../../+state/selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export abstract class AbstractSelectorComponent<T> implements ControlValueAccessor {
	public search$ = new Subject<string>();
	private onChange: (value: any) => void;
	private onTouched: () => void;
	private isDisabled: boolean;

	// Flag to control whether to update the store
	protected useStore: boolean = true;

	// Abstract members to be implemented in derived classes
	public abstract data$: Observable<T[]>;
	public abstract selected$: Observable<T>;
	public abstract isLoading$: Observable<boolean>;
	public abstract disabled$: Observable<boolean>;
	public abstract hasPermission$: Observable<boolean>;

	constructor() {}

	// Handle value change
	public change(value: T): void {
		this.onChange(value); // Notify the form control
		if (this.useStore) {
			this.updateSelected(value); // Update the store only if useStore is true
		}
	}

	// Implement ControlValueAccessor methods
	public writeValue(value: T): void {
		this.useStore = false; // Disable store updates when used in a form
		if (value) {
			this.updateSelected(value);
		}
		this.useStore = true; // Enable store updates after initialization
	}

	public registerOnChange(fn: any): void {
		this.onChange = fn;
	}

	public registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	public setDisabledState(isDisabled: boolean): void {
		this.isDisabled = isDisabled;
	}

	// Abstract method to update selected item
	protected abstract updateSelected(value: T): void;

	// Common search handling logic
	protected handleSearch(service: SelectorService<T>) {
		this.search$
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap(() => service.resetPage()),
				switchMap((searchTerm) => service.load({ searchTerm })),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
