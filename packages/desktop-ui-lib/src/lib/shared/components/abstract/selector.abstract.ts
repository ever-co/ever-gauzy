import { Component } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { SelectorService } from '../../+state/selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
    template: '',
    standalone: false
})
export abstract class AbstractSelectorComponent<T> implements ControlValueAccessor {
	public search$ = new Subject<string>();
	private onChange: (value: any) => void;
	private onTouched: () => void;
	protected isDisabled$ = new BehaviorSubject<boolean>(false);

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
	public change(value: string): void {
		this.onChange?.(value); // Notify the form control
		this.onTouched?.();
		this.updateSelected(value); // Update the store only if useStore is true
	}

	// Implement ControlValueAccessor methods
	public writeValue(value: string): void {
		this.useStore = false; // Disable store updates when used in a form
		if (value) {
			this.updateSelected(value);
		}
	}

	public registerOnChange(fn: any): void {
		this.onChange = fn;
	}

	public registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	public setDisabledState(isDisabled: boolean): void {
		this.isDisabled$.next(isDisabled);
	}

	// Abstract method to update selected item
	protected abstract updateSelected(value: string): void;

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
