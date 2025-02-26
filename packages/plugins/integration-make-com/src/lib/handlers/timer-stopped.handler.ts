import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStoppedEvent } from '@gauzy/core/src/lib/time-tracking/timer/events';
import { WebhookService } from '../webhook.service';

@Injectable()
@EventsHandler(TimerStoppedEvent)
export class TimerStoppedHandler implements IEventHandler<TimerStoppedEvent> {
  constructor(private readonly webhookService: WebhookService) {}

  async handle(event: TimerStoppedEvent) {
    await this.webhookService.emitTimerEvent('stop', event.timeLog);
  }
}
