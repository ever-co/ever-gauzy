import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStatusUpdatedEvent } from '@gauzy/core';
import { WebhookService } from '../webhook.service';
import { ITimerStatus } from '@gauzy/contracts';
@Injectable()
@EventsHandler(TimerStatusUpdatedEvent)
export class TimerStatusUpdatedHandler implements IEventHandler<TimerStatusUpdatedEvent> {
	constructor(private readonly webhookService: WebhookService) {}

	/**
	 * Handles the TimerStatusUpdatedEvent by emitting a 'status' event with the updated timer status.
	 *
	 * @param event - The TimerStatusUpdatedEvent containing the updated timer status.
	 * @returns A promise that resolves once the timer status event is emitted.
	 */
	async handle(event: TimerStatusUpdatedEvent): Promise<void> {
		await this.webhookService.emitTimerEvent<ITimerStatus>('status', event.status);
	}
}
