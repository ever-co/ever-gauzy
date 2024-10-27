import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-toggle-switcher',
	templateUrl: './toggle-switcher.component.html'
})
export class ToggleSwitcherComponent implements OnInit {
	/**
	 * A class member that represents a boolean switch or toggle using a BehaviorSubject.
	 */
	private _switcher$: BehaviorSubject<boolean> = new BehaviorSubject(false);

	/**
	 * Getter method for retrieving the toggle switch state as an Observable.
	 *
	 * @returns An Observable<boolean> that emits the current state and subsequent changes of the toggle switch.
	 */
	public get switcher$(): Observable<boolean> {
		return this._switcher$.asObservable();
	}

	/**
	 * Getter and Setter for managing a dynamic value.
	 */
	_value: any;
	/**
	 * Getter for retrieving the current value.
	 *
	 * @returns The current value of the dynamic element.
	 */
	get value(): any {
		return this._value;
	}
	/**
	 * Setter for updating the dynamic value.
	 * This setter is decorated with @Input to allow external components to bind and update the value.
	 *
	 * @param value - The new value to set for the dynamic element.
	 */
	@Input() set value(value: any) {
		// Updates the dynamic element's value using a BehaviorSubject or similar mechanism.
		this._switcher$.next(value);

		// Stores the value in the local variable for future reference.
		this._value = value;
	}

	/**
	 * An @Input property used to pass data from a parent component to this component.
	 *
	 */
	@Input() rowData: any;

	/**
	 * A class member and getter/setter for managing a boolean label.
	 */
	_label: boolean = true;
	/**
	 * Getter for retrieving the current boolean label.
	 *
	 * @returns The current boolean label.
	 */
	get label(): boolean {
		return this._label;
	}

	/**
	 * Setter for updating the boolean label.
	 * This setter is decorated with @Input to allow external components to bind and update the label.
	 *
	 * @param value - The new boolean label value.
	 */
	@Input() set label(value: boolean) {
		// Update the boolean label with the provided value.
		this._label = value;
	}

	/**
	 * An @Output property that emits a boolean value when an event occurs.
	 *
	 * This is used to create a custom event named 'switched' that can be listened to by external components.
	 */
	@Output() onSwitched: EventEmitter<boolean> = new EventEmitter<boolean>();

	constructor() {}

	/**
	 * The ngOnInit lifecycle hook is called when the component is initialized.
	 * This method subscribes to the 'switched' Observable, and upon changes, updates the '_switcher$' BehaviorSubject.
	 */
	ngOnInit(): void {
		this.onSwitched
			.pipe(
				tap((enable: boolean) => this._switcher$.next(enable)),
				// The 'untilDestroyed' operator helps to automatically unsubscribe when the component is destroyed.
				untilDestroyed(this)
			)
			.subscribe(); // Subscribe to the Observable but perform actions in 'tap'.
	}

	/**
	 * Handles a change event for a boolean value.
	 *
	 * @param event - A boolean value representing the change event.
	 */
	onCheckedChange(event: boolean) {
		// Emits the provided boolean 'event' using the 'switched' EventEmitter.
		this.onSwitched.emit(event);
	}
}
