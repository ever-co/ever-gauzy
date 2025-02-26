import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStatusUpdatedEvent } from '@gauzy/core/src/lib/time-tracking/timer/events';
import { WebhookService } from '../webhook.service';

@Injectable()
@EventsHandler(TimerStatusUpdatedEvent)
export class TimerStatusUpdatedHandler implements IEventHandler<TimerStatusUpdatedEvent> {
  constructor(private readonly webhookService: WebhookService) {}

  async handle(event: TimerStatusUpdatedEvent) {
    await this.webhookService.emitTimerEvent('status', event.status);
  }
}
