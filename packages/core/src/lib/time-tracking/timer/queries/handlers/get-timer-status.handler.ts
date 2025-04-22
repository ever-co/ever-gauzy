import { EventBus, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ITimerStatus } from '@gauzy/contracts';
import { TimerStatusUpdatedEvent } from '../../events';
import { TimerService } from '../../timer.service';
import { GetTimerStatusQuery } from '../get-timer-status.query';

@Injectable()
@QueryHandler(GetTimerStatusQuery)
export class GetTimerStatusHandler implements IQueryHandler<GetTimerStatusQuery> {
	constructor(private readonly timerService: TimerService, private readonly eventBus: EventBus) {}

	/**
	 * Executes the GetTimerStatusQuery command.
	 *
	 * This function retrieves the timer status based on the provided input,
	 * publishes a TimerStatusUpdatedEvent with the obtained status, and returns the status.
	 *
	 * @param command - An instance of GetTimerStatusQuery containing the input data.
	 * @returns A promise that resolves to the current timer status as an ITimerStatus object.
	 */
	async execute(command: GetTimerStatusQuery): Promise<ITimerStatus> {
		const { input } = command;

		// Retrieve the current timer status using the timer service.
		const status = await this.timerService.getTimerStatus(input);

		// Publish an event indicating that the timer status has been updated.
		this.eventBus.publish(new TimerStatusUpdatedEvent(status));

		return status;
	}
}
