import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStartedEvent } from '@gauzy/core';
import { WebhookService } from '../webhook.service';
import { ITimeLog } from '@gauzy/contracts';

@Injectable()
@EventsHandler(TimerStartedEvent)
export class TimerStartedHandler implements IEventHandler<TimerStartedEvent> {
	constructor(private readonly webhookService: WebhookService) {}

	/**
	 * Handles the TimerStartedEvent by emitting a 'start' timer event
	 * through the WebhookService.
	 *
	 * @param event - The TimerStartedEvent that contains the time log details.
	 * @returns A Promise that resolves once the timer event is emitted.
	 */
	async handle(event: TimerStartedEvent): Promise<void> {
		await this.webhookService.emitTimerEvent<ITimeLog>('start', event.timeLog);
	}
}
