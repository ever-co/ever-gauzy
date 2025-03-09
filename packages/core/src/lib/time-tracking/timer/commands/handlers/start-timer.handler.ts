import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ITimeLog } from '@gauzy/contracts';
import { StartTimerCommand } from '../../commands';
import { TimerStartedEvent } from '../../events';
import { TimerService } from '../../timer.service';

@Injectable()
@CommandHandler(StartTimerCommand)
export class StartTimerHandler implements ICommandHandler<StartTimerCommand> {
	constructor(private readonly timerService: TimerService, private readonly eventBus: EventBus) {}

	/**
	 * Executes the StartTimerCommand.
	 *
	 * This function starts a new timer using the provided command input,
	 * publishes a TimerStartedEvent with the generated time log,
	 * and returns the time log.
	 *
	 * @param command - An instance of StartTimerCommand containing the input data to start the timer.
	 * @returns A promise that resolves to an ITimeLog representing the started timer's log.
	 */
	async execute(command: StartTimerCommand): Promise<ITimeLog> {
		const { input } = command;

		// Start the timer and retrieve the time log.
		const timeLog = await this.timerService.startTimer(input);

		// Publish an event indicating that the timer has started.
		this.eventBus.publish(new TimerStartedEvent(timeLog));

		return timeLog;
	}
}
