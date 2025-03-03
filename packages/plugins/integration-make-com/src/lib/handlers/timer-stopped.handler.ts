import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStoppedEvent } from '@gauzy/core';
import { WebhookService } from '../webhook.service';
import { ITimeLog } from '@gauzy/contracts';
@Injectable()
@EventsHandler(TimerStoppedEvent)
export class TimerStoppedHandler implements IEventHandler<TimerStoppedEvent> {
  constructor(private readonly webhookService: WebhookService) {}

  async handle(event: TimerStoppedEvent) {
    await this.webhookService.emitTimerEvent<ITimeLog>('stop', event.timeLog);
  }
}
