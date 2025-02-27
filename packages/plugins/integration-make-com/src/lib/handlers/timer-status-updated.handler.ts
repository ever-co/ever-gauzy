import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStatusUpdatedEvent } from '@gauzy/core';
import { WebhookService } from '../webhook.service';
import { ITimerStatus } from '@gauzy/contracts';
@Injectable()
@EventsHandler(TimerStatusUpdatedEvent)
export class TimerStatusUpdatedHandler implements IEventHandler<TimerStatusUpdatedEvent> {
  constructor(private readonly webhookService: WebhookService) {}

  async handle(event: TimerStatusUpdatedEvent) {
    await this.webhookService.emitTimerEvent<ITimerStatus>('status', event.status);
  }
}
