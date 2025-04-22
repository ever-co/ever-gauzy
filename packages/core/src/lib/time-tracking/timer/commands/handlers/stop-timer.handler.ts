import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { StopTimerCommand } from '../../commands';
import { TimerStoppedEvent } from '../../events';
import { ITimeLog } from '@gauzy/contracts';
import { TimerService } from '../../timer.service';

@Injectable()
@CommandHandler(StopTimerCommand)
export class StopTimerHandler implements ICommandHandler<StopTimerCommand> {
	constructor(private readonly timerService: TimerService, private readonly eventBus: EventBus) {}

	/**
	 * Executes the StopTimerCommand.
	 *
	 * This function stops the timer using the provided command input,
	 * publishes a TimerStoppedEvent with the updated time log, and returns the time log.
	 *
	 * @param command - An instance of StopTimerCommand containing the input data for stopping the timer.
	 * @returns A promise that resolves to an ITimeLog representing the stopped timer's log.
	 */
	async execute(command: StopTimerCommand): Promise<ITimeLog> {
		const { input } = command;

		// Stop the timer and retrieve the time log.
		const timeLog = await this.timerService.stopTimer(input);

		// Publish an event indicating that the timer has been stopped.
		this.eventBus.publish(new TimerStoppedEvent(timeLog));

		return timeLog;
	}
}
