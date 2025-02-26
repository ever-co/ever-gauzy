import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStartedEvent } from '@gauzy/core/src/lib/time-tracking/timer/events';
import { WebhookService } from '../webhook.service';

@Injectable()
@EventsHandler(TimerStartedEvent)
export class TimerStartedHandler implements IEventHandler<TimerStartedEvent> {
  constructor(private readonly webhookService: WebhookService) {}

  async handle(event: TimerStartedEvent) {
    await this.webhookService.emitTimerEvent('start', event.timeLog);
  }
}
