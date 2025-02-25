import { IEvent } from '@nestjs/cqrs';
import { ITimerStatus } from '@gauzy/contracts';

export class TimerStatusUpdatedEvent implements IEvent {
  constructor(public readonly status: ITimerStatus) {}
}
