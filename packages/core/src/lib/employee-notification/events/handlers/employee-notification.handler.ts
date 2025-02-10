import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EmployeeCreateNotificationEvent } from '../employee-notification.event';
import { EmployeeNotificationService } from '../../employee-notification.service';

@EventsHandler(EmployeeCreateNotificationEvent)
export class EmployeeCreateNotificationEventHandler implements IEventHandler<EmployeeCreateNotificationEvent> {
	constructor(readonly employeeNotificationService: EmployeeNotificationService) {}

	/**
	 * Handles the employee notification event by creating a new employee notification entry using the provided input data.
	 *
	 * @param event - The employee notification event containing the input data required to create the notification entry.
	 * @returns A promise that resolves with the created employee notification entry.
	 *
	 */
	async handle(event: EmployeeCreateNotificationEvent) {
		return await this.employeeNotificationService.create(event.input);
	}
}
