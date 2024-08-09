import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-toggle-switch',
	templateUrl: './toggle-switch.component.html'
})
export class ToggleSwitchComponent implements OnInit {

	/**
	 * A class member that represents a boolean switch or toggle using a BehaviorSubject.
	 */
	private _toggle_switch$: BehaviorSubject<boolean> = new BehaviorSubject(false);

	/**
	 * Getter method for retrieving the toggle switch state as an Observable.
	 *
	 * @returns An Observable<boolean> that emits the current state and subsequent changes of the toggle switch.
	 */
	public get toggle_switch$(): Observable<boolean> {
		return this._toggle_switch$.asObservable();
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
		this._toggle_switch$.next(value);

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
	@Output() switched: EventEmitter<boolean> = new EventEmitter();


	constructor() { }

	/**
	 * The ngOnInit lifecycle hook is called when the component is initialized.
	 * This method subscribes to the 'switched' Observable, and upon changes, updates the '_toggle_switch$' BehaviorSubject.
	 */
	ngOnInit(): void {
		this.switched.pipe(
			// The 'tap' operator allows side-effects without changing the emitted values.
			tap((enable: boolean) => this._toggle_switch$.next(enable)),
			// The 'untilDestroyed' operator helps to automatically unsubscribe when the component is destroyed.
			untilDestroyed(this)
		).subscribe(); // Subscribe to the Observable but perform actions in 'tap'.
	}

	/**
	 * Handles a change event for a boolean value.
	 *
	 * @param event - A boolean value representing the change event.
	 */
	onCheckedChange(event: boolean) {
		// Emits the provided boolean 'event' using the 'switched' EventEmitter.
		this.switched.emit(event);
	}
}
