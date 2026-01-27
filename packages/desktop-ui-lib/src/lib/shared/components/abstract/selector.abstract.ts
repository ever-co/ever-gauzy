import { Directive, OnDestroy } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { SelectorService } from '../../+state/selector.service';

@Directive()
export abstract class AbstractSelectorComponent<T> implements ControlValueAccessor, OnDestroy {
	public search$: Subject<string>;
	private onChange: (value: any) => void;
	private onTouched: () => void;
	protected isDisabled$: BehaviorSubject<boolean>;
	protected subscriptions: Subscription = new Subscription();

	// Flag to control whether to update the store
	protected useStore: boolean = true;

	// Abstract members to be implemented in derived classes
	public abstract data$: Observable<T[]>;
	public abstract selected$: Observable<T>;
	public abstract isLoading$: Observable<boolean>;
	public abstract disabled$: Observable<boolean>;
	public abstract hasPermission$: Observable<boolean>;

	constructor() {
		this.search$ = new Subject<string>();
		this.isDisabled$ = new BehaviorSubject<boolean>(false);
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
		this.search$.complete();
		this.isDisabled$.complete();
	}

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
	protected handleSearch(service: SelectorService<T>): void {
		const sub = this.search$
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap(() => service.resetPage()),
				switchMap((searchTerm) => service.load({ searchTerm }))
			)
			.subscribe();

		this.subscriptions.add(sub);
	}
}
