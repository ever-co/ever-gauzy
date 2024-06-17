import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
	selector: 'ngx-resync-button',
	templateUrl: './resync-button.component.html',
	styleUrls: [],
})
export class ResyncButtonComponent {

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
		// Stores the value in the local variable for future reference.
		this._value = value;
	}

	/**
	 * An @Input property used to pass data from a parent component to this component.
	 *
	 */
	@Input() rowData: any;

	/**
	 * An output property for emitting click events.
	 *
	 * This output property emits events of type Event when a click event occurs.
	 */
	@Output() clicked: EventEmitter<Event> = new EventEmitter();

	/**
	 * Handle a click event, conditionally emitting it for further processing.
	 *
	 * @param event - The click event to be handled.
	 */
	onClicked(event: Event) {
		// Access the repository data from the component's rowData.
		const repository = this.rowData.repository;

		// Check if the repository data exists and has synchronization enabled.
		if (!repository || !repository.hasSyncEnabled) {
			return; // If repository is missing or synchronization is not enabled, exit the function.
		}

		// Emit the event using an EventEmitter, possibly to notify other parts of the application.
		this.clicked.emit(event);
	}
}
