import { CommandHandler, ICommandHandler, EventBus, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ITimeLog, ITimerStatus } from '@gauzy/contracts';
import { TimerStartedEvent, TimerStatusUpdatedEvent, TimerStoppedEvent } from '@gauzy/core';
import { TimerService, GetTimerStatusQuery, StopTimerCommand, StartTimerCommand } from '@gauzy/core';

@Injectable()
@CommandHandler(StartTimerCommand)
export class ZapierStartTimerHandler implements ICommandHandler<StartTimerCommand> {
    constructor(private readonly timerService: TimerService, private readonly eventBus: EventBus) {}

    async execute(command: StartTimerCommand): Promise<ITimeLog> {
        const { input } = command;
        const timeLog = await this.timerService.startTimer(input);
        this.eventBus.publish(new TimerStartedEvent(timeLog));
        return timeLog;
    }
}

@Injectable()
@CommandHandler(StopTimerCommand)
export class ZapierStopTimerHandler implements ICommandHandler<StopTimerCommand> {
    constructor(private readonly timerService: TimerService, private readonly eventBus: EventBus) {}

    async execute(command: StopTimerCommand): Promise<ITimeLog> {
        const { input } = command;
        const timeLog = await this.timerService.stopTimer(input);
        this.eventBus.publish(new TimerStoppedEvent(timeLog));
        return timeLog;
    }
}

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
