import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStoppedEvent } from '@gauzy/core';
import { WebhookService } from '../webhook.service';
import { ITimeLog } from '@gauzy/contracts';
@Injectable()
@EventsHandler(TimerStoppedEvent)
export class TimerStoppedHandler implements IEventHandler<TimerStoppedEvent> {
	constructor(private readonly webhookService: WebhookService) {}

	/**
	 * Handles the TimerStoppedEvent by emitting a 'stop' event with the corresponding time log.
	 *
	 * @param event - The TimerStoppedEvent containing the time log details.
	 * @returns A promise that resolves once the timer stop event is successfully emitted.
	 */
	async handle(event: TimerStoppedEvent): Promise<void> {
		await this.webhookService.emitTimerEvent<ITimeLog>('stop', event.timeLog);
	}
}
