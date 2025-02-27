import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStartedEvent } from '@gauzy/core';
import { WebhookService } from '../webhook.service';
import { ITimeLog } from '@gauzy/contracts';

@Injectable()
@EventsHandler(TimerStartedEvent)
export class TimerStartedHandler implements IEventHandler<TimerStartedEvent> {
  constructor(private readonly webhookService: WebhookService) {}

  async handle(event: TimerStartedEvent) {
    await this.webhookService.emitTimerEvent<ITimeLog>('start', event.timeLog);
  }
}
