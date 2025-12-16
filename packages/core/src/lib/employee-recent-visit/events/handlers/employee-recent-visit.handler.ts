import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EmployeeRecentVisitEvent } from '../employee-recent-visit.event';
import { EmployeeRecentVisitService } from '../../employee-recent-visit.service';

@EventsHandler(EmployeeRecentVisitEvent)
export class EmployeeRecentVisitEventHandler implements IEventHandler<EmployeeRecentVisitEvent> {
	constructor(readonly employeeRecentVisitService: EmployeeRecentVisitService) {}

	/**
	 * Handles the employee recent visit event by creating a new employee recent visit entry using the provided input data.
	 *
	 * @param event - The employee recent visit event containing the input data required to create the visit entry.
	 * @returns A promise that resolves with the created employee recent visit entry.
	 *
	 */
	async handle(event: EmployeeRecentVisitEvent) {
		// Extract the input from the event and create a new employee recent visit entry
		const { input } = event;
		return await this.employeeRecentVisitService.create({ ...input, visitedAt: new Date() });
	}
}
